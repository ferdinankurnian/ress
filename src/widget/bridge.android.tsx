"use no memo";
import React from "react";
import { NativeModules, TurboModuleRegistry } from "react-native";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import {
  loadLibrary,
  refreshFeeds,
  loadWidgetSettings,
  removeWidgetSettings,
} from "../data/store";
import { resolveTheme } from "../ui/theme";
import { prepareArticleImages } from "../ui/prepareArticleImages";
import { widgetImage } from "./images";

export const widgetAvailable = Boolean(
  TurboModuleRegistry.get("AndroidWidget") || NativeModules.AndroidWidget,
);
const nativeWidget: typeof import("react-native-android-widget") | null =
  widgetAvailable ? require("react-native-android-widget") : null;
export async function renderWidgetSnapshot(
  widgetId: number,
  height?: number,
  failed = false,
  images = true,
  width = 300,
  refreshing = false,
) {
  const { RessWidget } =
    require("./RessWidget") as typeof import("./RessWidget");
  const [state, preferences] = await Promise.all([
    loadLibrary(),
    loadWidgetSettings(widgetId),
  ]);
  const widgetSource = state.sources.some(
    (source) => source.id === preferences.sourceId,
  )
    ? preferences.sourceId
    : "all";
  const active = new Set(state.sources.map((s) => s.id));
  const filtered = state.articles.filter(
    (a) =>
      active.has(a.sourceId) &&
      (widgetSource === "all" || a.sourceId === widgetSource) &&
      (!preferences.unreadOnly || !state.read.includes(a.id)),
  ).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).slice(0, 10);
  const prepared = images ? await prepareArticleImages(filtered) : filtered;
  const articles = prepared.map((article) => ({
    ...article,
    favicon:
      state.sources.find((source) => source.id === article.sourceId)
        ?.customIcon || "",
    image: "",
  }));
  if (images) {
    let next = 0;
    const deadline = Date.now() + 4500;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        while (next < filtered.length && Date.now() < deadline) {
          const index = next++;
          const article = prepared[index];
          const [favicon, image] = await Promise.all([
            widgetImage(articles[index].favicon || article.favicon),
            widgetImage(article.image),
          ]);
          articles[index] = { ...article, favicon, image };
        }
      }),
    );
  }
  const render = (scheme: "light" | "dark") => (
    <RessWidget
      articles={articles}
      height={height}
      width={width}
      synced={state.synced}
      failed={failed}
      refreshing={refreshing}
      scheme={scheme}
      background={state.settings.background}
    />
  );
  return state.settings.theme === "device"
    ? { light: render("light"), dark: render("dark") }
    : render(resolveTheme(state.settings.theme, null));
}
const renderVersions = new Map<number, symbol>();
async function handler(props: WidgetTaskHandlerProps) {
  const id = props.widgetInfo.widgetId;
  const version = Symbol();
  renderVersions.set(id, version);
  const render = props.renderWidget;
  props = { ...props, renderWidget: (widget) => {
    // A slow image fetch from before a resize must not overwrite the new layout.
    if (renderVersions.get(id) === version) render(widget);
  } };
  if (props.widgetAction === "WIDGET_DELETED") renderVersions.delete(id);
  if (props.widgetAction === "WIDGET_DELETED") {
    await removeWidgetSettings(props.widgetInfo.widgetId);
    return;
  }
  try {
    props.renderWidget(
      await renderWidgetSnapshot(
        props.widgetInfo.widgetId,
        props.widgetInfo.height,
        false,
        false,
        props.widgetInfo.width,
        props.widgetAction === "WIDGET_CLICK" && props.clickAction === "REFRESH",
      ),
    );
  } catch {
    const { RessWidget } =
      require("./RessWidget") as typeof import("./RessWidget");
    props.renderWidget(<RessWidget articles={[]} synced="" failed />);
  }
  if (props.widgetAction === "WIDGET_RESIZED") {
    props.renderWidget(
      await renderWidgetSnapshot(
        props.widgetInfo.widgetId,
        props.widgetInfo.height,
        false,
        true,
        props.widgetInfo.width,
      ),
    );
    return;
  }
  if (props.widgetAction === "WIDGET_CLICK" && props.clickAction !== "REFRESH")
    return;
  try {
    const result = await refreshFeeds();
    props.renderWidget(
      await renderWidgetSnapshot(
        props.widgetInfo.widgetId,
        props.widgetInfo.height,
        result.failures.length > 0,
        true,
        props.widgetInfo.width,
      ),
    );
  } catch {
    props.renderWidget(
      await renderWidgetSnapshot(
        props.widgetInfo.widgetId,
        props.widgetInfo.height,
        true,
        true,
        props.widgetInfo.width,
      ),
    );
  }
}
export function registerWidgets() {
  nativeWidget?.registerWidgetTaskHandler(handler);
  nativeWidget?.registerWidgetConfigurationScreen((props) => {
    const Configuration = require("./WidgetConfiguration").default;
    return <Configuration {...props} />;
  });
}
export async function updateWidgets() {
  if (!nativeWidget) return;
  const widgets = await nativeWidget.getWidgetInfo("RessDigest");
  // The library's bulk updater uses an unawaited async forEach. Update by ID
  // so callers wait for serialization and can handle failures.
  await Promise.all(
    widgets.map((info) =>
      nativeWidget.requestWidgetUpdateById({
        widgetName: "RessDigest",
        widgetId: info.widgetId,
        renderWidget: (current) =>
          renderWidgetSnapshot(
            current.widgetId,
            current.height,
            false,
            true,
            current.width,
          ),
      }),
    ),
  );
}
export async function pinWidget() {
  return nativeWidget
    ? await nativeWidget.requestPinWidget({ widgetName: "RessDigest" })
    : false;
}
