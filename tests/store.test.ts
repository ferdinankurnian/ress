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
