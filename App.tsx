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
  Easing,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  AppState,
  BackHandler,
  FlatList,
  Linking,
  NativeModules,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SystemUI from "expo-system-ui";
import * as SplashScreen from "expo-splash-screen";
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
import Equal from "lucide-react-native/icons/equal";
import ArrowDownUp from "lucide-react-native/icons/arrow-down-up";
import { moveItem } from "./src/ui/reorder";
import Plus from "lucide-react-native/icons/plus";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Rss from "lucide-react-native/icons/rss";
import Search from "lucide-react-native/icons/search";
import Share2 from "lucide-react-native/icons/share-2";
import Ellipsis from "lucide-react-native/icons/ellipsis";
import Copy from "lucide-react-native/icons/copy";
import ExternalLink from "lucide-react-native/icons/external-link";
import SlidersHorizontal from "lucide-react-native/icons/sliders-horizontal";
import X from "lucide-react-native/icons/x";
import Trash2 from "lucide-react-native/icons/trash";
import Smartphone from "lucide-react-native/icons/smartphone";
import Sun from "lucide-react-native/icons/sun";
import Moon from "lucide-react-native/icons/moon";
import Type from "lucide-react-native/icons/type";
import { ConfirmDialog } from "./src/ui/ConfirmDialog";
import Info from "lucide-react-native/icons/info";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Github from "./src/ui/GithubIcon";

