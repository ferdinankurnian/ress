"use no memo";
import React from "react";
import { NativeModules, TurboModuleRegistry } from "react-native";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { loadLibrary, refreshFeeds } from "../data/store";
import { resolveTheme } from "../ui/theme";
import { widgetImage } from "./images";

export const widgetAvailable = Boolean(
  TurboModuleRegistry.get("AndroidWidget") || NativeModules.AndroidWidget,
);
const nativeWidget: typeof import("react-native-android-widget") | null =
  widgetAvailable ? require("react-native-android-widget") : null;
async function snapshot(height?: number, failed = false, images = true) {
  const { RessWidget } =
    require("./RessWidget") as typeof import("./RessWidget");
  const state = await loadLibrary();
  const active = new Set(state.sources.map((s) => s.id));
  const filtered = state.articles.filter(
    (a) =>
      active.has(a.sourceId) &&
      (state.settings.widgetSource === "all" ||
        a.sourceId === state.settings.widgetSource) &&
      (!state.settings.unreadWidget || !state.read.includes(a.id)),
  );
  const count = Math.max(
    1,
    Math.min(4, Math.floor(((height ?? 260) - 80) / 92)),
  );
  const articles = await Promise.all(
    filtered.slice(0, count).map(async (article) => ({
      ...article,
      favicon: images ? await widgetImage(article.favicon) : "",
      image: images ? await widgetImage(article.image) : "",
    })),
  );
  const render = (scheme: "light" | "dark") => (
    <RessWidget
      articles={articles}
      height={height}
      synced={state.synced}
      failed={failed}
      scheme={scheme}
    />
  );
  return state.settings.theme === "device"
    ? { light: render("light"), dark: render("dark") }
    : render(resolveTheme(state.settings.theme, null));
}
async function handler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === "WIDGET_DELETED") return;
  try {
    props.renderWidget(await snapshot(props.widgetInfo.height, false, false));
  } catch {
    const { RessWidget } =
      require("./RessWidget") as typeof import("./RessWidget");
    props.renderWidget(<RessWidget articles={[]} synced="" failed />);
  }
  if (props.widgetAction === "WIDGET_RESIZED") {
    props.renderWidget(await snapshot(props.widgetInfo.height));
    return;
  }
  if (props.widgetAction === "WIDGET_CLICK" && props.clickAction !== "REFRESH")
    return;
  try {
    const result = await refreshFeeds();
    props.renderWidget(
      await snapshot(props.widgetInfo.height, result.failures.length > 0),
    );
  } catch {
    props.renderWidget(await snapshot(props.widgetInfo.height, true));
  }
}
export function registerWidgets() {
  nativeWidget?.registerWidgetTaskHandler(handler);
}
export async function updateWidgets() {
  if (nativeWidget)
    await nativeWidget.requestWidgetUpdate({
      widgetName: "RessDigest",
      renderWidget: (info) => snapshot(info.height),
    });
}
export async function pinWidget() {
  return nativeWidget
    ? await nativeWidget.requestPinWidget({ widgetName: "RessDigest" })
    : false;
}
