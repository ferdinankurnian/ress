import { expect, test } from "bun:test";
import {
  exportOpml,
  mergeImportedSources,
  opmlFilename,
  parseOpml,
  summarizeImport,
  type Source,
} from "../src/data/feeds";

test("OPML export round trips titles, categories, and URL entities", () => {
  const sources: Source[] = [
    { id: "a", title: 'News & "things" <today>', category: "Tech & tools", url: "https://example.com/feed?a=1&b=2" },
    { id: "b", title: "Other", category: "Tech & tools", url: "https://other.example/rss" },
    { id: "c", title: "Art", category: "Art", url: "https://art.example/feed" },
  ];
  expect(parseOpml(exportOpml(sources))).toEqual(sources.map(source => ({ ...source, id: source.url })));
});

test("export filenames are dated and stable", () => {
  expect(opmlFilename(new Date("2026-11-04T12:00:00Z"))).toBe("ress-2026-11-04.opml");
});

test("import preview separates new feeds and keeps custom source settings", () => {
  const current: Source[] = [
    { id: "a", title: "My renamed feed", category: "Custom", url: "https://example.com/feed", customIcon: "file://icon.png" },
  ];
  const imported: Source[] = [
    { id: "https://example.com/feed", title: "Original name", category: "Feeds", url: "https://example.com/feed" },
    { id: "https://new.example/rss", title: "New feed", category: "Feeds", url: "https://new.example/rss" },
  ];
  expect(summarizeImport(imported, current)).toEqual({ added: [imported[1]], kept: [imported[0]] });
  const merged = mergeImportedSources(imported, current);
  expect(merged).toHaveLength(2);
  expect(merged[0]).toEqual(current[0]);
  expect(merged[1]).toEqual(imported[1]);
});
