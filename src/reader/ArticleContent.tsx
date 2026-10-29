import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { WebView } from "react-native-webview";
import { safeUrl } from "../data/feeds";
import { theme, type Palette } from "../ui/theme";
import WebPage from "./WebPage";
import { extractionScript } from "./extraction.generated";
import { cachedPage, cachePage } from "./cache";
import { matchesReaderOrigin, parsePageArticle, type PageArticle, type ReadingMode } from "./page";

export type ArticleContentHandle = { goBack: () => boolean };
export type ReadingState = { page: PageArticle | null; loading: boolean; unavailable: boolean; retry: () => void };
type Props = {
  url: string;
  mode: ReadingMode;
  colors: Palette;
  onNavigation: (url: string, canGoBack: boolean) => void;
  onOpenBrowser: (url: string) => void;
  renderReading: (state: ReadingState) => React.ReactNode;
};

export const ArticleContent = forwardRef<ArticleContentHandle, Props>(function ArticleContent({
  url, mode, colors: c, onNavigation, onOpenBrowser, renderReading,
}, ref) {
  const web = useRef<WebView>(null);
  const currentUrl = useRef(url);
  const [activeUrl, setActiveUrl] = useState(url);
  const canGoBack = useRef(false);
  const [page, setPage] = useState<PageArticle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const extractionRetry = useRef<ReturnType<typeof setInterval> | null>(null);
  const extractionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unavailableModule = useCallback(() => { setFailed(true); setUnavailable(true); }, []);

  useImperativeHandle(ref, () => ({ goBack() {
    if (mode !== "web" || !canGoBack.current || !web.current) return false;
    web.current.goBack();
    return true;
  } }), [mode]);

  useEffect(() => {
    let active = true;
    void cachedPage(url).then((cached) => {
      if (active && cached && (currentUrl.current === url || currentUrl.current === cached.url))
        setPage((existing) => existing || cached);
    });
    return () => { active = false; };
  }, [url]);

  useEffect(() => {
    if (loaded || failed) return;
    const timer = setTimeout(() => { setFailed(true); setUnavailable(true); }, 30_000);
    return () => clearTimeout(timer);
  }, [loaded, failed, retryCount]);

  useEffect(() => {
    if (mode !== "reading") return;
    setExtracting(true);
    setUnavailable(false);
    // Re-extract on every toggle, including pages rendered after the load event.
    web.current?.injectJavaScript(extractionScript);
    // Publishers can hydrate the article after onLoad. A failed early attempt
    // isn't final: retry while this page's extraction window remains open.
    const retry = extractionRetry.current = setInterval(() => web.current?.injectJavaScript(extractionScript), 1500);
    extractionTimer.current = setTimeout(() => {
      clearInterval(retry);
      extractionTimer.current = null;
      setExtracting(false);
      setUnavailable(true);
    }, 30_000);
    return () => {
      clearInterval(retry);
      if (extractionTimer.current) clearTimeout(extractionTimer.current);
      extractionTimer.current = null;
    };
  }, [mode, retryCount, activeUrl]);

  function retry() {
    setFailed(false);
    setUnavailable(false);
    setLoaded(false);
    setRetryCount((count) => count + 1);
    web.current?.reload();
  }

  return <View style={{ flex: 1 }}>
    <View
      style={[StyleSheet.absoluteFill, mode === "reading" && { opacity: 0 }]}
      pointerEvents={mode === "reading" ? "none" : "auto"}
      accessibilityElementsHidden={mode === "reading"}
      importantForAccessibility={mode === "reading" ? "no-hide-descendants" : "auto"}
    >
      <WebPage
        ref={web}
        source={{ uri: safeUrl(url) }}
        style={{ flex: 1, backgroundColor: c.paper }}
        onUnavailable={unavailableModule}
        // Handle every scheme ourselves; WebView otherwise hands unlisted
        // schemes directly to the operating system before our callback runs.
        originWhitelist={["*"]}
        // Keep webpage navigation in Ress; external apps require a user action.
        onShouldStartLoadWithRequest={(request) => !!safeUrl(request.url) || request.url === "about:blank"}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        geolocationEnabled={false}
        onLoadStart={(event) => {
          const next = safeUrl(event.nativeEvent.url);
          if (!next) return;
          currentUrl.current = next;
          setActiveUrl(next);
          setPage((previous) => previous?.url === next ? previous : null);
          setLoaded(false);
          setFailed(false);
          setUnavailable(false);
        }}
        onNavigationStateChange={(navigation) => {
          const next = safeUrl(navigation.url);
          if (!next) return;
          if (next !== currentUrl.current) {
            currentUrl.current = next;
            setActiveUrl(next);
            setPage((previous) => previous?.url === next ? previous : null);
            setUnavailable(false);
          }
          canGoBack.current = navigation.canGoBack;
          onNavigation(next, navigation.canGoBack);
        }}
        onLoad={() => { setLoaded(true); setFailed(false); }}
        onError={() => { setFailed(true); setUnavailable(true); }}
        onRenderProcessGone={() => { setFailed(true); setUnavailable(true); }}
        onHttpError={(event) => {
          if (event.nativeEvent.url === currentUrl.current && event.nativeEvent.statusCode >= 400) {
            setFailed(true); setUnavailable(true);
          }
        }}
        onMessage={(event) => {
          // Ignore iframe messages and replies from a page we've navigated away from.
          if (!matchesReaderOrigin(event.nativeEvent.url, currentUrl.current)) return;
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (!["ress:article", "ress:unavailable"].includes(message?.type) || message.url !== currentUrl.current) return;
          } catch { return; }
          const extracted = parsePageArticle(event.nativeEvent.data, currentUrl.current);
          if (!extracted) return; // Keep trying until the extraction deadline.
          if (extractionTimer.current) clearTimeout(extractionTimer.current);
          if (extractionRetry.current) clearInterval(extractionRetry.current);
          setExtracting(false);
          setLoaded(true);
          setFailed(false);
          setPage(extracted);
          setUnavailable(false);
          void cachePage(extracted, canGoBack.current ? undefined : url).catch(() => {});
        }}
      />
      {!loaded || failed ? <View style={[StyleSheet.absoluteFill, styles.status, { backgroundColor: c.paper }]}>
        {failed ? <>
          <Text style={[styles.title, { color: c.ink }]}>Couldn't load this page</Text>
          <Text style={[styles.copy, { color: c.muted }]}>Try again or open it in your browser.</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={[styles.button, { backgroundColor: c.yellow }]}>
            <Text style={[styles.buttonText, { color: c.accentInk }]}>Retry page</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onOpenBrowser(currentUrl.current)} style={styles.button}>
            <Text style={[styles.buttonText, { color: c.ink }]}>Open in browser</Text>
          </Pressable>
        </> : <><ActivityIndicator color={c.ink} /><Text style={[styles.copy, { color: c.muted }]}>Loading page…</Text></>}
      </View> : null}
    </View>
    {mode === "reading" && <View style={{ flex: 1, backgroundColor: c.paper }}>
      {renderReading({ page, loading: !failed && (!loaded || extracting), unavailable, retry })}
    </View>}
  </View>;
});

const styles = StyleSheet.create({
  status: { justifyContent: "center", alignItems: "center", padding: 24, gap: 16 },
  title: { fontFamily: theme.font.bold, fontSize: 22, textAlign: "center" },
  copy: { fontFamily: theme.font.body, fontSize: 16, textAlign: "center" },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, justifyContent: "center" },
  buttonText: { fontFamily: theme.font.medium, fontSize: 16 },
});
