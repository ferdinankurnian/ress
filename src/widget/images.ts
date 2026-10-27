import { fromByteArray } from "base64-js";

// The native widget image loader has no network timeout. Fetch bounded images
// before rendering so an unavailable publisher cannot stall the whole widget.
const cache = new Map<string, Promise<string>>();
export function widgetImage(url?: string): Promise<string> {
  if (!url) return Promise.resolve("");
  const cached = cache.get(url);
  if (cached) return cached;
  const task = (async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 3500);
    try {
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) return "";
      const type = response.headers.get("content-type")?.split(";")[0] || "";
      if (!/^image\/(png|jpe?g|webp|gif|x-icon|vnd.microsoft.icon)$/.test(type))
        return "";
      if (Number(response.headers.get("content-length")) > 500_000) return "";
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 500_000) return "";
      return `data:${type};base64,${fromByteArray(bytes)}`;
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
