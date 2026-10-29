import { forwardRef, useEffect } from "react";
import type { WebView, WebViewProps } from "react-native-webview";
export type WebPageProps = WebViewProps & { onUnavailable: () => void };

// Internal test environments cannot mount the Android browser component.
export default forwardRef<WebView, WebPageProps>(function WebPage({ onUnavailable }, _ref) {
  useEffect(onUnavailable, [onUnavailable]);
  return null;
});
