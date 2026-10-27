import { beforeEach, expect, mock, test } from "bun:test";
const storage = new Map<string, string>();
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
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
