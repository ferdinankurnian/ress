import { safeUrl } from "../data/feeds";

export type ReadingMode = "web" | "reading";
export type PageArticle = {
  url: string;
  title: string;
  content: string;
  byline: string;
  image: string;
};

// Website messages are untrusted; accept text and HTTP(S) images only.
export function parsePageArticle(raw: string, expectedUrl?: string): PageArticle | null {
  if (typeof raw !== "string" || raw.length > 600_000) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.type !== "ress:article" || !safeUrl(value.url ?? "") ||
      (expectedUrl && safeUrl(value.url) !== safeUrl(expectedUrl)) ||
      typeof value.title !== "string" || typeof value.content !== "string" ||
      value.content.trim().length < 80) return null;
    return {
      url: safeUrl(value.url),
      title: value.title.slice(0, 1000),
      content: value.content.slice(0, 150_000),
      byline: typeof value.byline === "string" ? value.byline.slice(0, 1000) : "",
      image: typeof value.image === "string" ? safeUrl(value.image, value.url) : "",
    };
  } catch { return null; }
}


// Android WebMessageListener reports the sender origin, not the document path.
// The payload is independently checked against the full current article URL.
export function matchesReaderOrigin(sender: string, current: string): boolean {
  try {
    return !!safeUrl(sender) && !!safeUrl(current) && new URL(sender).origin === new URL(current).origin;
  } catch { return false; }
}