import { licenseText } from "./src/data/license";
import { Scene, MotionModal, PopIn } from "./src/ui/Motion";
import * as ImagePicker from "expo-image-picker";
import Globe from "lucide-react-native/icons/globe";
import FileText from "lucide-react-native/icons/file-text";
import Upload from "lucide-react-native/icons/upload";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Browser from "expo-web-browser";
import * as Clipboard from "expo-clipboard";
import {
  Article,
  Source,
  faviconUrl,
  googleFaviconUrl,
  isGitHubRelease,
  relativeTime,
  parseOpml,
  exportOpml,
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
type SettingsPage = "main" | "Import & Export" | "Text size" | "Widget" | "About" | "License";
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
function Thumbnail({
  uri,
  compact = false,
}: {
  uri?: string;
  compact?: boolean;
}) {
  const { s } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) return null;
  return (
    <View style={[s.thumbnail, compact && s.releaseAvatar, compact && { alignSelf: "flex-start" }]}>
      <Image
        source={{ uri }}
        accessibilityLabel={compact ? "Release author avatar" : "Article image"}
        onError={() => setFailed(true)}
        resizeMode="cover"
        style={{ width: "100%", height: "100%", borderRadius: 10 }}
      />
    </View>
  );
}
const REORDER_HEIGHT = 72;
function ReorderSources({ items, onChange, disabled, onDragging }: {
  items: Source[];
  onChange: (items: Source[]) => void;
  disabled: boolean;
  onDragging: (dragging: boolean) => void;
}) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const viewport = useRef<React.ComponentRef<typeof View>>(null);
  const latest = useRef(items);
  latest.current = items;
  const callbacks = useRef({ onChange, onDragging, disabled });
  callbacks.current = { onChange, onDragging, disabled };
  const [active, setActive] = useState<string | null>(null);
  const y = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const bounds = useRef({ top: 0, height: 0 });
  const drag = useRef<{ id: string; start: number; scroll: number; dy: number; finger: number } | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  function update() {
    const current = drag.current;
    if (!current) return;
    const position = Math.max(0, Math.min((latest.current.length - 1) * REORDER_HEIGHT,
      current.start + current.dy + offset.current - current.scroll));
    y.setValue(position);
    const from = latest.current.findIndex(item => item.id === current.id);
    const next = moveItem(latest.current, from, Math.round(position / REORDER_HEIGHT));
    if (next !== latest.current) {
      latest.current = next;
      callbacks.current.onChange(next);
    }
  }
  function finish() {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    drag.current = null;
    setActive(null);
    callbacks.current.onDragging(false);
  }
  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current);
  }, []);
  function start(id: string, finger: number) {
    if (callbacks.current.disabled) return;
    const index = latest.current.findIndex(item => item.id === id);
    drag.current = { id, start: index * REORDER_HEIGHT, scroll: offset.current, dy: 0, finger };
    y.setValue(index * REORDER_HEIGHT);
    setActive(id);
    callbacks.current.onDragging(true);
    viewport.current?.measureInWindow((_x, top, _width, height) => {
      bounds.current = { top, height };
    });
    tick.current = setInterval(() => {
      const current = drag.current;
      const { top, height } = bounds.current;
      if (!current || !height) return;
      const direction = current.finger < top + 56 ? -1 : current.finger > top + height - 56 ? 1 : 0;
      if (!direction) return;
      const next = Math.max(0, Math.min(Math.max(0, latest.current.length * REORDER_HEIGHT - height), offset.current + direction * 8));
      if (next === offset.current) return;
      offset.current = next;
      scroll.current?.scrollTo({ y: next, animated: false });
      update();
    }, 16);
  }
  return (
    <View ref={viewport} style={{ flex: 1 }}>
      <ScrollView ref={scroll} scrollEnabled={!active} scrollEventThrottle={16}
        onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }}>
        <View style={{ height: items.length * REORDER_HEIGHT }}>
          {items.map((source, index) => (
            <ReorderSource key={source.id} source={source} index={index} count={items.length}
              active={active === source.id} y={y} disabled={disabled}
              start={finger => start(source.id, finger)}
              move={(dy, finger) => { if (drag.current) { drag.current.dy = dy; drag.current.finger = finger; update(); } }}
              finish={finish}
              shift={direction => onChange(moveItem(items, index, index + direction))} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
function ReorderSource({ source, index, count, active, y, disabled, start, move, finish, shift }: {
  source: Source; index: number; count: number; active: boolean; y: Animated.Value; disabled: boolean;
  start: (finger: number) => void; move: (dy: number, finger: number) => void;
  finish: () => void; shift: (direction: number) => void;
}) {
  const { c, s } = useTheme();
  const latest = useRef({ start, move, finish, disabled });
  latest.current = { start, move, finish, disabled };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onPanResponderGrant: event => latest.current.start(event.nativeEvent.pageY),
    onPanResponderMove: (_event, gesture) => latest.current.move(gesture.dy, gesture.moveY),
    onPanResponderRelease: () => latest.current.finish(),
    onPanResponderTerminate: () => latest.current.finish(),
    onPanResponderTerminationRequest: () => false,
  })).current;
  return (
    <Animated.View style={[s.sourceRow, {
      position: "absolute", left: 0, right: 0, top: 0, height: REORDER_HEIGHT,
      paddingVertical: 0, paddingRight: 4, borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.rule, backgroundColor: active ? c.surface : c.paper,
      zIndex: active ? 1 : 0, elevation: active ? 4 : 0,
      transform: [{ translateY: active ? y : index * REORDER_HEIGHT }],
    }]}>
      <Favicon uri={source.customIcon || source.icon || googleFaviconUrl(source.url)} title={source.title} size={32} />
      <Text style={[s.sourceTitle, { flex: 1 }]} numberOfLines={1}>{source.title}</Text>
      <View {...pan.panHandlers} accessible accessibilityRole="adjustable"
        accessibilityLabel={`Reorder ${source.title}`} accessibilityHint="Swipe up or down to move this source"
        accessibilityValue={{ min: 1, max: count, now: index + 1 }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: "increment", label: "Move down" }, { name: "decrement", label: "Move up" }]}
        onAccessibilityAction={event => { if (!disabled) shift(event.nativeEvent.actionName === "increment" ? 1 : -1); }}
        style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
        <Equal size={24} color={active ? c.ink : c.muted} strokeWidth={1.7} />
      </View>
    </Animated.View>
  );
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
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const fadeContent = (pressed: boolean) => {
    Animated.timing(contentOpacity, {
      toValue: pressed ? 0.55 : 1,
      duration: pressed ? 120 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
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
      <Animated.View
        style={[s.deleteSource, { opacity: offset.interpolate({ inputRange: [-76, 0], outputRange: [1, 0], extrapolate: "clamp" }) }]}
      >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${source.title}`}
        disabled={disabled}
        onPress={onRemove}
        style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "center" }}
      >
        <Trash2 color={c.white} size={22} />
      </Pressable>
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={{ backgroundColor: c.paper, transform: [{ translateX: offset }] }}
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
            fadeContent(true);
          }}
          onPressOut={() => fadeContent(false)}
          onPress={() => {
            if (!swiping.current) onEdit();
          }}
          disabled={disabled}
          style={s.sourceRow}
        >
          <Animated.View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              opacity: contentOpacity,
            }}
          >
            <Favicon
              uri={
                source.customIcon || source.icon || googleFaviconUrl(source.url)
              }
              title={source.title}
              size={32}
            />
            <Text style={[s.sourceTitle, { flex: 1 }]} numberOfLines={2}>
              {source.title}
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ArticlePressable({
  children,
  label,
  onPress,
  onLongPress,
  selected,
  source = false,
}: {
  children: React.ReactNode;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  source?: boolean;
}) {
  const { s } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const animatePress = (pressed: boolean) => {
    Animated.timing(progress, {
      toValue: pressed ? 1 : 0,
      duration: pressed ? 120 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={() => animatePress(true)}
      onPressOut={() => animatePress(false)}
      style={[
        source ? s.sourceOption : s.articleTarget,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.94],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.985],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

function SettingsRow({
  children,
  style,
  ...props
}: React.ComponentProps<typeof Pressable>) {
  const { s } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const fade = (pressed: boolean) => {
    Animated.timing(opacity, {
      toValue: pressed ? 0.55 : 1,
      duration: pressed ? 120 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  return (
    <Pressable
      {...props}
      style={(state) => [s.settingRow, typeof style === "function" ? style(state) : style]}
      onPressIn={() => fade(true)}
      onPressOut={() => fade(false)}
    >
      <Animated.View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity,
        }}
      >
        {typeof children === "function"
          ? children({ pressed: false })
          : children}
      </Animated.View>
    </Pressable>
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
      onPress={(event) => { event.stopPropagation(); onPress(); }}
      style={({ pressed }) => [
        s.iconButton,
        active && Icon !== Bookmark && s.selected,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <Icon
        size={22}
        color={
          active
            ? Icon === Bookmark
              ? c.yellow
              : c.accentInk
            : Icon === Bookmark
              ? c.muted
              : c.ink
        }
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
  compact = false,
}: {
  title: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
  compact?: boolean;
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
        compact && s.compactButton,
        quiet && s.quiet,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.buttonText, quiet && { color: c.ink }]}>{title}</Text>
    </Pressable>
  );
}
void SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("main");
  const [scrolled, setScrolled] = useState(false);
  const [removing, setRemoving] = useState<Source | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  useEffect(() => {
    setScrolled(false);
  }, [tab, settingsPage]);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tab === "Settings" && settingsPage !== "main") {
        setSettingsPage(settingsPage === "License" ? "About" : "main");
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [tab, settingsPage]);

  const [sources, setSources] = useState<Source[]>([]);
  const feedListRef = useRef<FlatList<Article>>(null);
  const sourcesScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [sourceOrder, setSourceOrder] = useState<Source[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draggingSource, setDraggingSource] = useState(false);
  useEffect(() => {
    if (!sourceOrder) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!savingOrder && !draggingSource) setSourceOrder(null);
      return true;
    });
    return () => back.remove();
  }, [sourceOrder, savingOrder, draggingSource]);
  async function saveSourceOrder() {
    if (!sourceOrder || savingOrder || draggingSource || sourceOrder.every((source, index) => source.id === sources[index]?.id)) return;
    setSavingOrder(true);
    try {
      if (await persist(keys.sources, sourceOrder)) {
        setSources(sourceOrder);
        setSourceOrder(null);
      }
    } finally { setSavingOrder(false); }
  }
  const [articles, setArticles] = useState<Article[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(defaults);
  const settingsRef = useRef(settings);
  const settingsWrites = useRef<Promise<void>>(Promise.resolve());
  const widgetThemeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (widgetThemeTimer.current !== null) clearTimeout(widgetThemeTimer.current);
  }, []);
  // Keep the device scheme independent of the in-app preference. Changing
  // Android’s native night mode can recreate the Activity during animations.
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
  useEffect(() => {
    if ((fonts || fontError) && ready) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fonts, fontError, ready]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [synced, setSynced] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selected, setSelected] = useState<Article | null>(null);
  const [readerMenu, setReaderMenu] = useState(false);
  const [readerBarHeight, setReaderBarHeight] = useState(60);
  useEffect(() => {
    if (!selected) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (readerMenu) setReaderMenu(false);
      else setSelected(null);
      return true;
    });
    return () => back.remove();
  }, [selected, readerMenu]);
  const [sourceMenu, setSourceMenu] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; action?: () => void } | null>(null);
  const [sheet, setSheet] = useState<"add" | "import" | "edit" | null>(null);
  // Modal keeps its children mounted during its exit animation.
  const lastSheet = useRef(sheet);
  if (sheet) lastSheet.current = sheet;
  const displayedSheet = sheet ?? lastSheet.current;
  const [editing, setEditing] = useState<Source | null>(null);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceCategory, setSourceCategory] = useState("Feeds");
  const [url, setUrl] = useState("");
  const [customIcon, setCustomIcon] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [feedTitlePreview, setFeedTitlePreview] = useState("");
  useEffect(() => {
    setFeedTitlePreview("");
    if (sheet !== "add") return;
    const valid = safeUrl(url.trim());
    if (!valid) return;
    let active = true;
    const timer = setTimeout(() => {
      void fetchSourceDetails({ id: valid, url: valid, title: "", category: "Feeds" })
        .then((details) => { if (active) setFeedTitlePreview(details.title); })
        .catch(() => {});
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [url, sheet]);
  const [iconBusy, setIconBusy] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPreviewUrl(googleFaviconUrl(url)), 250);
    return () => clearTimeout(timer);
  }, [url]);
  async function uploadIcon() {
    setIconBusy(true);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const size = await new Promise<{ width: number; height: number }>(
        (resolve, reject) =>
          Image.getSize(
            asset.uri,
            (width, height) => resolve({ width, height }),
            reject,
          ),
      );
      const edge = Math.min(size.width, size.height);
      const image = await ImageManipulator.manipulate(asset.uri)
        .crop({
          originX: (size.width - edge) / 2,
          originY: (size.height - edge) / 2,
          width: edge,
          height: edge,
        })
        .resize({ width: 128, height: 128 })
        .renderAsync();
      const result = await image.saveAsync({
        format: SaveFormat.PNG,
        base64: true,
      });
      if (result.base64)
        setCustomIcon(`data:image/png;base64,${result.base64}`);
    } catch {
      setNotice("Could not open this image. Choose a PNG, JPEG, or WebP file.");
    } finally {
      setIconBusy(false);
    }
  }

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
        settingsRef.current = state.settings;
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
    setReaderMenu(false);
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
  function changeSettings(patch: Partial<Settings>) {
    if (Object.entries(patch).every(([key, value]) => settingsRef.current[key as keyof Settings] === value))
      return settingsWrites.current;
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    // Apply immediately; storage and widget work must never gate a tap.
    setSettings(next);
    settingsWrites.current = settingsWrites.current.then(async () => {
      // Skip snapshots superseded by a newer tap while storage was busy.
      if (settingsRef.current !== next) return;
      await persist(keys.settings, next);
    });
    if (patch.theme !== undefined) {
      if (widgetThemeTimer.current !== null) clearTimeout(widgetThemeTimer.current);
      widgetThemeTimer.current = setTimeout(() => {
        widgetThemeTimer.current = null;
        void settingsWrites.current.then(() => updateWidgets()).catch(() =>
          setNotice("Settings saved. Widget will update on its next refresh."),
        );
      }, 400);
    }
    return settingsWrites.current;
  }
  async function saveOpml() {
    setSourceBusy(true);
    try {
      const content = exportOpml(sources);
      const filename = `ress-${new Date().toISOString().slice(0, 10)}.opml`;
      if (Platform.OS === "web") {
        const uri = URL.createObjectURL(new Blob([content], { type: "text/x-opml" }));
        const link = document.createElement("a");
        link.href = uri;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(uri), 1000);
      } else if (Platform.OS === "android") {
        if (!NativeModules.RessDownloads) {
          throw new Error("Rebuild Ress to enable saving exports to Download.");
        }
        await NativeModules.RessDownloads.save(filename, content);
      } else {
        await Share.share({ message: content, title: filename });
        return;
      }
      setNotice(Platform.OS === "android" ? "OPML saved to Download." : "OPML exported.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not export sources.");
    } finally {
      setSourceBusy(false);
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
        customIcon: customIcon || undefined,
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
    setRemoving(source);
  }
  async function confirmRemoveSource() {
    if (!removing) return;
    setRemovingBusy(true);
    try {
      const next = sources.filter((source) => source.id !== removing.id);
      if (await persist(keys.sources, next)) {
        setSources(next);
        if (sourceFilter === removing.id) setSourceFilter("all");
        setRemoving(null);
        await updateWidgets();
      }
    } catch {
      setNotice("Could not remove this source. Please try again.");
    } finally {
      setRemovingBusy(false);
    }
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
        customIcon: customIcon || undefined,
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
    setCustomIcon(source.customIcon || "");
    setPreviewUrl(source.icon || googleFaviconUrl(source.url));
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
  if ((!fonts && !fontError) || !ready) return null;
  const listHeader =
    tab === "Feed" ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.sourcePicker}
      >
        {[
          { id: "all", title: "All", url: "", icon: "", customIcon: "" },
          ...sources,
        ].map((source) => {
          const count = articles.filter(
            (a) =>
              !read.includes(a.id) &&
              activeIds.has(a.sourceId) &&
              (source.id === "all" || a.sourceId === source.id),
          ).length;
          return (
            <View key={source.id} style={s.sourceOptionGroup}>
              <ArticlePressable
                source
                label={source.title}
                selected={sourceFilter === source.id}
                onPress={() => setSourceFilter(source.id)}
                onLongPress={() =>
                  setConfirmation({ title: source.title, message: "Mark all stories as read?", action: () => {
                        const ids = articles
                          .filter((article) =>
                            source.id === "all"
                              ? activeIds.has(article.sourceId)
                              : article.sourceId === source.id,
                          )
                          .map((article) => article.id);
                        const next = [...new Set([...readRef.current, ...ids])];
                        readRef.current = next;
                        setRead(next);
                        void persist(keys.read, next).then(() =>
                          updateWidgets(),
                        );
                  } })
                }
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
                      uri={
                        source.customIcon ||
                        source.icon ||
                        googleFaviconUrl(source.url)
                      }
                      title={source.title}
                      size={40}
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
              </ArticlePressable>
              {source.id === "all" && sources.length ? (
                <View style={s.sourceDivider} />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    ) : (
      <View
        style={[
          s.search,
          { marginTop: 12, marginBottom: 12, marginHorizontal: 16 },
        ]}
      >
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
          <View
            style={{ flex: 1 }}
            accessibilityElementsHidden={!!selected}
            importantForAccessibility={selected ? "no-hide-descendants" : "auto"}
            pointerEvents={selected ? "none" : "auto"}
          >
          <View
            testID="page-header"
            style={[
              s.masthead,
              { borderBottomColor: scrolled ? c.rule : c.transparent },
            ]}
          >
            {tab === "Settings" && settingsPage !== "main" ? (
              <Action
                icon={ChevronLeft}
                label={settingsPage === "License" ? "Back to About" : "Back to Settings"}
                onPress={() => setSettingsPage(settingsPage === "License" ? "About" : "main")}
              />
            ) : null}
            {tab === "Sources" && sourceOrder ? <Action icon={X} label="Cancel reorder" onPress={() => setSourceOrder(null)} disabled={savingOrder || draggingSource} /> : null}
            <Text
              style={[
                s.brand,
                { flex: 1 },
                tab !== "Feed" && { fontSize: 32, letterSpacing: -0.8 },
              ]}
            >
              {tab === "Sources" && sourceOrder ? "" : tab === "Feed"
                ? "ress"
                : tab === "Settings" && settingsPage !== "main"
                  ? settingsPage
                  : tab}
            </Text>
            {tab === "Feed" ? (
              <Action
                icon={RefreshCw}
                label="Refresh feeds"
                onPress={() => void sync()}
                disabled={busy || !sources.length}
              />
            ) : null}
            {tab === "Sources" ? sourceOrder ? (
              <>
                <Button compact title={savingOrder ? "Saving…" : "Save"} onPress={() => void saveSourceOrder()} disabled={savingOrder || draggingSource || sourceOrder.every((source, index) => source.id === sources[index]?.id)} />
              </>
            ) : (
              <>
                <Action icon={ArrowDownUp} label="Reorder sources" disabled={sources.length < 2 || busy || sourceBusy}
                  onPress={() => { setSourceMenu(false); setSourceOrder([...sources]); }} />
                <Action icon={Plus} label="Add source" onPress={() => setSourceMenu(!sourceMenu)} disabled={sourceBusy} />
              </>
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
          <Scene scene={`${tab}:${settingsPage}`}>
            {tab === "Feed" || tab === "Saved" ? (
              <FlatList
                ref={feedListRef}
                key={tab}
                onScroll={(event) =>
                  setScrolled(event.nativeEvent.contentOffset.y > 1)
                }
                scrollEventThrottle={16}
                data={visible}
                keyExtractor={(a) => a.id}
                contentContainerStyle={[
                  s.feedContent,
                  !visible.length && s.emptyContent,
                ]}
                ListHeaderComponent={listHeader}
                refreshControl={
                  <RefreshControl
                    refreshing={busy}
                    onRefresh={sync}
                    tintColor={c.ink}
                    colors={[c.ink]}
                    progressBackgroundColor={c.surface}
                  />
                }
                renderItem={({ item, index }) => (
                  <View style={[s.article, index === 0 && s.leadArticle]}>
                    <ArticlePressable
                      label={`Read ${item.title}`}
                      onPress={() => openArticle(item)}
                    >
                      <View style={s.articleMeta}>
                        <View style={s.sourceIdentity}>
                          <Favicon
                            uri={
                              sources.find(
                                (source) => source.id === item.sourceId,
                              )?.customIcon ||
                              item.favicon ||
                              faviconUrl(item.url)
                            }
                            title={item.source}
                            size={18}
                          />
                          <Text numberOfLines={1} style={s.sourceName}>
                            {item.source}
                          </Text>
                        </View>
                      </View>
                      <View style={isGitHubRelease(item.url) && s.releaseBody}>
                        {!isGitHubRelease(item.url) && (
                          <Thumbnail uri={item.image} />
                        )}
                        <View
                          style={isGitHubRelease(item.url) && s.releaseText}
                        >
                          <Text
                            style={[
                              s.articleTitle,
                              read.includes(item.id) && s.readTitle,
                            ]}
                          >
                            {item.title}
                          </Text>
                          {item.summary ? (
                            <Text
                              numberOfLines={2}
                              style={s.summary}
                            >
                              {item.summary}
                            </Text>
                          ) : null}
                        </View>
                        {isGitHubRelease(item.url) && (
                          <Thumbnail
                            uri={item.image}
                            compact

                          />
                        )}
                      </View>
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
                    </ArticlePressable>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={s.empty}>
                    {busy ? (
                      <>
                        <ActivityIndicator color={c.ink} />
                        <Text style={s.emptyTitle}>
                          Gathering your edition.
                        </Text>
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
            ) : tab === "Sources" && sourceOrder ? (
              <View style={{ flex: 1 }}>
                <ReorderSources items={sourceOrder} onChange={setSourceOrder} disabled={savingOrder} onDragging={setDraggingSource} />
              </View>
            ) : (
              <ScrollView
                ref={sourcesScrollRef}
                key={`${tab}:${settingsPage}`}
                onScroll={(event) =>
                  setScrolled(event.nativeEvent.contentOffset.y > 1)
                }
                scrollEventThrottle={16}
                contentContainerStyle={
                  tab === "Sources"
                    ? [s.sourcesContent, !sources.length && s.emptyContent]
                    : s.listContent
                }
              >
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
                    {settingsPage === "main" ? (
                      <>
                        <Text style={s.settingsSection}>Appearance</Text>
                        <View
                          accessibilityRole="radiogroup"
                          accessibilityLabel="Theme"
                          style={s.themeChoices}
                        >
                          {(
                            [
                              {
                                value: "device",
                                label: "Device",
                                icon: Smartphone,
                              },
                              { value: "light", label: "Light", icon: Sun },
                              { value: "dark", label: "Dark", icon: Moon },
                            ] as const
                          ).map(({ value, label, icon: Icon }) => (
                            <Pressable
                              key={value}
                              accessibilityRole="radio"
                              accessibilityLabel={`${label} theme`}
                              aria-checked={settings.theme === value}
                              accessibilityState={{
                                checked: settings.theme === value,
                              }}
                              onPress={() =>
                                void changeSettings({
                                  theme: value,
                                })
                              }
                              style={({ pressed }) => [
                                s.themeChoice,
                                settings.theme === value && s.selected,
                                pressed && s.pressed,
                              ]}
                            >
                              <Icon
                                size={17}
                                color={
                                  settings.theme === value ? c.accentInk : c.ink
                                }
                              />
                              <Text
                                style={[
                                  s.themeChoiceText,
                                  settings.theme === value && {
                                    color: c.accentInk,
                                    fontFamily: f.bold,
                                  },
                                ]}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={[s.aboutLinks, { marginTop: 12 }]}>
                          {(
                            [
                              { title: "Import & Export", icon: FileText },
                              { title: "Text size", icon: Type },
                              { title: "Widget", icon: LayoutGrid },
                              { title: "About", icon: Info },
                            ] as const
                          ).map(({ title, icon: Icon }) => (
                            <SettingsRow
                              key={title}
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${title}`}
                              style={title === "About" ? { borderBottomWidth: 0 } : undefined}
                              onPress={() => setSettingsPage(title)}
                            >
                              <Icon size={21} color={c.ink} />
                              <Text style={[s.settingTitle, { flex: 1 }]}>
                                {title}
                              </Text>
                              <ChevronRight size={18} color={c.muted} />
                            </SettingsRow>
                          ))}
                        </View>
                      </>
                    ) : settingsPage === "Import & Export" ? (
                      <>
                        <Text style={s.helper}>
                          Move your feeds between Ress and other readers with OPML.
                          Feed titles and categories are included; saved articles and reading history are not.
                        </Text>
                        <View style={s.aboutLinks}>
                          <SettingsRow accessibilityRole="button" accessibilityLabel="Import OPML" disabled={sourceBusy} onPress={() => void importOpml()}>
                            <Download size={21} color={c.ink} />
                            <View style={{ flex: 1, gap: 4 }}><Text style={s.settingTitle}>Import OPML</Text><Text style={s.small}>Add feeds from another reader. Existing feeds are kept.</Text></View>
                            <ChevronRight size={18} color={c.muted} />
                          </SettingsRow>
                          <SettingsRow accessibilityRole="button" accessibilityLabel="Export OPML" disabled={sourceBusy || !sources.length} style={{ borderBottomWidth: 0 }} onPress={() => void saveOpml()}>
                            <Upload size={21} color={c.ink} />
                            <View style={{ flex: 1, gap: 4 }}><Text style={s.settingTitle}>Export OPML</Text><Text style={s.small}>{sources.length} sources available to export.</Text></View>
                            <ChevronRight size={18} color={c.muted} />
                          </SettingsRow>
                        </View>
                        {sourceBusy && <ActivityIndicator color={c.ink} />}
                      </>
                    ) : settingsPage === "Text size" ? (
                      <>
                        <Text style={s.settingsSection}>Reading text size</Text>
                        <ScrollView
                          style={{
                            height: 420,
                            flexGrow: 0,
                            backgroundColor: c.surface,
                            borderRadius: 16,
                            marginBottom: 16,
                          }}
                          contentContainerStyle={{ padding: 16 }}
                        >
                          {Array.from({ length: 5 }, (_, index) => (
                            <Text
                              key={index}
                              style={[
                                s.readingText,
                                settings.readingSize === "small" &&
                                  s.readingSmall,
                                settings.readingSize === "large" &&
                                  s.readingLarge,
                                { marginBottom: 18 },
                              ]}
                            >
                              Lorem ipsum dolor sit amet, consectetur adipiscing
                              elit. Sed vitae velit a justo tempor commodo.
                              Integer interdum, nibh a facilisis consequat,
                              neque lacus volutpat neque, vitae dignissim sem
                              ipsum at sapien.
                            </Text>
                          ))}
                        </ScrollView>
                        <View
                          accessibilityRole="radiogroup"
                          accessibilityLabel="Reading text size"
                          style={s.themeChoices}
                        >
                          {(["small", "normal", "large"] as const).map(
                            (size) => (
                              <Pressable
                                key={size}
                                accessibilityRole="radio"
                                accessibilityLabel={`${size} reading text`}
                                aria-checked={settings.readingSize === size}
                                accessibilityState={{
                                  checked: settings.readingSize === size,
                                }}
                                onPress={() =>
                                  void changeSettings({
                                    readingSize: size,
                                  })
                                }
                                style={[
                                  s.themeChoice,
                                  settings.readingSize === size && s.selected,
                                ]}
                              >
                                <Text
                                  style={[
                                    s.themeChoiceText,
                                    settings.readingSize === size && {
                                      color: c.accentInk,
                                      fontFamily: f.bold,
                                    },
                                  ]}
                                >
                                  {size === "small"
                                    ? "Small"
                                    : size === "normal"
                                      ? "Normal"
                                      : "Large"}
                                </Text>
                              </Pressable>
                            ),
                          )}
                        </View>
                      </>
                    ) : settingsPage === "Widget" ? (
                      <>
                        <Text style={s.helper}>
                          Add a widget, then long-press it on your home screen
                          and choose Settings to change its source or unread
                          filter. Each widget has its own settings.
                        </Text>
                        <Button
                          title="Add widget to home screen"
                          onPress={() => {
                            void pinWidget()
                              .then((ok) => {
                                if (!ok)
                                  setNotice(
                                    widgetAvailable
                                      ? "Long-press your home screen, choose Widgets, then Ress."
                                      : "Widgets are available in the Android app.",
                                  );
                              })
                              .catch(() =>
                                setNotice(
                                  "Open your launcher’s widget picker and choose Ress.",
                                ),
                              );
                          }}
                        />
                      </>
                    ) : settingsPage === "License" ? (
                      <Text selectable style={s.body}>{licenseText}</Text>
                    ) : (
                      <>
                        <View style={s.aboutHero}>
                          <Image
                            source={require("./assets/icon.png")}
                            style={s.aboutIcon}
                          />
                          <Text style={s.aboutTitle}>Ress</Text>
                          <Text style={[s.small, { marginTop: -7 }]}>Ferdinan Iydheko</Text>
                          <Text style={s.versionBadge}>1.0.0</Text>
                        </View>
                        <View style={s.aboutLinks}>
                          <SettingsRow
                            accessibilityRole="link"
                            accessibilityLabel="Ress on GitHub"

                            onPress={() =>
                              void Browser.openBrowserAsync(
                                "https://github.com/ferdinankurnian/ress",
                              )
                            }
                          >
                            <Github size={21} color={c.ink} />
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text style={s.settingTitle}>GitHub</Text>
                            </View>
                            <ExternalLink size={18} color={c.muted} />
                          </SettingsRow>
                          <SettingsRow
                            accessibilityRole="link"
                            accessibilityLabel="iydheko.dev website"

                            onPress={() =>
                              void Browser.openBrowserAsync(
                                "https://iydheko.dev",
                              )
                            }
                          >
                            <Globe size={21} color={c.ink} />
                            <Text style={[s.settingTitle, { flex: 1 }]}>
                              iydheko.dev
                            </Text>
                            <ExternalLink size={18} color={c.muted} />
                          </SettingsRow>
                          <SettingsRow
                            accessibilityRole="button"
                            accessibilityLabel="MIT License"
                            style={{ borderBottomWidth: 0 }}
                            onPress={() => setSettingsPage("License")}
                          >
                            <FileText size={21} color={c.ink} />
                            <Text style={[s.settingTitle, { flex: 1 }]}>
                              License
                            </Text>
                            <Text style={s.small}>MIT</Text>
                            <ChevronRight size={18} color={c.muted} />
                          </SettingsRow>
                        </View>
                      </>
                    )}
                  </>
                )}
              </ScrollView>
            )}
          </Scene>
          <SafeAreaView edges={["bottom"]} style={s.navSafe}>
            <View style={s.nav}>
              {tabs.map(({ name, icon: Icon }) => (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === name }}
                  disabled={savingOrder || draggingSource}
                  onPress={() => {
                    if (name === tab && !sourceOrder) {
                      if (name === "Feed" || name === "Saved") feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
                      if (name === "Sources") sourcesScrollRef.current?.scrollTo({ y: 0, animated: true });
                    }
                    if (name !== tab) setSourceOrder(null);
                    setTab(name);
                    setSettingsPage("main");
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
          {selected ? (
            <SafeAreaView
              edges={["bottom"]}
              style={[StyleSheet.absoluteFill, { backgroundColor: c.paper }]}
              accessibilityViewIsModal
              testID="article-reader"
            >
              <View style={s.reader}>
                <View
                  style={s.readerBar}
                  onLayout={(event) =>
                    setReaderBarHeight(event.nativeEvent.layout.height)
                  }
                >
                  <Action
                    icon={ChevronLeft}
                    label="Back to stories"
                    onPress={() => setSelected(null)}
                  />
                  <View style={s.actionRow}>
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
                    <Action
                      icon={Ellipsis}
                      label="Article options"
                      onPress={() => setReaderMenu((open) => !open)}
                    />
                  </View>
                </View>
                <View style={{ flex: 1, overflow: "hidden" }}>
                  <Scene key={selected.id} scene={selected.id} animateOnMount>
                    <ScrollView contentContainerStyle={s.readerContent}>
                      <View style={s.sourceIdentity}>
                        <Favicon
                          uri={
                            sources.find(
                              (source) => source.id === selected.sourceId,
                            )?.customIcon ||
                            selected.favicon ||
                            faviconUrl(selected.url)
                          }
                          title={selected.source}
                          size={24}
                        />
                        <Text style={s.sourceName}>{selected.source}</Text>
                      </View>
                      <Text selectable style={s.readerTitle}>
                        {selected.title}
                      </Text>
                      <Text style={s.small}>{dateLabel(selected.date)}</Text>
                      {!isGitHubRelease(selected.url) && (
                        <Thumbnail uri={selected.image} />
                      )}
                      <View style={s.readerRule} />
                      <Text
                        selectable
                        style={[
                          s.readingText,
                          settings.readingSize === "large" && s.readingLarge,
                          settings.readingSize === "small" && s.readingSmall,
                        ]}
                      >
                        {selected.content ||
                          selected.summary ||
                          "This feed contains a headline only. Open the original to read the full story."}
                      </Text>
                    </ScrollView>
                  </Scene>
                </View>
                {readerMenu ? (
                  <View style={StyleSheet.absoluteFill}>
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      accessibilityRole="button"
                      accessibilityLabel="Close article options"
                      onPress={() => setReaderMenu(false)}
                    />
                    <PopIn
                      style={[
                        s.sourceMenu,
                        s.readerMenu,
                        { top: readerBarHeight + 4 },
                      ]}
                    >
                      <Pressable
                        style={s.menuItem}
                        accessibilityRole="button"
                        onPress={() => {
                          setReaderMenu(false);
                          void Share.share({
                            message: `${selected.title}\n${selected.url}`,
                          }).catch(() =>
                            setConfirmation({ title: "Could not share article", message: "Please try again." }),
                          );
                        }}
                      >
                        <Share2 size={20} color={c.ink} />
                        <Text style={s.settingTitle}>Share</Text>
                      </Pressable>
                      <Pressable
                        style={s.menuItem}
                        accessibilityRole="button"
                        onPress={() => {
                          setReaderMenu(false);
                          void Clipboard.setStringAsync(selected.url).catch(
                            () =>
                              setConfirmation({ title: "Could not copy link", message: "Please try again." }),
                          );
                        }}
                      >
                        <Copy size={20} color={c.ink} />
                        <Text style={s.settingTitle}>Copy link</Text>
                      </Pressable>
                      <View style={s.readerMenuRule} />
                      <Pressable
                        style={s.menuItem}
                        accessibilityRole="button"
                        onPress={() => {
                          setReaderMenu(false);
                          void Browser.openBrowserAsync(selected.url).catch(
                            () =>
                              setConfirmation({ title: "Could not open article", message: "Please try again." }),
                          );
                        }}
                      >
                        <ExternalLink size={20} color={c.ink} />
                        <Text style={s.settingTitle}>Open in browser</Text>
                      </Pressable>
                    </PopIn>
                  </View>
                ) : null}
              </View>
            </SafeAreaView>
          ) : null}
        </View>
        <ConfirmDialog visible={!!removing} title="Remove source?" colors={c} cancelLabel="Cancel" confirmLabel={removingBusy ? "Removing…" : "Remove"} destructive busy={removingBusy} onClose={() => setRemoving(null)} onConfirm={() => void confirmRemoveSource()}>
          {removing && <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.surface }}>
            <Favicon uri={removing.customIcon || removing.icon || googleFaviconUrl(removing.url)} title={removing.title} size={36} />
            <Text style={[s.settingTitle, { flex: 1 }]}>{removing.title}</Text>
          </View>}
          <Text style={s.small}>Saved articles will stay in your library.</Text>
        </ConfirmDialog>
        <ConfirmDialog visible={!!confirmation} title={confirmation?.title || ""} colors={c} cancelLabel={confirmation?.action ? "Cancel" : undefined} confirmLabel={confirmation?.action ? "Read all" : "OK"} onClose={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.action; setConfirmation(null); action?.(); }}>
          <Text style={s.body}>{confirmation?.message}</Text>
        </ConfirmDialog>
        <MotionModal visible={sourceMenu} onClose={() => setSourceMenu(false)}>
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
                  setEditing(null);
                  setCustomIcon("");
                  setPreviewUrl("");
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
        </MotionModal>
        <MotionModal
          drawer
          visible={!!sheet}
          onClose={() => {
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
                    <View style={s.iconEditor}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Upload source icon"
                        onPress={() => void uploadIcon()}
                        disabled={iconBusy || sourceBusy}
                        style={s.iconUploadTarget}
                      >
                        <Favicon
                          uri={
                            customIcon ||
                            (editing && url === editing.url
                              ? editing.icon || previewUrl
                              : previewUrl)
                          }
                          title={sourceTitle || "?"}
                          size={64}
                        />
                        <View style={s.uploadBadge}>
                          {iconBusy ? (
                            <ActivityIndicator
                              size="small"
                              color={c.accentInk}
                            />
                          ) : (
                            <Upload size={15} color={c.accentInk} />
                          )}
                        </View>
                      </Pressable>

                      {customIcon ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setCustomIcon("")}
                          style={s.iconEditorAction}
                        >
                          <Text
                            style={[
                              s.small,
                              {
                                color: c.ink,
                                backgroundColor: c.surface,
                                padding: 12,
                                borderRadius: 18,
                                fontFamily: f.bold,
                              },
                            ]}
                          >
                            Use website icon
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={s.settingTitle}>
                      Name{displayedSheet === "add" ? " (optional)" : ""}
                    </Text>
                    <TextInput
                      accessibilityLabel="Source name"
                      style={s.urlInput}
                      value={sourceTitle}
                      onChangeText={setSourceTitle}
                      placeholder={feedTitlePreview || "Source name"}
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
                      disabled={sourceBusy || iconBusy}
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
                      disabled={sourceBusy || iconBusy}
                    />
                    {notice ? <Text style={s.small}>{notice}</Text> : null}
                  </View>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </MotionModal>

      </SafeAreaView>
    </ThemeContext.Provider>
  );
}
function createStyles(c: Palette, dark: boolean) {
  return StyleSheet.create({
    iconEditor: { alignItems: "center", paddingVertical: 12, marginBottom: 4 },
    iconUploadTarget: { padding: 4, marginBottom: 4 },
    uploadBadge: {
      position: "absolute",
      right: 0,
      bottom: 0,
      backgroundColor: c.yellow,
      borderRadius: 14,
      width: 26,
      height: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    iconEditorAction: {
      minHeight: 40,
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    aboutHero: {
      alignItems: "center",
      paddingTop: 16,
      paddingBottom: 24,
      gap: 3,
    },
    aboutIcon: { width: 88, height: 88, borderRadius: 22, marginBottom: 8 },
    aboutTitle: { fontFamily: f.display, color: c.ink, fontSize: 32 },
    versionBadge: {
      fontFamily: f.bold,
      fontSize: 13,
      color: c.ink,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginTop: 4,
    },
    aboutLinks: {
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: c.surface,
    },
    dialogOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    dialogCard: {
      width: "100%",
      maxWidth: 400,
      borderRadius: 24,
      padding: 24,
      gap: 12,
      backgroundColor: c.paper,
    },
    dialogActions: { flexDirection: "row", gap: 12, marginTop: 12 },
    removeButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.error,
    },
    removeButtonText: { fontFamily: f.bold, fontSize: 15, color: c.white },
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
      flexDirection: "row",
      gap: 7,
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
      aspectRatio: 16 / 9,
      borderRadius: 12,
      marginTop: 0,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    },
    releaseBody: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
    releaseText: { flex: 1, minWidth: 0 },
    releaseAvatar: {
      width: 56,
      height: 56,
      aspectRatio: 1,
      borderRadius: 10,
      marginVertical: 0,
    },
    sourceIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    sourcePicker: {
      gap: 12,
      paddingTop: 16,
      // Centered 50px rings add 7px inside each 64px source option.
      paddingHorizontal: 16 - 7,
      paddingBottom: 12,
    },
    sourceOptionGroup: { flexDirection: "row", gap: 12 },
    sourceDivider: {
      width: 1,
      height: 28,
      marginTop: 14,
      backgroundColor: c.rule,
    },
    sourceOption: { width: 64, alignItems: "center", gap: 7 },
    sourceRing: {
      padding: 3,
      borderWidth: 2,
      borderColor: c.rule,
      borderRadius: 32,
    },
    sourceRingActive: { borderColor: c.yellow },
    allSource: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      marginTop: 4,
      paddingBottom: 12,
    },
    menuBackdrop: {
      flex: 1,
      backgroundColor: "transparent",
      alignItems: "flex-end",
      paddingTop: 92,
      paddingRight: 20,
    },
    sourceMenu: {
      backgroundColor: c.paper,
      borderRadius: 18,
      padding: 8,
      boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
    },
    readerMenu: { position: "absolute", right: 16 },
    readerMenuRule: {
      height: 1,
      backgroundColor: c.rule,
      marginHorizontal: 12,
      marginVertical: 4,
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
      backgroundColor: "transparent",
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
      paddingHorizontal: 16,
      paddingVertical: 8,
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
    listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
    feedContent: { paddingBottom: 24 },
    sourcesContent: { paddingTop: 0, paddingBottom: 24 },
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
      marginHorizontal: 16,
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
      fontFamily: f.bold,
      fontSize: 24,
      lineHeight: 30,
      color: c.ink,
      letterSpacing: -0.4,
    },
    readTitle: { color: c.muted },
    summary: {
      fontFamily: f.body,
      fontSize: 15,
      color: c.muted,
      lineHeight: 23,
      marginTop: 5,
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
    navItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 4 },
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
    emptyContent: { flexGrow: 1 },
    empty: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 24,
      alignItems: "center",
      gap: 18,
    },
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
    compactButton: {
      height: 36,
      minHeight: 36,
      paddingVertical: 0,
      paddingHorizontal: 18,
      borderRadius: 22,
    },
    quiet: { backgroundColor: c.surface },
    buttonText: { fontFamily: f.bold, color: c.accentInk, fontSize: 15 },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      marginBottom: 0,
    },
    addForm: { gap: 12, paddingTop: 8, paddingBottom: 16 },
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
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: c.paper,
    },
    sourceTitle: {
      fontFamily: f.medium,
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
    readerContent: { padding: 16 },
    readerTitle: {
      fontFamily: f.bold,
      color: c.ink,
      fontSize: 36,
      lineHeight: 43,
      letterSpacing: -0.8,
      marginTop: 18,
      marginBottom: 8,
    },
    readerRule: {
      height: 1,
      backgroundColor: c.rule,
      marginTop: 16,
      marginBottom: 28,
    },
    readingText: {
      fontFamily: f.body,
      color: c.ink,
      fontSize: 18,
      lineHeight: 30,
    },
    readingSmall: { fontSize: 16, lineHeight: 26 },
    readingLarge: { fontSize: 22, lineHeight: 36 },
  });
}
