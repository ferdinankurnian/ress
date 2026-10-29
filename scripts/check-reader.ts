import { chromium, expect } from "@playwright/test";
import { extractionScript } from "../src/reader/extraction.generated";
import { parsePageArticle } from "../src/reader/page";

// Exercise the exact script injected into Android's WebView, without a server.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const paragraph = "This is the full website article, with details that are absent from the RSS summary. It explains the topic in depth so a reader can follow the entire story, rather than only the short feed excerpt. ";
  await page.route("https://publisher.test/**", (route) => route.fulfill({
    contentType: "text/html",
    body: `<html><head><title>A complete website article</title><meta property="og:image" content="/cover.jpg"></head><body>
      <nav>Navigation clutter</nav><article><h1>A complete website article</h1>
      ${Array.from({ length: 8 }, (_, i) => `<p>${paragraph}Paragraph ${i + 1}.</p>`).join("")}
      <h2>More details</h2><p>${paragraph}</p><pre>const answer = 42;\n  answer++;</pre>
      <img src="/missing.jpg" onerror="window.publisherHandlerRan = true"></article><footer>Footer clutter</footer></body></html>`,
  }));
  await page.goto("https://publisher.test/article");
  await page.evaluate(() => {
    (window as any).readerMessages = [];
    (window as any).ReactNativeWebView = { postMessage: (data: string) => (window as any).readerMessages.push(data) };
  });
  const before = await page.content();
  await page.evaluate(extractionScript);
  expect(await page.content()).toBe(before);
  const raw = await page.evaluate(() => (window as any).readerMessages.at(-1));
  const article = parsePageArticle(raw, "https://publisher.test/article");
  expect(article?.title).toBe("A complete website article");
  expect(article?.content).toContain("Paragraph 8.");
  expect(article?.content).toContain("\n\nMore details\n\n");
  expect(article?.content).toContain("const answer = 42;\n  answer++;");
  expect(article?.content).not.toContain("Navigation clutter");
  expect(article?.content).not.toContain("Footer clutter");
  expect(article?.image).toBe("https://publisher.test/cover.jpg");

  // Toggling again must extract the current DOM, including late website updates.
  await page.evaluate(() => {
    const extra = document.createElement("p");
    extra.textContent = "Late website update: this paragraph arrived after the page loaded.";
    document.querySelector("article")!.append(extra);
  });
  await page.evaluate(extractionScript);
  const updated = parsePageArticle(await page.evaluate(() => (window as any).readerMessages.at(-1)));
  expect(updated?.content).toContain("Late website update");

  await page.setContent("<html><body><nav>Home</nav><button>Play episode</button></body></html>");
  await page.evaluate(extractionScript);
  const unavailable = await page.evaluate(() => (window as any).readerMessages.at(-1));
  expect(parsePageArticle(unavailable)).toBeNull();
  console.log("Reader extraction checks passed: full page text, clean blocks, current DOM, safe URLs, unchanged website, and unavailable pages.");
} finally { await browser.close(); }
