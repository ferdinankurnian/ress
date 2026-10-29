// Run in its own process: only Android's module boundary is mocked. The bridge,
// persistence, widget components, and library tree serializer are real.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const storage = new Map<string, string>();
const drawings: any[] = [];
let task: ((event: any) => Promise<void>) | undefined;
const info = {
  widgetName: "RessDigest",
  widgetId: 135,
  width: 300,
  height: 320,
};
const widgetInstances = [info];
const native = {
  getWidgetInfo: async () => widgetInstances,
  drawWidgetById: (config: any, name: string, id: number) => {
    assert.equal(name, "RessDigest");
    assert.ok(id === 135 || id === 136);
    drawings.push({ ...config, widgetId: id });
  },
  requestPinWidget: async () => true,
};
mock.module("react-native", () => ({
  Platform: { OS: "android" },
  StyleSheet: { create: (styles: unknown) => styles },
  NativeModules: { AndroidWidget: native },
  TurboModuleRegistry: { get: () => native, getEnforcing: () => native },
  AppRegistry: {
    registerComponent: (name: string) => {
      assert.equal(name, "RNWidgetConfigurationScreen");
    },
    registerHeadlessTask: (name: string, provider: () => typeof task) => {
      assert.equal(name, "RNWidgetBackgroundTask");
      task = provider();
    },
  },
  Image: { resolveAssetSource: (image: unknown) => image },
}));
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
globalThis.fetch = (async () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { "content-type": "image/png" },
  })) as unknown as typeof fetch;
const bridge = await import("../../src/widget/bridge.android");
const { keys, put, defaults } = await import("../../src/data/store");
assert.equal(bridge.widgetAvailable, true);
bridge.registerWidgets();
assert.ok(task, "the Android headless task must be registered");
await task({ ...info, widgetAction: "WIDGET_ADDED" });
assert.ok(
  drawings.length >= 1,
  "new widgets must draw even before OPML import",
);
assert.match(JSON.stringify(drawings[0]), /No articles here yet/);
const source = {
  id: "test",
  url: "https://source.test/feed",
  title: "My source",
  category: "Feeds",
};
const article = {
  id: "story",
  sourceId: source.id,
  source: source.title,
  title: "A cached headline",
  url: "https://source.test/post",
  date: new Date().toISOString(),
  summary: "",
  content: "",
  favicon: "https://source.test/icon.png",
  image: "https://source.test/cover.png",
};
await put(keys.sources, [source]);
await put(keys.articles, [article]);
await put(keys.settings, defaults);
drawings.length = 0;
await task({ ...info, widgetAction: "WIDGET_RESIZED" });
assert.equal(drawings.length, 2, "draw cached text before waiting for images");
assert.match(JSON.stringify(drawings[0]), /A cached headline/);
assert.equal(drawings[0].light.props.backgroundColor, "#F3EAB6");
assert.equal(drawings[0].dark.props.backgroundColor, "#1B1C17");
assert.match(JSON.stringify(drawings[1]), /ImageWidget/);
assert.match(JSON.stringify(drawings[1]), /data:image\/png;base64,AQID/);
// Check the actual native tree: weighted columns reserve space for fixed controls
// and the normal article thumbnail belongs beside the title, never above it.
const root = drawings[1].light;
const header = root.children[0];
assert.deepEqual(root.props.padding, { top: 16, right: 16, bottom: 16, left: 16 });
assert.equal(header.children[0].props.width, 0);
assert.equal(header.props.gravity & 112, 16, "header contents share a vertical center");
const refresh = header.children.find((child: any) => child.props.clickAction === "REFRESH");
assert.equal(refresh.props.width, 40);
assert.equal(refresh.props.height, 40);
assert.equal(refresh.props.borderRadius.topLeft, 20);
assert.equal(root.children[1].props.height, 0);
assert.equal(root.children[1].props.weight, 1);
const row = root.children[1].children[0].children[0];
assert.equal(row.children.length, 2, "source plus horizontal headline/thumbnail row");
// Contract consumed by RessNativeWidget.java after library serialization.
assert.equal(row.props.borderColor.bottom, "#DDD39B");
assert.equal(drawings[1].dark.children[1].children[0].children[0].props.borderColor.bottom, "#3A3D31");
assert.equal(row.props.clickActionData.uri, "ress://article?id=story");
assert.equal(row.children[0].children.at(-1).props.text, "My source");
assert.equal(header.children[2].children[0].type, "SvgWidget");
assert.ok(header.children[2].children[0].props.svgString.includes("<svg"));
const headlineRow = row.children[1];
assert.equal(headlineRow.props.orientation, "HORIZONTAL");
assert.equal(headlineRow.children[0].props.width, 0);
assert.equal(headlineRow.children[0].children[0].props.fontFamily, "HankenGrotesk_700Bold");
assert.equal(row.props.borderWidth?.bottom ?? 0, 0, "a single row has no trailing separator");
const thumbnail = headlineRow.children[1];
assert.equal(thumbnail.props.imageWidth, 96);
assert.equal(thumbnail.props.imageHeight, 54);
assert.equal(thumbnail.props.resizeMode, "cover");

