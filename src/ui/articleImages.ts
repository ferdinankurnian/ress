import type { Article } from "../data/feeds";

export type ThumbnailLayout = "square" | "standard" | "hidden";
export type PreparedArticle = Article & { thumbnailLayout: ThumbnailLayout };
type Dimensions = { width: number; height: number };
type ImageCache = [string, Dimensions][];
const valid = (size: Dimensions) => size && Number.isFinite(size.width) &&
  Number.isFinite(size.height) && size.width > 0 && size.height > 0;

/** Resolve geometry before publishing articles, never from a mounted image's onLoad. */
export function createArticleImagePreparer({ measure, read, write, timeoutMs = 5000 }: {
  measure: (uri: string) => Promise<Dimensions>;
  read: () => Promise<unknown>;
  write: (cache: ImageCache) => Promise<void>;
  timeoutMs?: number;
}) {
  const sizes = new Map<string, Dimensions>();
  // Includes failures: a late response or a refresh cannot change a visible layout.
  const decisions = new Map<string, Promise<ThumbnailLayout>>();
  const loaded = read().then(raw => {
    if (!Array.isArray(raw)) return;
    for (const entry of raw.slice(-1200)) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && valid(entry[1]))
        sizes.set(entry[0], entry[1]);
    }
  }).catch(() => {});
  let writes = Promise.resolve();

  return async (articles: Article[]): Promise<PreparedArticle[]> => {
    await loaded;
    const pending = [...new Set(articles.map(a => a.image).filter((uri): uri is string => !!uri))]
      .filter(uri => !decisions.has(uri));
    let cursor = 0;
    const deadline = Date.now() + timeoutMs;
    async function worker() {
      while (cursor < pending.length) {
        const uri = pending[cursor++];
        if (decisions.has(uri)) continue;
        // Register synchronously so overlapping refreshes share the same decision.
        const decision = (async (): Promise<ThumbnailLayout> => {
          let size = sizes.get(uri);
          if (!size) {
            const remaining = deadline - Date.now();
            if (remaining <= 0) return "hidden";
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              size = await Promise.race([
                Promise.resolve().then(() => measure(uri)),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(() => reject(new Error("Image dimensions timed out")), remaining);
                }),
              ]);
              if (!valid(size)) return "hidden";
              sizes.set(uri, size);
            } catch {
              return "hidden";
            } finally {
              clearTimeout(timer);
            }
          }
          return size.width === size.height ? "square" : "standard";
        })();
        decisions.set(uri, decision);
        await decision;
      }
    }
    await Promise.all(Array.from({ length: Math.min(8, pending.length) }, worker));
    const prepared = await Promise.all(articles.map(async article => ({
      ...article,
      thumbnailLayout: article.image ? await decisions.get(article.image)! : "hidden" as const,
    })));
    const snapshot: ImageCache = [...sizes].slice(-1200);
    writes = writes.then(() => write(snapshot)).catch(() => {});
    await writes;
    return prepared;
  };
}
