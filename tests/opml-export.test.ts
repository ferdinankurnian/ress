import { expect, test } from "bun:test";
import { exportOpml, parseOpml, type Source } from "../src/data/feeds";

test("OPML export round trips titles, categories, and URL entities", () => {
  const sources: Source[] = [
    { id: "a", title: 'News & "things" <today>', category: "Tech & tools", url: "https://example.com/feed?a=1&b=2" },
    { id: "b", title: "Other", category: "Tech & tools", url: "https://other.example/rss" },
    { id: "c", title: "Art", category: "Art", url: "https://art.example/feed" },
  ];
  expect(parseOpml(exportOpml(sources))).toEqual(sources.map(source => ({ ...source, id: source.url })));
});
