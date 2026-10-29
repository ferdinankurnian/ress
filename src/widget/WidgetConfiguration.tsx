import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk/400Regular";
import { HankenGrotesk_700Bold } from "@expo-google-fonts/hanken-grotesk/700Bold";
import { Vollkorn_600SemiBold } from "@expo-google-fonts/vollkorn/600SemiBold";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import type { Source } from "../data/feeds";
import { faviconUrl } from "../data/feeds";
import {
  loadLibrary,
  loadWidgetSettings,
  saveWidgetSettings,
  widgetDefaults,
  type WidgetSettings,
} from "../data/store";
import {
  colorsFor,
  resolveTheme,
  theme,
  type ThemePreference,
  type BackgroundPreference,
} from "../ui/theme";
import { renderWidgetSnapshot } from "./bridge.android";

export default function WidgetConfiguration(
  props: WidgetConfigurationScreenProps,
) {
  return (
    <SafeAreaProvider>
      <Configuration {...props} />
    </SafeAreaProvider>
  );
}
function Configuration({
  widgetInfo,
  renderWidget,
  setResult,
}: WidgetConfigurationScreenProps) {
  const [fonts, fontError] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_700Bold,
    Vollkorn_600SemiBold,
  });
  const [sources, setSources] = useState<Source[]>([]);
  const [preferences, setPreferences] =
    useState<WidgetSettings>(widgetDefaults);
  const [themeChoice, setThemeChoice] = useState<ThemePreference>("device");
  const [background, setBackground] = useState<BackgroundPreference>("warm");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scheme = resolveTheme(themeChoice, useColorScheme());
  const c = colorsFor(scheme, background);
  const s = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: c.paper },
        header: {
          flexDirection: "row",
          paddingHorizontal: 16,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "space-between",
        },
        heading: { fontFamily: theme.font.display, color: c.ink, fontSize: 30 },
        body: {
          fontFamily: theme.font.body,
          fontSize: 15,
          lineHeight: 22,
          color: c.muted,
        },
        text: { fontFamily: theme.font.body, fontSize: 16, color: c.ink },
        section: {
          fontFamily: theme.font.bold,
          fontSize: 13,
          color: c.muted,
          marginTop: 20,
          marginBottom: 8,
        },
        content: { padding: 16, paddingTop: 0 },
        row: {
          flexDirection: "row",
          gap: 12,
          alignItems: "center",
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: c.rule,
          minHeight: 56,
        },
        icon: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: c.surface,
        },
        radio: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: c.muted,
          alignItems: "center",
          justifyContent: "center",
        },
        dot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: c.yellow,
        },
        actions: { flexDirection: "row", gap: 12, padding: 16 },
        button: {
          flex: 1,
          padding: 16,
          minHeight: 50,
          borderRadius: 28,
          backgroundColor: c.yellow,
          alignItems: "center",
          justifyContent: "center",
        },
        buttonText: {
          fontFamily: theme.font.bold,
          fontSize: 15,
          color: c.accentInk,
        },
      }),
    [c],
  );
  useEffect(() => {
    let mounted = true;
    void Promise.all([loadLibrary(), loadWidgetSettings(widgetInfo.widgetId)])
      .then(([library, saved]) => {
        if (!mounted) return;
        setSources(library.sources);
        setThemeChoice(library.settings.theme);
        setBackground(library.settings.background);
        setPreferences({
          ...saved,
          sourceId: library.sources.some(
            (source) => source.id === saved.sourceId,
          )
            ? saved.sourceId
            : "all",
        });
        setReady(true);
      })
      .catch(() => {
        if (mounted)
          setError("Could not load widget settings. Close and try again.");
      });
    return () => {
      mounted = false;
    };
  }, [widgetInfo.widgetId]);
  async function save() {
    setSaving(true);
    setError("");
    try {
      await saveWidgetSettings(widgetInfo.widgetId, preferences);
      // Show cached text immediately, then enrich the same instance with images.
      renderWidget(
        await renderWidgetSnapshot(
          widgetInfo.widgetId,
          widgetInfo.height,
          false,
          false,
          widgetInfo.width,
        ),
      );
      renderWidget(
        await renderWidgetSnapshot(
          widgetInfo.widgetId,
          widgetInfo.height,
          false,
          true,
          widgetInfo.width,
        ),
      );
      setResult("ok");
    } catch {
      setError("Could not save these settings. Please try again.");
      setSaving(false);
    }
  }
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={s.header}>
        <Text style={s.heading}>Select source</Text>
      </View>
      {!ready || (!fonts && !fontError) ? (
        <View style={s.content}>
          {error ? (
            <Text style={s.body}>{error}</Text>
          ) : (
            <ActivityIndicator color={c.ink} />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Widget source"
          >
            {[
              {
                id: "all",
                title: "All sources",
                url: "",
                icon: "",
                customIcon: "",
              },
              ...sources,
            ].map((source) => (
              <Pressable
                key={source.id}
                disabled={saving}
                accessibilityRole="radio"
                accessibilityLabel={source.title}
                aria-checked={preferences.sourceId === source.id}
                accessibilityState={{
                  checked: preferences.sourceId === source.id,
                }}
                onPress={() =>
                  setPreferences({ ...preferences, sourceId: source.id })
                }
                style={s.row}
              >
                {source.id !== "all" ? (
                  <Image
                    source={{
                      uri:
                        source.customIcon ||
                        source.icon ||
                        faviconUrl(source.url),
                    }}
                    style={s.icon}
                  />
                ) : null}
                <Text style={[s.text, { flex: 1 }]}>{source.title}</Text>
                <View style={s.radio}>
                  {preferences.sourceId === source.id ? (
                    <View style={s.dot} />
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
          {error ? (
            <Text style={[s.body, { marginTop: 16 }]}>{error}</Text>
          ) : null}
        </ScrollView>
      )}
      <View style={{ paddingHorizontal: 16, marginTop: "auto" }}>
        {" "}
        <View style={s.row}>
          <Text style={[s.text, { flex: 1 }]}>Only unread articles</Text>
          <Switch
            accessibilityLabel="Only unread articles in this widget"
            disabled={saving}
            value={preferences.unreadOnly}
            onValueChange={(unreadOnly) =>
              setPreferences({ ...preferences, unreadOnly })
            }
            trackColor={{ false: c.rule, true: c.yellow }}
            thumbColor={
              scheme === "dark" && !preferences.unreadOnly
                ? c.muted
                : c.accentInk
            }
          />
        </View>
      </View>
      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={() => setResult("cancel")}
          style={[s.button, { backgroundColor: c.surface }]}
        >
          <Text style={[s.buttonText, { color: c.ink }]}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!ready || saving}
          onPress={() => void save()}
          style={[s.button, (!ready || saving) && { opacity: 0.5 }]}
        >
          <Text style={s.buttonText}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
