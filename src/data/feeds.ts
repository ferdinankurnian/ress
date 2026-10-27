import { XMLParser, XMLValidator } from "fast-xml-parser";
export type Source = {
  id: string;
  title: string;
  url: string;
  category: string;
  icon?: string;
};
export type Article = {
  id: string;
  sourceId: string;
  source: string;
  title: string;
  url: string;
  date: string;
  summary: string;
  content: string;
  image?: string;
  favicon?: string;
};
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  processEntities: true,
  trimValues: true,
});
const array = (value: any): any[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const value = (v: any): string =>
  typeof v === "string" || typeof v === "number"
    ? String(v)
    : v?.["#text"]
      ? String(v["#text"])
      : "";
export function plain(v: any): string {
  return value(v)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li)>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}
export function safeUrl(raw: string, base?: string): string {
  if (!raw.trim()) return "";
  try {
    const u = new URL(raw, base);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
function xml(text: string) {
  if (
    text.length > 6_000_000 ||
    /<!DOCTYPE|<!ENTITY/i.test(text) ||
    XMLValidator.validate(text) !== true
  )
    throw new Error("This is not a valid RSS, Atom, or OPML document.");
  return parser.parse(text);
}
export function parseOpml(text: string): Source[] {
  const root = xml(text);
  if (!root.opml?.body)
    throw new Error("Choose an OPML file containing your subscriptions.");
  const sources: Source[] = [];
  const seen = new Set<string>();
  function walk(nodes: any, category = "Feeds") {
    for (const n of array(nodes)) {
      const url = safeUrl(n["@xmlUrl"] ?? "");
      if (url && !seen.has(url)) {
        seen.add(url);
        sources.push({
          id: url,
          url,
          title: n["@text"] || n["@title"] || new URL(url).hostname,
          category,
        });
      }
      if (n.outline) walk(n.outline, n["@text"] || n["@title"] || category);
    }
  }
  walk(root.opml.body.outline);
  if (!sources.length) throw new Error("No feed URLs were found in this OPML.");
  return sources;
}
export function faviconUrl(url: string): string {
  try {
    return new URL("/favicon.ico", url).href;
  } catch {
    return "";
  }
}
export function relativeTime(date: string, now = Date.now()): string {
  const time = Date.parse(date);
  if (!Number.isFinite(time)) return "";
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return "just now";
  for (const [unit, size] of [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ] as const) {
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}
function feedImage(item: any, base: string): string {
  const media = [
    ...array(item["media:thumbnail"]),
    ...array(item["media:content"]),
    ...array(item["media:group"]?.["media:thumbnail"]),
    ...array(item["media:group"]?.["media:content"]),
  ];
  const enclosure = [
    ...array(item.enclosure),
    ...array(item.link).filter((l) => l["@rel"] === "enclosure"),
  ];
  const candidates = [
    ...media
      .filter((m) => !m["@type"] || String(m["@type"]).startsWith("image/"))
      .map((m) => m["@url"]),
    ...enclosure
      .filter((e) => String(e["@type"] ?? "").startsWith("image/"))
      .map((e) => e["@url"] ?? e["@href"]),
    item.image?.url,
    item.image?.["@href"],
    item["itunes:image"]?.["@href"],
  ];
  for (const body of [
    item["content:encoded"],
    item.content,
    item.description,
    item.summary,
  ]) {
    const html = value(body);
    const match = html.match(
      /<img\b[^>]*?\s(?:src|data-src)\s*=\s*["']([^"']+)["']/i,
    );
    if (match) candidates.push(match[1].replace(/&amp;/g, "&"));
  }
  return (
    candidates
      .map((candidate) => safeUrl(value(candidate), base))
      .find(Boolean) ?? ""
  );
}
export function parseFeedInfo(
  text: string,
  source: Source,
): { title: string; icon: string } {
  const root = xml(text);
  const feed = root.feed ?? root.rss?.channel ?? root["rdf:RDF"];
  if (!feed) throw new Error("The URL did not return an RSS or Atom feed.");
  const site = root.feed
    ? array(feed.link).find(
        (link) => !link["@rel"] || link["@rel"] === "alternate",
      )?.["@href"]
    : value(feed.link);
  return {
    title: plain(feed.title) || source.title,
    icon:
      safeUrl(
        value(
          feed.icon ??
            feed.logo ??
            feed.image?.url ??
            feed["itunes:image"]?.["@href"],
        ),
        source.url,
      ) || faviconUrl(safeUrl(site ?? "", source.url) || source.url),
  };
}
export function parseFeed(text: string, source: Source): Article[] {
  const root = xml(text);
  const atom = root.feed;
  const channel = root.rss?.channel ?? root["rdf:RDF"];
  if (!atom && !channel)
    throw new Error("The URL did not return an RSS or Atom feed.");
  const site = atom
    ? array(atom.link).find((l) => !l["@rel"] || l["@rel"] === "alternate")?.[
        "@href"
      ]
    : value(channel.link);
  const favicon =
    safeUrl(
      value(atom?.icon ?? atom?.logo ?? channel?.image?.url),
      source.url,
    ) ||
    source.icon ||
    faviconUrl(safeUrl(site ?? "", source.url) || source.url);
  return array(atom?.entry ?? channel.item)
    .map((item): Article | null => {
      const link = atom
        ? array(item.link).find(
            (l) => !l["@rel"] || l["@rel"] === "alternate",
          )?.["@href"]
        : value(item.link);
      const url = link ? safeUrl(link, source.url) : "";
      if (!url) return null;
      const content = plain(
        item["content:encoded"] ??
          item.content ??
          item.description ??
          item.summary,
      );
      const rawDate = value(
        item.pubDate ?? item.published ?? item.updated ?? item["dc:date"],
      );
      const time = Date.parse(rawDate);
      return {
        id: `${source.id}::${value(item.guid ?? item.id) || url}`,
        sourceId: source.id,
        source: source.title,
        title: plain(item.title) || "Untitled article",
        url,
        date: Number.isFinite(time) ? new Date(time).toISOString() : "",
        summary: plain(
          item.description ??
            item.summary ??
            item.content ??
            item["content:encoded"],
        )
          .replace(/\s+/g, " ")
          .slice(0, 260),
        content,
        image:
          feedImage(item, url) ||
          safeUrl(
            value(channel?.["itunes:image"]?.["@href"] ?? channel?.image?.url),
            source.url,
          ),
        favicon,
      };
    })
    .filter((a): a is Article => a !== null);
}
export function mergeArticles(
  fresh: Article[],
  old: Article[],
  saved: string[] = [],
): Article[] {
  const map = new Map(old.map((a) => [a.id, a]));
  fresh.forEach((a) => map.set(a.id, a));
  const sorted = [...map.values()].sort(
    (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0),
  );
  return sorted.filter((a, i) => i < 600 || saved.includes(a.id));
}
