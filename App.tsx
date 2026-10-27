import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Alert,
  AppState,
  Appearance,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Vollkorn_600SemiBold } from "@expo-google-fonts/vollkorn/600SemiBold";
import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk/400Regular";
import { HankenGrotesk_500Medium } from "@expo-google-fonts/hanken-grotesk/500Medium";
import { HankenGrotesk_700Bold } from "@expo-google-fonts/hanken-grotesk/700Bold";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import Download from "lucide-react-native/icons/download";
import LayoutGrid from "lucide-react-native/icons/layout-grid";
import Plus from "lucide-react-native/icons/plus";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Rss from "lucide-react-native/icons/rss";
import Search from "lucide-react-native/icons/search";
import Share2 from "lucide-react-native/icons/share-2";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import X from "lucide-react-native/icons/x";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Browser from "expo-web-browser";
import {
  Article,
  Source,
  faviconUrl,
  relativeTime,
  parseOpml,
  safeUrl,
} from "./src/data/feeds";
import {
  defaults,
  fetchSource,
  fetchSourceDetails,
  keys,
  loadLibrary,
  put,
  refreshFeeds,
  Settings,
} from "./src/data/store";
import { pinWidget, updateWidgets, widgetAvailable } from "./src/widget/bridge";
import { theme, colorsFor, resolveTheme, type Palette } from "./src/ui/theme";
const f = theme.font;
const ThemeContext = createContext<{
  c: Palette;
  s: ReturnType<typeof createStyles>;
  dark: boolean;
} | null>(null);
function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("Theme provider is missing.");
  return value;
}
type Tab = "Feed" | "Saved" | "Sources" | "Settings";
const tabs = [
  { name: "Feed", icon: Rss },
  { name: "Saved", icon: Bookmark },
  { name: "Sources", icon: LayoutGrid },
  { name: "Settings", icon: SlidersHorizontal },
] as const;
const dateLabel = relativeTime;
function Favicon({
  uri,
  title,
  size = 24,
}: {
  uri: string;
  title: string;
  size?: number;
}) {
  const { c, s } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View
      style={[s.favicon, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[s.sourceInitial, { fontSize: size * 0.42 }]}>
          {title.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
function Thumbnail({ uri }: { uri?: string }) {
  const { c, s } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return uri && !failed ? (
    <Image
      source={{ uri }}
      style={s.thumbnail}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityLabel="Article image"
    />
  ) : null;
}
function SourceRow({
  source,
  onEdit,
  onRemove,
  disabled,
}: {
  source: Source;
  onEdit: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const { c, s } = useTheme();
  const offset = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const swiping = useRef(false);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        swiping.current = true;
      },
      onPanResponderMove: (_, g) =>
        offset.setValue(
          Math.max(-76, Math.min(0, g.dx + (open.current ? -76 : 0))),
        ),
      onPanResponderRelease: (_, g) => {
        open.current = g.dx < -30 || (open.current && g.dx < 30);
        Animated.spring(offset, {
          toValue: open.current ? -76 : 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(offset, {
          toValue: open.current ? -76 : 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;
  return (
    <View style={s.swipeRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${source.title}`}
        disabled={disabled}
        onPress={onRemove}
        style={s.deleteSource}
      >
        <X color={c.white} size={22} />
      </Pressable>
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateX: offset }] }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${source.title}`}
          accessibilityActions={[{ name: "delete", label: "Remove source" }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "delete") onRemove();
          }}
          onPressIn={() => {
            swiping.current = false;
          }}
          onPress={() => {
            if (!swiping.current) onEdit();
          }}
          disabled={disabled}
          style={s.sourceRow}
        >
          <Favicon
            uri={source.icon || faviconUrl(source.url)}
            title={source.title}
            size={42}
          />
          <Text style={[s.sourceTitle, { flex: 1 }]} numberOfLines={2}>
            {source.title}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
function Action({
  label,
  icon: Icon,
  onPress,
  active = false,
  disabled = false,
}: {
  label: string;
  icon: typeof Rss;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const { c, s } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        active && s.selected,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <Icon
        size={22}
        color={active ? c.accentInk : c.ink}
        strokeWidth={1.7}
        fill={active && Icon === Bookmark ? c.yellow : c.transparent}
      />
    </Pressable>
  );
}
function Button({
  title,
  onPress,
  quiet = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
}) {
  const { c, s } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        quiet && s.quiet,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.buttonText, quiet && { color: c.ink }]}>{title}</Text>
    </Pressable>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <RessApp />
    </SafeAreaProvider>
  );
}
function RessApp() {
  const [fonts, fontError] = useFonts({
    Vollkorn_600SemiBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_700Bold,
  });
  const [tab, setTab] = useState<Tab>("Feed");
  const [sources, setSources] = useState<Source[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(defaults);
  useEffect(() => {
    if (Platform.OS !== "web")
      Appearance.setColorScheme(
        settings.theme === "device" ? "auto" : settings.theme,
      );
  }, [settings.theme]);
  const deviceScheme = useColorScheme();
  const scheme = resolveTheme(settings.theme, deviceScheme);
  const dark = scheme === "dark";
  const c = colorsFor(scheme);
  const s = useMemo(() => createStyles(c, dark), [c, dark]);
  const themeValue = useMemo(() => ({ c, s, dark }), [c, s, dark]);
  useEffect(() => {
    if (Platform.OS === "web") {
      const root = document.documentElement;
      root.style.colorScheme = scheme;
      root.style.setProperty("--color-ink", c.ink);
      root.style.setProperty("--color-paper", c.paper);
      root.style.setProperty("--color-muted", c.muted);
      root.style.setProperty("--color-accent-2", c.yellowSoft);
    } else {
      void SystemUI.setBackgroundColorAsync(c.paper).catch(() => {});
    }
  }, [scheme, c]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [synced, setSynced] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selected, setSelected] = useState<Article | null>(null);
  const [sourceMenu, setSourceMenu] = useState(false);
  const [sheet, setSheet] = useState<
    "add" | "import" | "edit" | "widgetSource" | null
  >(null);
  // Modal keeps its children mounted during its exit animation.
  const lastSheet = useRef(sheet);
  if (sheet) lastSheet.current = sheet;
  const displayedSheet = sheet ?? lastSheet.current;
  const [editing, setEditing] = useState<Source | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceCategory, setSourceCategory] = useState("Feeds");
  const [url, setUrl] = useState("");
  const [sourceBusy, setSourceBusy] = useState(false);
  const pendingLink = useRef<string | null>(null);
  const refreshing = useRef(false);
  const readRef = useRef<string[]>([]);
  const savedRef = useRef<string[]>([]);
  async function sync() {
    if (refreshing.current) return;
    refreshing.current = true;
    setBusy(true);
    try {
      const result = await refreshFeeds();
      setArticles(result.articles);
      const library = await loadLibrary();
      const nextSources = library.sources.map((source) => ({
        ...source,
        icon:
          result.articles.find(
            (article) => article.sourceId === source.id && article.favicon,
          )?.favicon || source.icon,
      }));
      setSources(nextSources);
      await put(keys.sources, nextSources);
      setSynced(result.synced);
      setNotice(
        result.failures.length
          ? `Couldn't reach ${result.failures.join(", ")}. Cached reads are still here. Pull down to retry.`
          : "",
      );
      await updateWidgets().catch(() =>
        setNotice("Feeds updated. The widget will retry on its next refresh."),
      );
    } catch {
      setNotice(
        "Refresh failed. Your cached reads are safe. Pull down to retry.",
      );
    } finally {
      refreshing.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let mounted = true;
    loadLibrary()
      .then((state) => {
        if (!mounted) return;
        setSources(state.sources);
        setArticles(state.articles);
        setSaved(state.saved);
        savedRef.current = state.saved;
        setRead(state.read);
        readRef.current = state.read;
        setSettings(state.settings);
        setSynced(state.synced);
        setReady(true);
        void sync();
      })
      .catch(() => {
        setNotice("Local storage could not be opened. Restart Ress to retry.");
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => handleLink(url));
    Linking.getInitialURL().then((url) => {
      if (url) handleLink(url);
    });
    return () => sub.remove();
  }, []);
  function handleLink(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "ress:" && parsed.hostname === "article") {
        pendingLink.current = parsed.searchParams.get("id");
        void loadLibrary().then((state) => {
          const article = state.articles.find(
            (a) => a.id === pendingLink.current,
          );
          if (article) {
            pendingLink.current = null;
            openArticle(article);
          }
        });
      }
    } catch {}
  }
  useEffect(() => {
    if (pendingLink.current && ready) {
      const article = articles.find((a) => a.id === pendingLink.current);
      if (article) {
        pendingLink.current = null;
        openArticle(article);
      }
    }
  }, [articles, ready]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (
        state === "active" &&
        ready &&
        (!synced || Date.now() - Date.parse(synced) > 15 * 60_000)
      )
        void sync();
    });
    return () => sub.remove();
  }, [ready, synced]);
  async function persist<T>(key: string, value: T) {
    try {
      await put(key, value);
      return true;
    } catch {
      setNotice("Could not save this change. Please try again.");
      return false;
    }
  }
  function openArticle(article: Article) {
    setSelected(article);
    if (!readRef.current.includes(article.id)) {
      const next = [...readRef.current, article.id];
      readRef.current = next;
      setRead(next);
      void persist(keys.read, next)
        .then(() => updateWidgets())
        .catch(() => {});
    }
  }
  function toggleSave(article: Article) {
    const next = savedRef.current.includes(article.id)
      ? savedRef.current.filter((id) => id !== article.id)
      : [...savedRef.current, article.id];
    savedRef.current = next;
    setSaved(next);
    void persist(keys.saved, next);
  }
  async function changeSettings(next: Settings) {
    if (await persist(keys.settings, next)) {
      setSettings(next);
      await updateWidgets().catch(() =>
        setNotice("Settings saved. Widget will update on its next refresh."),
      );
    }
  }
  async function importOpml() {
    setSourceBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const text =
        Platform.OS === "web"
          ? await (await fetch(result.assets[0].uri)).text()
          : await new File(result.assets[0].uri).text();
      const imported = parseOpml(text);
      const next = [
        ...new Map(
          [...imported, ...sources].map((source) => [source.url, source]),
        ).values(),
      ];
      if (await persist(keys.sources, next)) {
        setSources(next);
        setSheet(null);
        setNotice(`${next.length - sources.length} new sources imported.`);
        await sync();
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not import this file.",
      );
    } finally {
      setSourceBusy(false);
    }
  }
  async function addSource() {
    const valid = safeUrl(url.trim());
    if (!valid) {
      setNotice("Enter a complete http or https feed URL.");
      return;
    }
    if (sources.some((source) => source.url === valid)) {
      setNotice("This feed is already in your sources.");
      return;
    }
    setSourceBusy(true);
    try {
      const source: Source = {
        id: valid,
        url: valid,
        title:
          sourceTitle.trim() || new URL(valid).hostname.replace(/^www\./, ""),
        category: sourceCategory.trim() || "Feeds",
      };
      const details = await fetchSourceDetails(source);
      source.title = sourceTitle.trim() || details.title;
      source.icon = details.icon;
      const next = [
        ...new Map([...sources, source].map((s) => [s.id, s])).values(),
      ];
      if (await persist(keys.sources, next)) {
        setSources(next);
        setSheet(null);
        setUrl("");
        await sync();
      }
    } catch (error) {
      setNotice(
        `Could not add feed. ${error instanceof Error ? error.message : "Try again."}`,
      );
    } finally {
      setSourceBusy(false);
    }
  }
  function removeSource(source: Source) {
    Alert.alert(
      `Remove ${source.title}?`,
      "Saved articles will stay in your library.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const next = sources.filter((s) => s.id !== source.id);
            void persist(keys.sources, next).then(async (ok) => {
              if (ok) {
                setSources(next);
                if (sourceFilter === source.id) setSourceFilter("all");
                if (settings.widgetSource === source.id)
                  await changeSettings({ ...settings, widgetSource: "all" });
                else await updateWidgets();
              }
            });
          },
        },
      ],
    );
  }
  async function saveSource() {
    if (!editing) return;
    const valid = safeUrl(url.trim());
    if (!valid || !sourceTitle.trim()) {
      setNotice("Enter a name and a valid feed URL.");
      return;
    }
    if (
      sources.some((source) => source.id !== editing.id && source.url === valid)
    ) {
      setNotice("This feed is already in your sources.");
      return;
    }
    setSourceBusy(true);
    try {
      const nextSource = {
        ...editing,
        title: sourceTitle.trim(),
        url: valid,
        category: sourceCategory.trim() || "Feeds",
      };
      if (valid !== editing.url) {
        const fetched = await fetchSource(nextSource);
        nextSource.icon = fetched[0]?.favicon || faviconUrl(valid);
      }
      if (
        await persist(
          keys.sources,
          sources.map((source) =>
            source.id === editing.id ? nextSource : source,
          ),
        )
      ) {
        setSources(
          sources.map((source) =>
            source.id === editing.id ? nextSource : source,
          ),
        );
        const nextArticles = articles.map((a) =>
          a.sourceId === editing.id
            ? {
                ...a,
                source: nextSource.title,
                favicon: nextSource.icon || a.favicon,
              }
            : a,
        );
        if (await persist(keys.articles, nextArticles))
          setArticles(nextArticles);
        setSheet(null);
        await sync();
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update source.",
      );
    } finally {
      setSourceBusy(false);
    }
  }
  function editSource(source: Source) {
    setEditing(source);
    setSourceTitle(source.title);
    setUrl(source.url);
    setSourceCategory(source.category);
    setSheet("edit");
  }
  const activeIds = new Set(sources.map((s) => s.id));
  const visible = articles.filter((a) =>
    tab === "Saved"
      ? saved.includes(a.id) &&
        `${a.title} ${a.source} ${a.summary}`
          .toLowerCase()
          .includes(query.toLowerCase())
      : activeIds.has(a.sourceId) &&
        (sourceFilter === "all" || a.sourceId === sourceFilter),
  );
  if ((!fonts && !fontError) || !ready)
    return (
      <SafeAreaView style={s.loading}>
        <StatusBar style={dark ? "light" : "dark"} />
        <Text style={s.loadingBrand}>ress</Text>
        <ActivityIndicator color={c.ink} />
        <Text style={s.body}>{notice || "Opening your edition…"}</Text>
      </SafeAreaView>
    );
  const listHeader =
    tab === "Feed" ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.sourcePicker}
      >
        {[{ id: "all", title: "All", url: "", icon: "" }, ...sources].map(
          (source) => {
            const count = articles.filter(
              (a) =>
                !read.includes(a.id) &&
                activeIds.has(a.sourceId) &&
                (source.id === "all" || a.sourceId === source.id),
            ).length;
            return (
              <Pressable
                key={source.id}
                accessibilityRole="button"
                accessibilityLabel={source.title}
                accessibilityState={{ selected: sourceFilter === source.id }}
                onPress={() => setSourceFilter(source.id)}
                style={s.sourceOption}
              >
                <View
                  style={[
                    s.sourceRing,
                    sourceFilter === source.id && s.sourceRingActive,
                  ]}
                >
                  {source.id === "all" ? (
                    <View style={s.allSource}>
                      <Rss size={24} color={c.ink} />
                    </View>
                  ) : (
                    <Favicon
                      uri={source.icon || faviconUrl(source.url)}
                      title={source.title}
                      size={48}
                    />
                  )}
                  {count > 0 ? (
                    <View style={s.unreadBadge}>
                      <Text style={s.unreadCount}>
                        {count > 99 ? "99+" : count}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={2}
                  style={[
                    s.sourceOptionText,
                    sourceFilter === source.id && s.bold,
                  ]}
                >
                  {source.title}
                </Text>
              </Pressable>
            );
          },
        )}
      </ScrollView>
    ) : (
      <View style={[s.search, { marginTop: 0, marginBottom: 12 }]}>
        <Search size={20} color={c.muted} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search saved articles"
          placeholderTextColor={c.muted}
          accessibilityLabel="Search saved articles"
        />
        {query ? (
          <Action icon={X} label="Clear search" onPress={() => setQuery("")} />
        ) : null}
      </View>
    );
  return (
    <ThemeContext.Provider value={themeValue}>
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <StatusBar style={dark ? "light" : "dark"} />
        <View style={s.shell}>
          <View style={s.masthead}>
            <Text
              style={[
                s.brand,
                { flex: 1 },
                tab !== "Feed" && { fontSize: 32, letterSpacing: -0.8 },
              ]}
            >
              {tab === "Feed" ? "ress" : tab}
            </Text>
            {tab === "Feed" ? (
              <Action
                icon={RefreshCw}
                label="Refresh feeds"
                onPress={() => void sync()}
                disabled={busy || !sources.length}
              />
            ) : null}
            {tab === "Sources" ? (
              <Action
                icon={Plus}
                label="Add source"
                onPress={() => setSourceMenu(!sourceMenu)}
                disabled={sourceBusy}
              />
            ) : null}
          </View>
          {notice ? (
            <View style={s.notice}>
              <Text accessibilityLiveRegion="polite" style={s.noticeText}>
                {notice}
              </Text>
              <Action
                icon={X}
                label="Dismiss message"
                onPress={() => setNotice("")}
              />
            </View>
          ) : null}
          {tab === "Feed" || tab === "Saved" ? (
            <FlatList
              data={visible}
              keyExtractor={(a) => a.id}
              contentContainerStyle={s.listContent}
              ListHeaderComponent={listHeader}
              refreshControl={
                <RefreshControl
                  refreshing={busy}
                  onRefresh={sync}
                  tintColor={c.ink}
                  colors={[c.ink]}
                />
              }
              renderItem={({ item, index }) => (
                <View style={[s.article, index === 0 && s.leadArticle]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Read ${item.title}`}
                    onPress={() => openArticle(item)}
                    style={({ pressed }) => [
                      s.articleTarget,
                      pressed && s.pressed,
                    ]}
                  >
                    <View style={s.articleMeta}>
                      <View style={s.sourceIdentity}>
                        <Favicon
                          uri={item.favicon || faviconUrl(item.url)}
                          title={item.source}
                          size={20}
                        />
                        <Text numberOfLines={1} style={s.sourceName}>
                          {item.source}
                        </Text>
                      </View>
                    </View>
                    <Thumbnail uri={item.image} />
                    <Text
                      style={[
                        s.articleTitle,
                        index === 0 && s.leadTitle,
                        read.includes(item.id) && s.readTitle,
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.summary ? (
                      <Text
                        numberOfLines={index === 0 ? 3 : 2}
                        style={s.summary}
                      >
                        {item.summary}
                      </Text>
                    ) : null}
                  </Pressable>
                  <View style={s.articleBottom}>
                    <Text style={s.small}>{dateLabel(item.date)}</Text>
                    <Action
                      icon={Bookmark}
                      label={
                        saved.includes(item.id)
                          ? "Unsave article"
                          : "Save article"
                      }
                      active={saved.includes(item.id)}
                      onPress={() => toggleSave(item)}
                    />
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={s.empty}>
                  {busy ? (
                    <>
                      <ActivityIndicator color={c.ink} />
                      <Text style={s.emptyTitle}>Gathering your edition.</Text>
                      <View style={s.skeleton} />
                      <View style={[s.skeleton, { width: "65%" }]} />
                    </>
                  ) : (
                    <>
                      <Rss size={32} color={c.muted} />
                      <Text style={s.emptyTitle}>
                        {(tab === "Saved" && query) ||
                        (tab === "Feed" && sourceFilter !== "all")
                          ? "No stories match."
                          : tab === "Saved"
                            ? "No saved articles yet."
                            : sources.length
                              ? "No articles yet."
                              : "Your feed starts here."}
                      </Text>
                      <Text style={s.body}>
                        {tab === "Saved"
                          ? "Tap the bookmark on any story to keep it here, even offline."
                          : sources.length
                            ? "Pull down to refresh your feeds."
                            : "Add a feed or import your OPML file."}
                      </Text>
                      {tab === "Feed" ? (
                        <Button
                          title={
                            sources.length ? "Refresh feeds" : "Add sources"
                          }
                          onPress={() =>
                            sources.length ? void sync() : setTab("Sources")
                          }
                        />
                      ) : null}
                    </>
                  )}
                </View>
              }
            />
          ) : (
            <ScrollView contentContainerStyle={s.listContent}>
              {tab === "Sources" ? (
                <>
                  {sources.map((source) => (
                    <SourceRow
                      key={source.id}
                      source={source}
                      onEdit={() => editSource(source)}
                      onRemove={() => removeSource(source)}
                      disabled={busy || sourceBusy}
                    />
                  ))}
                  {!sources.length ? (
                    <View style={s.empty}>
                      <Text style={s.emptyTitle}>No sources yet.</Text>
                      <Text style={s.body}>
                        Tap + to add a feed or import OPML.
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={s.settingsSection}>Appearance</Text>
                  <Text style={[s.settingTitle, { marginVertical: 12 }]}>
                    Theme
                  </Text>
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Theme"
                    style={s.themeChoices}
                  >
                    {(
                      [
                        { value: "device", label: "Device" },
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" },
                      ] as const
                    ).map((option) => (
                      <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityLabel={`${option.label} theme`}
                        aria-checked={settings.theme === option.value}
                        accessibilityState={{
                          checked: settings.theme === option.value,
                        }}
                        onPress={() =>
                          void changeSettings({
                            ...settings,
                            theme: option.value,
                          })
                        }
                        style={({ pressed }) => [
                          s.themeChoice,
                          settings.theme === option.value && s.selected,
                          pressed && s.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            s.themeChoiceText,
                            settings.theme === option.value && {
                              color: c.accentInk,
                              fontFamily: f.bold,
                            },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={s.settingsSection}>Reading</Text>
                  <View style={s.settingRow}>
                    <View style={s.settingCopy}>
                      <Text style={s.settingTitle}>Larger text</Text>
                      <Text style={s.small}>
                        Increase text size in the reader
                      </Text>
                    </View>
                    <Switch
                      accessibilityLabel="Larger reading text"
                      value={settings.largeType}
                      onValueChange={(largeType) =>
                        void changeSettings({ ...settings, largeType })
                      }
                      trackColor={{ false: c.rule, true: c.yellow }}
                      thumbColor={
                        dark && !settings.largeType ? c.muted : c.accentInk
                      }
                    />
                  </View>
                  <Text style={s.settingsSection}>Home screen widget</Text>
                  <Pressable
                    style={s.settingRow}
                    onPress={() => setSheet("widgetSource")}
                    accessibilityRole="button"
                  >
                    <Text style={s.settingTitle}>Source</Text>
                    <Text
                      numberOfLines={1}
                      style={[s.small, { maxWidth: "55%" }]}
                    >
                      {sources.find(
                        (source) => source.id === settings.widgetSource,
                      )?.title || "All sources"}{" "}
                      ›
                    </Text>
                  </Pressable>
                  <View style={s.settingRow}>
                    <View style={s.settingCopy}>
                      <Text style={s.settingTitle}>Only unread articles</Text>
                      <Text style={s.small}>
                        Hide articles you've already read
                      </Text>
                    </View>
                    <Switch
                      accessibilityLabel="Show only unread stories in widget"
                      value={settings.unreadWidget}
                      onValueChange={(unreadWidget) =>
                        void changeSettings({ ...settings, unreadWidget })
                      }
                      trackColor={{ false: c.rule, true: c.yellow }}
                      thumbColor={
                        dark && !settings.unreadWidget ? c.muted : c.accentInk
                      }
                    />
                  </View>
                  <Pressable
                    style={s.settingRow}
                    accessibilityRole="button"
                    onPress={() => {
                      void pinWidget()
                        .then((ok) => {
                          if (!ok)
                            Alert.alert(
                              "Add the Ress widget",
                              widgetAvailable
                                ? "Long-press your home screen, choose Widgets, then Ress."
                                : "The home screen widget is available in the Android app.",
                            );
                        })
                        .catch(() =>
                          setNotice(
                            "Open your launcher’s widget picker and choose Ress.",
                          ),
                        );
                    }}
                  >
                    <Text style={s.settingTitle}>
                      Add widget to home screen
                    </Text>
                    <Plus size={20} color={c.ink} />
                  </Pressable>
                  <Text style={s.helper}>
                    Updates about every 30 minutes and when you refresh your
                    feeds.
                  </Text>
                  <Text style={s.settingsSection}>About</Text>
                  <View style={s.settingRow}>
                    <Text style={s.settingTitle}>Ress</Text>
                    <Text style={s.small}>1.0.0</Text>
                  </View>
                </>
              )}
            </ScrollView>
          )}
          <SafeAreaView edges={["bottom"]} style={s.navSafe}>
            <View style={s.nav}>
              {tabs.map(({ name, icon: Icon }) => (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === name }}
                  onPress={() => {
                    setTab(name);
                    setQuery("");
                    setSourceMenu(false);
                  }}
                  style={({ pressed }) => [s.navItem, pressed && s.pressed]}
                >
                  <View
                    collapsable={false}
                    style={[
                      s.navIcon,
                      {
                        backgroundColor:
                          tab === name ? c.yellow : c.transparent,
                        borderRadius: 20,
                        overflow: "hidden",
                      },
                    ]}
                  >
                    <Icon
                      size={22}
                      strokeWidth={tab === name ? 2.2 : 1.6}
                      color={tab === name ? c.accentInk : c.ink}
                    />
                  </View>
                  <Text style={[s.navLabel, tab === name && s.bold]}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </View>
        <Modal
          transparent
          visible={sourceMenu}
          animationType="fade"
          onRequestClose={() => setSourceMenu(false)}
        >
          <Pressable
            style={s.menuBackdrop}
            onPress={() => setSourceMenu(false)}
            accessibilityLabel="Close source menu"
          >
            <View style={s.sourceMenu}>
              <Pressable
                style={s.menuItem}
                accessibilityRole="button"
                onPress={() => {
                  setSourceMenu(false);
                  setUrl("");
                  setSourceTitle("");
                  setSourceCategory("Feeds");
                  setSheet("add");
                }}
              >
                <Plus size={20} color={c.ink} />
                <Text style={s.settingTitle}>Add feed</Text>
              </Pressable>
              <Pressable
                style={s.menuItem}
                accessibilityRole="button"
                onPress={() => {
                  setSourceMenu(false);
                  setSheet("import");
                }}
              >
                <Download size={20} color={c.ink} />
                <Text style={s.settingTitle}>Import OPML</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
        <Modal
          transparent
          visible={!!sheet}
          animationType="slide"
          onRequestClose={() => {
            if (!sourceBusy) setSheet(null);
          }}
        >
          <KeyboardAvoidingView
            style={s.sheetOverlay}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                if (!sourceBusy) setSheet(null);
              }}
              accessibilityLabel="Close sheet"
            />
            <SafeAreaView edges={["bottom"]} style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>
                  {displayedSheet === "add"
                    ? "Add feed"
                    : displayedSheet === "edit"
                      ? "Edit source"
                      : displayedSheet === "import"
                        ? "Import OPML"
                        : "Widget source"}
                </Text>
                <Action
                  icon={X}
                  label="Close sheet"
                  disabled={sourceBusy}
                  onPress={() => setSheet(null)}
                />
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.sheetContent}
              >
                {displayedSheet === "add" || displayedSheet === "edit" ? (
                  <View style={s.addForm}>
                    <Text style={s.settingTitle}>
                      Name{displayedSheet === "add" ? " (optional)" : ""}
                    </Text>
                    <TextInput
                      accessibilityLabel="Source name"
                      style={s.urlInput}
                      value={sourceTitle}
                      onChangeText={setSourceTitle}
                      placeholder="Source name"
                      placeholderTextColor={c.muted}
                      editable={!sourceBusy}
                    />
                    <Text style={s.settingTitle}>Feed URL</Text>
                    <TextInput
                      accessibilityLabel="Feed URL"
                      style={s.urlInput}
                      value={url}
                      onChangeText={setUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      placeholder="https://example.com/feed.xml"
                      placeholderTextColor={c.muted}
                      editable={!sourceBusy}
                    />
                    {notice ? (
                      <Text accessibilityLiveRegion="polite" style={s.small}>
                        {notice}
                      </Text>
                    ) : null}
                    <Button
                      title={
                        sourceBusy
                          ? "Checking feed…"
                          : displayedSheet === "edit"
                            ? "Save changes"
                            : "Add feed"
                      }
                      onPress={() =>
                        void (displayedSheet === "edit"
                          ? saveSource()
                          : addSource())
                      }
                      disabled={sourceBusy}
                    />
                  </View>
                ) : displayedSheet === "import" ? (
                  <View style={s.addForm}>
                    <Text style={s.body}>
                      Choose an OPML file to import your subscriptions.
                    </Text>
                    <Button
                      title={sourceBusy ? "Importing…" : "Choose OPML file"}
                      onPress={() => void importOpml()}
                      disabled={sourceBusy}
                    />
                    {notice ? <Text style={s.small}>{notice}</Text> : null}
                  </View>
                ) : displayedSheet === "widgetSource" ? (
                  [{ id: "all", title: "All sources" }, ...sources].map(
                    (source) => (
                      <Pressable
                        key={source.id}
                        style={s.settingRow}
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: settings.widgetSource === source.id,
                        }}
                        onPress={() => {
                          void changeSettings({
                            ...settings,
                            widgetSource: source.id,
                          });
                          setSheet(null);
                        }}
                      >
                        <Text style={[s.settingTitle, { flex: 1 }]}>
                          {source.title}
                        </Text>
                        <Text style={s.body}>
                          {settings.widgetSource === source.id ? "✓" : ""}
                        </Text>
                      </Pressable>
                    ),
                  )
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
        <Modal
          visible={!!selected}
          animationType="none"
          onRequestClose={() => setSelected(null)}
        >
          {selected ? (
            <SafeAreaView style={s.safe}>
              <View style={s.reader}>
                <View style={s.readerBar}>
                  <Action
                    icon={ChevronLeft}
                    label="Back to stories"
                    onPress={() => setSelected(null)}
                  />
                  <Text style={s.small}>The reading room</Text>
                  <View style={s.actionRow}>
                    <Action
                      icon={Share2}
                      label="Share article"
                      onPress={() =>
                        void Share.share({
                          message: `${selected.title}\n${selected.url}`,
                        }).catch(() =>
                          setNotice("Could not share this article."),
                        )
                      }
                    />
                    <Action
                      icon={Bookmark}
                      label={
                        saved.includes(selected.id)
                          ? "Unsave article"
                          : "Save article"
                      }
                      active={saved.includes(selected.id)}
                      onPress={() => toggleSave(selected)}
                    />
                  </View>
                </View>
                <ScrollView contentContainerStyle={s.readerContent}>
                  <View style={s.sourceIdentity}>
                    <Favicon
                      uri={selected.favicon || faviconUrl(selected.url)}
                      title={selected.source}
                      size={24}
                    />
                    <Text style={s.sourceName}>{selected.source}</Text>
                  </View>
                  <Text selectable style={s.readerTitle}>
                    {selected.title}
                  </Text>
                  <Text style={s.small}>{dateLabel(selected.date)}</Text>
                  <Thumbnail uri={selected.image} />
                  <View style={s.readerRule} />
                  <Text
                    selectable
                    style={[
                      s.readingText,
                      settings.largeType && s.readingLarge,
                    ]}
                  >
                    {selected.content ||
                      selected.summary ||
                      "This feed contains a headline only. Open the original to read the full story."}
                  </Text>
                  <View style={s.original}>
                    <Text style={s.helper}>
                      Full formatting is available on the original site.
                    </Text>
                    <Button
                      title="Read original"
                      onPress={() =>
                        void Browser.openBrowserAsync(selected.url).catch(() =>
                          Alert.alert(
                            "Could not open article",
                            "Please try again.",
                          ),
                        )
                      }
                    />
                  </View>
                </ScrollView>
              </View>
            </SafeAreaView>
          ) : null}
        </Modal>
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}
function createStyles(c: Palette, dark: boolean) {
  return StyleSheet.create({
    themeChoices: {
      flexDirection: "row",
      backgroundColor: c.surface,
      padding: 4,
      borderRadius: 20,
      gap: 4,
      marginBottom: 8,
    },
    themeChoice: {
      flex: 1,
      minHeight: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    themeChoiceText: { fontFamily: f.medium, color: c.ink, fontSize: 15 },
    favicon: {
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
    },
    sourceInitial: { fontFamily: f.bold, color: c.ink },
    thumbnail: {
      width: "100%",
      aspectRatio: 1.8,
      borderRadius: 12,
      marginVertical: 12,
      borderWidth: 1,
      borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    },
    sourceIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    sourcePicker: { gap: 14, paddingVertical: 8, paddingBottom: 22 },
    sourceOption: { width: 68, alignItems: "center", gap: 7 },
    sourceRing: {
      padding: 3,
      borderWidth: 2,
      borderColor: c.rule,
      borderRadius: 32,
    },
    sourceRingActive: { borderColor: c.ink, backgroundColor: c.yellow },
    allSource: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surface,
    },
    sourceOptionText: {
      fontFamily: f.body,
      color: c.ink,
      fontSize: 11,
      lineHeight: 14,
      textAlign: "center",
    },
    unreadBadge: {
      position: "absolute",
      top: -3,
      right: -5,
      backgroundColor: c.yellow,
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadCount: {
      fontFamily: f.bold,
      color: c.accentInk,
      fontSize: 10,
      fontVariant: ["tabular-nums"],
    },
    swipeRow: {
      overflow: "hidden",
      borderBottomWidth: 1,
      borderBottomColor: c.rule,
    },
    deleteSource: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 76,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.error,
    },
    settingsSection: {
      fontFamily: f.bold,
      fontSize: 13,
      color: c.muted,
      marginTop: 24,
      paddingBottom: 8,
    },
    menuBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.15)",
      alignItems: "flex-end",
      paddingTop: 92,
      paddingRight: 20,
    },
    sourceMenu: {
      backgroundColor: c.paper,
      borderRadius: 18,
      padding: 8,
      elevation: 8,
      boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      minWidth: 180,
      minHeight: 52,
    },
    sheetOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    sheet: {
      backgroundColor: c.paper,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: "85%",
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.rule,
      alignSelf: "center",
      marginTop: 10,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: 12,
    },
    sheetTitle: { fontFamily: f.display, color: c.ink, fontSize: 28 },
    sheetContent: { paddingHorizontal: 24, paddingBottom: 24 },
    safe: { flex: 1, backgroundColor: c.paper },
    shell: { flex: 1, width: "100%", maxWidth: 720, alignSelf: "center" },
    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 24,
      backgroundColor: c.paper,
    },
    loadingBrand: { fontSize: 64, color: c.ink },
    masthead: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: c.rule,
      gap: 10,
    },
    brand: {
      fontFamily: f.display,
      fontSize: 43,
      lineHeight: 52,
      color: c.ink,
      letterSpacing: -2,
    },
    iconButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 24,
    },
    pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
    disabled: { opacity: 0.4 },
    selected: { backgroundColor: c.yellow },
    bold: { fontFamily: f.bold },
    listContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
    body: { fontFamily: f.body, color: c.ink, fontSize: 16, lineHeight: 24 },
    small: { fontFamily: f.body, color: c.muted, fontSize: 12, lineHeight: 18 },
    search: {
      marginTop: 24,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 13,
      fontFamily: f.body,
      color: c.ink,
      fontSize: 15,
    },
    article: {
      borderBottomWidth: 1,
      borderBottomColor: c.rule,
      paddingTop: 22,
      paddingBottom: 10,
    },
    leadArticle: { paddingTop: 18 },
    articleTarget: { borderRadius: 4 },
    articleMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
      marginBottom: 10,
    },
    sourceName: {
      fontFamily: f.bold,
      fontSize: 12,
      color: c.ink,
      flexShrink: 1,
    },
    articleTitle: {
      fontFamily: f.display,
      fontSize: 24,
      lineHeight: 30,
      color: c.ink,
      letterSpacing: -0.4,
    },
    leadTitle: { fontSize: 30, lineHeight: 36, letterSpacing: -0.7 },
    readTitle: { color: c.muted },
    summary: {
      fontFamily: f.body,
      fontSize: 15,
      color: c.muted,
      lineHeight: 23,
      marginTop: 10,
    },
    articleBottom: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
    },
    navSafe: {
      borderTopWidth: 1,
      borderTopColor: c.rule,
      backgroundColor: c.paper,
    },
    nav: { flexDirection: "row", paddingTop: 8, paddingBottom: 4 },
    navItem: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 4 },
    navIcon: {
      width: 56,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 20,
    },
    navLabel: { fontFamily: f.body, color: c.ink, fontSize: 12 },
    notice: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.yellowSoft,
      paddingLeft: 20,
      paddingRight: 8,
      paddingVertical: 8,
    },
    noticeText: {
      flex: 1,
      fontFamily: f.body,
      fontSize: 13,
      lineHeight: 18,
      color: c.ink,
    },
    empty: { paddingVertical: 42, alignItems: "flex-start", gap: 18 },
    emptyTitle: {
      fontFamily: f.display,
      fontSize: 28,
      lineHeight: 34,
      color: c.ink,
    },
    skeleton: {
      height: 20,
      backgroundColor: c.surface,
      borderRadius: 4,
      width: "100%",
    },
    button: {
      backgroundColor: c.yellow,
      minHeight: 50,
      paddingHorizontal: 24,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 28,
    },
    quiet: { backgroundColor: c.surface },
    buttonText: { fontFamily: f.bold, color: c.accentInk, fontSize: 15 },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      marginBottom: 0,
    },
    addForm: { gap: 12, paddingVertical: 24 },
    urlInput: {
      backgroundColor: c.surface,
      padding: 16,
      borderRadius: 8,
      color: c.ink,
      fontFamily: f.body,
      fontSize: 16,
    },
    sourceRow: {
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
      paddingVertical: 20,
      paddingHorizontal: 2,
      backgroundColor: c.paper,
    },
    sourceTitle: {
      fontFamily: f.display,
      color: c.ink,
      fontSize: 21,
      lineHeight: 27,
    },
    helper: {
      fontFamily: f.body,
      fontSize: 13,
      lineHeight: 20,
      color: c.muted,
      marginTop: 14,
      marginBottom: 24,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 18,
      borderBottomColor: c.rule,
      borderBottomWidth: 1,
    },
    settingCopy: { flex: 1, gap: 4 },
    settingTitle: { fontFamily: f.medium, color: c.ink, fontSize: 16 },
    reader: { flex: 1, width: "100%", maxWidth: 720, alignSelf: "center" },
    readerBar: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomColor: c.rule,
      borderBottomWidth: 1,
    },
    readerContent: { padding: 28 },
    readerTitle: {
      fontFamily: f.display,
      color: c.ink,
      fontSize: 36,
      lineHeight: 43,
      letterSpacing: -0.8,
      marginVertical: 18,
    },
    readerRule: { height: 1, backgroundColor: c.rule, marginVertical: 28 },
    readingText: {
      fontFamily: f.body,
      color: c.ink,
      fontSize: 18,
      lineHeight: 30,
    },
    readingLarge: { fontSize: 22, lineHeight: 36 },
    original: { marginTop: 32, borderTopColor: c.rule, borderTopWidth: 1 },
  });
}
