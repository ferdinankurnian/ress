import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  mergeArticles,
  parseFeed,
  parseOpml,
  plain,
  safeUrl,
  relativeTime,
} from "../src/data/feeds";
const source = {
  id: "https://iydheko.dev/rss.xml",
  url: "https://iydheko.dev/rss.xml",
  title: "Test feed",
  category: "Feeds",
};
describe("OPML", () => {
  test("preserves all five supplied subscriptions and nested categories", () => {
    const result = parseOpml(
      readFileSync("tests/fixtures/subscriptions.opml", "utf8"),
    );
    expect(result).toHaveLength(5);
    expect(result[0].url).toBe(source.url);
  });
  test("deduplicates feeds and rejects executable URLs", () => {
    expect(
      parseOpml(
        '<opml><body><outline xmlUrl="https://a.test/rss"/><outline xmlUrl="https://a.test/rss"/><outline xmlUrl="javascript:alert(1)"/></body></opml>',
      ),
    ).toHaveLength(1);
  });
  test("rejects empty, broken XML and entity declarations", () => {
    for (const text of [
      "<html>oops</html>",
      "<opml>",
      "<opml><body/></opml>",
      "<!DOCTYPE x><opml><body/></opml>",
    ])
      expect(() => parseOpml(text)).toThrow();
  });
});
describe("feed formats", () => {
  test("RSS content, stable IDs, dates and encoded text", () => {
    const [a] = parseFeed(
      "<rss><channel><item><guid>stable</guid><title>A &amp; B</title><link>https://example.com/post</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate><content:encoded><![CDATA[<p>Hello</p><p>World</p>]]></content:encoded></item></channel></rss>",
      source,
    );
    expect(a.title).toBe("A & B");
    expect(a.content).toBe("Hello\n\nWorld");
    expect(a.id).toBe(`${source.id}::stable`);
    expect(a.date).toBe("2026-10-26T10:00:00.000Z");
  });
  test("Atom chooses alternate link, resolves relative URLs, tolerates bad dates", () => {
    const [a] = parseFeed(
      '<feed><entry><id>1</id><title>Release</title><link rel="self" href="/api"/><link rel="alternate" href="/release"/><updated>bad</updated><content type="html">&lt;p&gt;Release notes&lt;/p&gt;</content></entry></feed>',
      source,
    );
    expect(a.url).toBe("https://iydheko.dev/release");
    expect(a.date).toBe("");
    expect(a.content).toBe("Release notes");
  });
  test("removes active content and unsafe links", () => {
    expect(plain("<script>bad()</script><style>bad</style><p>Hello</p>")).toBe(
      "Hello",
    );
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(
      parseFeed(
        "<rss><channel><item><title>Bad</title><link>javascript:alert(1)</link></item></channel></rss>",
        source,
      ),
    ).toEqual([]);
  });
  test("rejects an HTML error page; accepts an empty valid feed", () => {
    expect(() => parseFeed("<html/>", source)).toThrow();
    expect(
      parseFeed("<rss><channel><title>Empty</title></channel></rss>", source),
    ).toEqual([]);
  });
});
test("merge keeps cached stories on partial failure, updates duplicates and retains saved overflow", () => {
  const base = {
    id: "old",
    sourceId: source.id,
    source: source.title,
    title: "Old",
    url: source.url,
    date: "",
    content: "",
    summary: "",
  };
  const old = Array.from({ length: 605 }, (_, i) => ({
    ...base,
    id: String(i),
  }));
  const result = mergeArticles([{ ...old[0], title: "Updated" }], old, ["604"]);
  expect(result).toHaveLength(601);
  expect(result[0].title).toBe("Updated");
  expect(result.some((a) => a.id === "604")).toBe(true);
});

test("extracts RSS media, enclosure and HTML images with site favicon", () => {
  for (const media of [
    '<media:thumbnail url="/cover.jpg"/>',
    '<enclosure type="image/png" url="/cover.jpg"/>',
    '<description><![CDATA[<img src="/cover.jpg">]]></description>',
  ]) {
    const [article] = parseFeed(
      `<rss><channel><link>https://site.test</link><item><link>https://site.test/post</link>${media}</item></channel></rss>`,
      source,
    );
    expect(article.image).toBe("https://site.test/cover.jpg");
    expect(article.favicon).toBe("https://site.test/favicon.ico");
  }
});
test("extracts Atom icon and image enclosures; skips unsafe images", () => {
  const [article] = parseFeed(
    '<feed><icon>https://site.test/icon.png</icon><entry><link href="https://site.test/post"/><link rel="enclosure" type="image/jpeg" href="/photo.jpg"/></entry></feed>',
    source,
  );
  expect(article.favicon).toBe("https://site.test/icon.png");
  expect(article.image).toBe("https://site.test/photo.jpg");
  const [bad] = parseFeed(
    '<rss><channel><item><link>https://site.test/post</link><media:thumbnail url="javascript:bad"/></item></channel></rss>',
    source,
  );
  expect(bad.image).toBe("");
});
test("relative timestamps handle plural, future and missing dates", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  expect(relativeTime("2026-10-26T12:00:00Z", now)).toBe("2 days ago");
  expect(relativeTime("2026-10-28T09:00:00Z", now)).toBe("3 hours ago");
  expect(relativeTime("2026-10-28T11:00:00Z", now)).toBe("1 hour ago");
  expect(relativeTime("2026-10-29T00:00:00Z", now)).toBe("just now");
  expect(relativeTime("", now)).toBe("");
});
