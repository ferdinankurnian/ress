import AsyncStorage from "@react-native-async-storage/async-storage";
import { parsePageArticle, type PageArticle } from "./page";

const cacheKey = "ress.reader.v1";
let writes = Promise.resolve();
async function readCache(): Promise<Record<string, unknown>> {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(cacheKey) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
export async function cachedPage(url: string): Promise<PageArticle | null> {
  const cache = await readCache();
  const entry = cache[url];
  const redirect = entry && typeof entry === "object" && "redirect" in entry ? entry.redirect : null;
  return parsePageArticle(JSON.stringify(typeof redirect === "string" ? cache[redirect] : entry));
}
export function cachePage(page: PageArticle, originalUrl?: string) {
  writes = writes.catch(() => {}).then(async () => {
    const cache = await readCache();
    const urls = [...new Set([originalUrl, page.url].filter((url): url is string => !!url))];
    for (const url of urls) delete cache[url];
    if (originalUrl && originalUrl !== page.url) cache[originalUrl] = { redirect: page.url };
    cache[page.url] = { type: "ress:article", ...page };
    // Stay below Android's per-row storage limit, including non-Latin text.
    // This cache is separate from subscriptions, saved articles, and feed text.
    const entries = Object.entries(cache).slice(-40);
    let json = JSON.stringify(Object.fromEntries(entries));
    while (entries.length > 1 && json.length > 300_000) {
      entries.shift();
      json = JSON.stringify(Object.fromEntries(entries));
    }
    await AsyncStorage.setItem(cacheKey, json);
  });
  return writes;
}