// Resize through the real bridge at the configured minimum and larger sizes.
for (const width of [250, 300, 420]) {
  for (const height of [180, 320, 600]) {
    drawings.length = 0;
    await task({ ...info, width, height, widgetAction: "WIDGET_RESIZED" });
    const resized = drawings.at(-1).light;
    const resizedHeader = resized.children[0];
    const status = resizedHeader.children[1].props;
    assert.ok(width - 32 - status.width - status.margin.right - 40 >= 72);
    const list = resized.children[1];
    assert.equal(list.props.height, 0);
    assert.equal(list.props.weight, 1);
    const image = list.children[0].children[0].children[1].children[1].props;
    assert.ok(image.imageWidth + 12 < (width - 32) / 2);
    assert.ok(Math.abs(image.imageHeight - image.imageWidth * 9 / 16) <= 0.5);
  }
}
await put(keys.settings, { ...defaults, theme: "dark" });
drawings.length = 0;
await bridge.updateWidgets();
assert.equal(
  drawings.length,
  1,
  "foreground updates must await serialization and native dispatch",
);
assert.equal(drawings[0].light.props.backgroundColor, "#1B1C17");

const { saveWidgetSettings, loadWidgetSettings, widgetSettingsKey } =
  await import("../../src/data/store");
const customIcon = `data:image/png;base64,${readFileSync("assets/favicon.png").toString("base64")}`;
const secondSource = { ...source, id: "second", title: "Second source" };
await put(keys.sources, [{ ...source, customIcon }, secondSource]);
await put(keys.articles, [
  article,
  {
    ...article,
    id: "second-story",
    sourceId: "second",
    source: "Second source",
    title: "Second widget headline",
  },
]);
await saveWidgetSettings(135, { sourceId: "test", unreadOnly: false });
await saveWidgetSettings(136, { sourceId: "second", unreadOnly: true });
widgetInstances.push({ ...info, widgetId: 136 });
drawings.length = 0;
await bridge.updateWidgets();
assert.equal(drawings.length, 2);
const first = JSON.stringify(
  drawings.find((drawing) => drawing.widgetId === 135),
);
const second = JSON.stringify(
  drawings.find((drawing) => drawing.widgetId === 136),
);
assert.ok(
  first.includes("A cached headline") &&
    !first.includes("Second widget headline"),
);
assert.ok(
  first.includes(customIcon),
  "the first widget uses the uploaded source icon",
);
assert.ok(
  second.includes("Second widget headline") &&
    !second.includes("A cached headline"),
);
await put(keys.read, ["second-story"]);
drawings.length = 0;
await task({ ...info, widgetId: 136, widgetAction: "WIDGET_RESIZED" });
assert.match(JSON.stringify(drawings), /No articles here yet/);
await task({ ...info, widgetAction: "WIDGET_DELETED" });
assert.equal(storage.has(widgetSettingsKey(135)), false);
assert.equal((await loadWidgetSettings(136)).sourceId, "second");
await saveWidgetSettings(136, { sourceId: "all", unreadOnly: false });
await put(
  keys.articles,
  Array.from({ length: 12 }, (_, i) => ({
    ...article,
    id: `scroll-${i}`,
    title: `Scrollable headline ${i}`,
    image: "",
    favicon: "",
  })),
);
drawings.length = 0;
await task({
  ...info,
  widgetId: 136,
  height: 180,
  widgetAction: "WIDGET_RESIZED",
});
assert.match(JSON.stringify(drawings), /ListWidget/);
assert.match(JSON.stringify(drawings), /Scrollable headline 9/);
assert.doesNotMatch(JSON.stringify(drawings), /Scrollable headline 10|Scrollable headline 11/);
const finalRows = drawings.at(-1).light.children[1].children[0].children;
assert.equal(finalRows.length, 10);
assert.equal(finalRows[8].props.borderWidth.bottom, 1);
assert.equal(finalRows[9].props.borderWidth.bottom, 0);

// A real REFRESH event must show feedback before the network responds, then
// publish the fetched article and clear the feedback.
let releaseFeed!: () => void;
const feedPending = new Promise<void>((resolve) => { releaseFeed = resolve; });
let feedRequested!: () => void;
const requested = new Promise<void>((resolve) => { feedRequested = resolve; });
globalThis.fetch = (async () => {
  feedRequested();
  await feedPending;
  return new Response(`<rss><channel><title>Updated feed</title><item><guid>new-refresh-story</guid><title>Fetched by widget refresh</title><link>https://source.test/new</link><pubDate>${new Date(Date.now() + 1000).toUTCString()}</pubDate></item></channel></rss>`, {
    headers: { "content-type": "application/rss+xml" },
  });
}) as unknown as typeof fetch;
drawings.length = 0;
const refreshing = task({ ...info, widgetId: 136, widgetAction: "WIDGET_CLICK", clickAction: "REFRESH" });
await requested;
assert.match(JSON.stringify(drawings[0]), /Refreshing…/);
releaseFeed();
await refreshing;
assert.match(JSON.stringify(drawings.at(-1)), /Fetched by widget refresh/);
assert.doesNotMatch(JSON.stringify(drawings.at(-1)), /Refreshing…/);
console.log(
  "Android widget registration, cached rendering, images, themes, and foreground updates passed.",
);
