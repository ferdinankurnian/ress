import { beforeEach, expect, mock, test } from "bun:test";
const storage = new Map<string, string>();
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    removeItem: async (key: string) => {
      storage.delete(key);
    },
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  },
}));
const { loadLibrary, refreshFeeds, put, keys } =
  await import("../src/data/store");
beforeEach(() => storage.clear());
test("fresh installs have no subscriptions, articles or saved items", async () => {
  const state = await loadLibrary();
  expect(state.sources).toEqual([]);
  expect(state.articles).toEqual([]);
  expect(state.saved).toEqual([]);
  const result = await refreshFeeds();
  expect(result.articles).toEqual([]);
  expect(result.synced).toBe("");
});
test("existing subscriptions survive the clean-install default change", async () => {
  const sources = [
    {
      id: "custom",
      title: "My feed",
      url: "https://custom.test/rss",
      category: "Feeds",
    },
  ];
  await put(keys.sources, sources);
  expect((await loadLibrary()).sources).toEqual(sources);
});
test("theme preference persists and older settings default to Device", async () => {
  await put(keys.settings, { largeType: true });
  expect((await loadLibrary()).settings.theme).toBe("device");
  await put(keys.settings, {
    ...(await loadLibrary()).settings,
    theme: "dark",
  });
  expect((await loadLibrary()).settings.theme).toBe("dark");
});

test("reading sizes migrate from the old larger-text toggle", async () => {
  await put(keys.settings, { largeType: true });
  expect((await loadLibrary()).settings.readingSize).toBe("large");
  await put(keys.settings, { largeType: false });
  expect((await loadLibrary()).settings.readingSize).toBe("normal");
  await put(keys.settings, { readingSize: "small", largeType: true });
  expect((await loadLibrary()).settings.readingSize).toBe("small");
});
test("article opening defaults to web and persists reading mode without losing preferences", async () => {
  expect((await loadLibrary()).settings.readingMode).toBe("web");
  await put(keys.settings, { theme: "dark", readingSize: "large" });
  expect((await loadLibrary()).settings.readingMode).toBe("web");
  await put(keys.settings, { ...(await loadLibrary()).settings, readingMode: "reading" });
  expect((await loadLibrary()).settings).toMatchObject({ readingMode: "reading", theme: "dark", readingSize: "large" });
  await put(keys.settings, { readingMode: "invalid" });
  expect((await loadLibrary()).settings.readingMode).toBe("web");
});
test("full page cache recovers from corruption, serializes writes, and preserves the library", async () => {
  const { cachePage, cachedPage } = await import("../src/reader/cache");
  await put(keys.saved, ["saved-id"]);
  storage.set("ress.reader.v1", "invalid JSON");
  const page = { url: "https://site.test/post", title: "Title", content: "Website text. ".repeat(30), byline: "", image: "" };
  expect(await cachedPage(page.url)).toBeNull();
  await Promise.all([
    cachePage(page, "https://redirect.test/post"),
    cachePage({ ...page, url: "https://site.test/second" }),
  ]);
  expect(await cachedPage("https://redirect.test/post")).toEqual(page);
  expect((await cachedPage("https://site.test/second"))?.title).toBe("Title");
  expect((await loadLibrary()).saved).toEqual(["saved-id"]);
  for (let i = 0; i < 4; i++)
    await cachePage({ ...page, url: `https://site.test/large${i}`, content: "字".repeat(100_000) });
  expect(storage.get("ress.reader.v1")!.length).toBeLessThanOrEqual(300_000);
  expect(await cachedPage("https://site.test/large3")).not.toBeNull();
  await cachePage({ ...page, content: "字".repeat(150_000) }, "https://redirect.test/long");
  expect((await cachedPage("https://redirect.test/long"))?.content.length).toBe(150_000);
});
test("widget settings are independent and legacy settings migrate only once", async () => {
  const {
    loadWidgetSettings,
    saveWidgetSettings,
    removeWidgetSettings,
    widgetSettingsKey,
  } = await import("../src/data/store");
  await put(keys.settings, { widgetSource: "legacy", unreadWidget: true });
  expect(await loadWidgetSettings(1)).toEqual({
    sourceId: "legacy",
    unreadOnly: true,
  });
  await put(keys.settings, { widgetSource: "changed", unreadWidget: false });
  expect((await loadWidgetSettings(1)).sourceId).toBe("legacy");
  await saveWidgetSettings(1, { sourceId: "first", unreadOnly: false });
  await saveWidgetSettings(2, { sourceId: "second", unreadOnly: true });
  expect(await loadWidgetSettings(1)).toEqual({
    sourceId: "first",
    unreadOnly: false,
  });
  expect(await loadWidgetSettings(2)).toEqual({
    sourceId: "second",
    unreadOnly: true,
  });
  await removeWidgetSettings(1);
  expect(storage.has(widgetSettingsKey(1))).toBe(false);
  expect((await loadWidgetSettings(2)).sourceId).toBe("second");
});
