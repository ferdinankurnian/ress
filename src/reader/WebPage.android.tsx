import React, { forwardRef, useEffect } from "react";
import { UIManager } from "react-native";
import type { WebView } from "react-native-webview";
import type { WebPageProps } from "./WebPage";

// Older development builds may not include the newly added native module.
const available = !!UIManager.getViewManagerConfig("RNCWebView");
const NativeWebView: React.ComponentType<import("react-native-webview").WebViewProps & React.RefAttributes<WebView>> | null = available ? require("react-native-webview").WebView : null;
export default forwardRef<WebView, WebPageProps>(function WebPage({ onUnavailable, ...props }, ref) {
  useEffect(() => { if (!NativeWebView) onUnavailable(); }, [onUnavailable]);
  return NativeWebView ? <NativeWebView ref={ref} {...props} /> : null;
});
