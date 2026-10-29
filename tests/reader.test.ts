import { expect, test } from "bun:test";
import { matchesReaderOrigin, parsePageArticle } from "../src/reader/page";

const message = {
  type: "ress:article", url: "https://site.test/post", title: "Full article",
  content: "This text came from the original website, beyond the RSS excerpt. ".repeat(4),
  byline: "Author", image: "/hero.jpg",
};
test("reader accepts website text and resolves relative HTTP images", () => {
  expect(parsePageArticle(JSON.stringify(message), message.url)).toEqual({
    url: message.url, title: message.title, content: message.content,
    byline: message.byline, image: "https://site.test/hero.jpg",
  });
});
test("reader rejects stale pages, unsafe URLs, malformed messages, and non-articles", () => {
  expect(parsePageArticle(JSON.stringify(message), "https://site.test/other")).toBeNull();
  for (const patch of [{ url: "javascript:alert(1)" }, { content: "Only a headline" }, { title: {} }, { type: "other" }, { url: 9 }])
    expect(parsePageArticle(JSON.stringify({ ...message, ...patch }))).toBeNull();
  expect(parsePageArticle("bad JSON")).toBeNull();
  expect(parsePageArticle(undefined as unknown as string)).toBeNull();
  expect(parsePageArticle(JSON.stringify({ ...message, image: "javascript:alert(1)" }))?.image).toBe("");
});
test("reader bounds content accepted from a webpage", () => {
  expect(parsePageArticle(JSON.stringify({ ...message, content: "x".repeat(160_000) }))?.content.length).toBe(150_000);
  expect(parsePageArticle("x".repeat(600_001))).toBeNull();
});

test("Android origin-only message events accept the current article but reject other origins and stale paths", () => {
  expect(matchesReaderOrigin("https://site.test", message.url)).toBe(true);
  expect(matchesReaderOrigin(message.url, message.url)).toBe(true);
  expect(matchesReaderOrigin("https://other.test", message.url)).toBe(false);
  expect(matchesReaderOrigin("http://site.test", message.url)).toBe(false);
  expect(matchesReaderOrigin("invalid", message.url)).toBe(false);
  expect(parsePageArticle(JSON.stringify(message), "https://site.test/newer")).toBeNull();
});
