import { fromByteArray } from "base64-js";

// The native widget image loader has no network timeout. Fetch bounded images
// before rendering so an unavailable publisher cannot stall the whole widget.
const cache = new Map<string, Promise<string>>();
export function widgetImage(url?: string): Promise<string> {
  if (!url) return Promise.resolve("");
  if (/^data:image\/(png|jpeg|webp);base64,/.test(url)) return Promise.resolve(url);
  const cached = cache.get(url);
  if (cached) return cached;
  const task = (async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 6000);
    try {
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) return "";
      const type = response.headers.get("content-type")?.split(";")[0] || "";
      if (!/^image\/(png|jpe?g|webp|gif|x-icon|vnd.microsoft.icon)$/.test(type))
        return "";
      if (Number(response.headers.get("content-length")) > 8_000_000) return "";
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 8_000_000) return "";
      const data = `data:${type};base64,${fromByteArray(bytes)}`;
      // Keep collection rows small enough for the native bridge and bitmap cache.
      if (bytes.length > 180_000 && typeof navigator !== "undefined" && navigator.product === "ReactNative") {
        try {
          const { ImageManipulator, SaveFormat } = await import("expo-image-manipulator");
          const resized = await ImageManipulator.manipulate(data).resize({ width: 512 }).renderAsync();
          const result = await resized.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
          if (result.base64) return `data:image/jpeg;base64,${result.base64}`;
        } catch { /* Keep the original when the publisher uses an unsupported codec. */ }
      }
      return data;
    } catch {
      return "";
    } finally {
      clearTimeout(timer);
    }
  })();
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(url, task);
  void task.then((result) => {
    if (!result) cache.delete(url);
  });
  return task;
}
