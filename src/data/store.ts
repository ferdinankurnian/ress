import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Article,
  Source,
  mergeArticles,
  parseFeed,
  parseFeedInfo,
} from "./feeds";
import type { ThemePreference } from "../ui/theme";
export type Settings = {
  theme: ThemePreference;
  widgetSource: string;
  unreadWidget: boolean;
  largeType: boolean;
};
export const defaults: Settings = {
  theme: "device",
  widgetSource: "all",
  unreadWidget: false,
  largeType: false,
};
export const keys = {
  sources: "ress.sources.v1",
  articles: "ress.articles.v1",
  saved: "ress.saved.v1",
  read: "ress.read.v1",
  settings: "ress.settings.v1",
  synced: "ress.synced.v1",
};
export async function get<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
export async function put<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
export async function loadLibrary() {
  const [sources, articles, saved, read, settings, synced] = await Promise.all([
    get<Source[]>(keys.sources, []),
    get<Article[]>(keys.articles, []),
    get<string[]>(keys.saved, []),
    get<string[]>(keys.read, []),
    get<Settings>(keys.settings, defaults),
    get<string>(keys.synced, ""),
  ]);
  return {
    sources,
    articles,
    saved,
    read,
    settings: { ...defaults, ...settings },
    synced,
  };
}
export async function fetchSourceDetails(source: Source) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  try {
    const res = await fetch(source.url, {
      signal: abort.signal,
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return {
      articles: parseFeed(text, source),
      ...parseFeedInfo(text, source),
    };
  } finally {
    clearTimeout(timer);
  }
}
export async function fetchSource(source: Source): Promise<Article[]> {
  return (await fetchSourceDetails(source)).articles;
}
let inFlight:
  | Promise<{ articles: Article[]; failures: string[]; synced: string }>
  | undefined;
export function refreshFeeds() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const state = await loadLibrary();
    const results = await Promise.allSettled(state.sources.map(fetchSource));
    const fresh: Article[] = [];
    const failures: string[] = [];
    results.forEach((r, i) =>
      r.status === "fulfilled"
        ? fresh.push(...r.value)
        : failures.push(state.sources[i].title),
    );
    const latest = await loadLibrary();
    const active = new Set(latest.sources.map((s) => s.id));
    const articles = mergeArticles(
      fresh.filter((a) => active.has(a.sourceId)),
      latest.articles,
      latest.saved,
    );
    const synced = results.some((r) => r.status === "fulfilled")
      ? new Date().toISOString()
      : latest.synced;
    await put(keys.articles, articles);
    await put(keys.synced, synced);
    return { articles, failures, synced };
  })().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}
