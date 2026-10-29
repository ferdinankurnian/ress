// Internal static-export regression check; no development server.
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const source = { id: "https://images.test/feed", url: "https://images.test/feed", title: "Image fixtures", category: "Feeds" };
  const articles = Array.from({ length: 24 }, (_, index) => ({
    id: `image-${index}`, sourceId: source.id, source: source.title,
    title: `Thumbnail ${index}${index === 0 ? " A very long headline that should stop after three lines even when the square thumbnail leaves less room for the entire title to wrap" : ""}`, url: `https://images.test/post/${index}`, date: "2026-10-29T12:00:00Z",
    summary: "A card whose thumbnail must keep the same layout while scrolling.", content: "Fixture",
    image: `https://images.test/${index % 2 ? "wide" : "square"}.svg`,
  }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let imageRequests = 0;
  await page.route("https://ress.test/**", async route => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = path.resolve("dist", name === "/" ? "index.html" : `.${name}`);
    if (!file.startsWith(path.resolve("dist") + "/")) return route.abort();
    const mime: Record<string, string> = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".ttf": "font/ttf", ".png": "image/png" };
    try { await route.fulfill({ body: await readFile(file), contentType: mime[path.extname(file)] || "application/octet-stream" }); }
    catch { await route.fulfill({ status: 404, body: "Not found" }); }
  });
  await page.route("https://images.test/**", async route => {
    const url = route.request().url();
    if (!url.endsWith(".svg")) return route.fulfill({ status: 503, body: "Offline fixture" });
    imageRequests++;
    const height = url.endsWith("square.svg") ? 200 : 100;
    // Delay intrinsic size resolution, reproducing the original loading trigger.
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill({ body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="${height}"><rect width="200" height="${height}" fill="#917edd"/></svg>`, contentType: "image/svg+xml" });
  });
  await page.addInitScript(({ source, articles }) => {
    if (!localStorage.getItem("ress.sources.v1")) {
      localStorage.setItem("ress.sources.v1", JSON.stringify([source]));
      localStorage.setItem("ress.articles.v1", JSON.stringify(articles));
      localStorage.setItem("ress.settings.v1", JSON.stringify({ theme: "light" }));
    }
    // Record geometry from the very first frame where an article appears.
    (window as any).thumbnailWidths = [];
    function sample() {
      const card = document.querySelector('[aria-label^="Read Thumbnail 0"]');
      const image = card?.querySelector('[aria-label="Article image"]');
      if (image) (window as any).thumbnailWidths.push(image.parentElement!.getBoundingClientRect().width);
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, { source, articles });
  const square = page.getByRole("button", { name: `Read ${articles[0].title}`, exact: true }).getByLabel("Article image");
  const wide = page.getByRole("button", { name: "Read Thumbnail 1", exact: true }).getByLabel("Article image");
  await mkdir(".hallmark/screenshots", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.goto("https://ress.test/");
    await expect(square).toBeVisible({ timeout: 60000 });
    await expect.poll(() => square.evaluate(el => el.parentElement!.getBoundingClientRect().width)).toBe(72);
    await expect.poll(() => wide.evaluate(el => el.parentElement!.getBoundingClientRect().width)).toBeGreaterThan(250);
    const card = page.getByRole("button", { name: `Read ${articles[0].title}`, exact: true });
    const geometry = await card.evaluate(el => {
      const image = el.querySelector('[aria-label="Article image"]')!.parentElement!.getBoundingClientRect();
      const source = [...el.querySelectorAll("div")].find(node => node.textContent === "Image fixtures" && node.childElementCount === 0)!;
      const sourceRect = source.getBoundingClientRect();
      const title = [...el.querySelectorAll("div")].find(node => node.textContent?.startsWith("Thumbnail 0") && getComputedStyle(node).webkitLineClamp === "3")!;
      return { top: image.top, sourceTop: sourceRect.top, sourceRight: sourceRect.right, imageLeft: image.left,
        titleHeight: title.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(title).lineHeight) };
    });
    expect(Math.abs(geometry.top - geometry.sourceTop)).toBeLessThan(3);
    expect(geometry.sourceRight).toBeLessThan(geometry.imageLeft);
    expect(geometry.titleHeight).toBeLessThanOrEqual(geometry.lineHeight * 3 + 1);
    const bookmark = await card.getByRole("button", { name: "Save article", exact: true }).boundingBox();
    const cardBox = await card.boundingBox();
    const imageBox = await square.boundingBox();
    expect(bookmark).not.toBeNull();
    expect(Math.abs(bookmark!.x + bookmark!.width - cardBox!.x - cardBox!.width)).toBeLessThan(1);
    expect(bookmark!.y).toBeGreaterThanOrEqual(imageBox!.y + imageBox!.height);
    await page.screenshot({ path: `.hallmark/screenshots/thumbnails-${theme}.png` });
    await page.mouse.move(200, 600);
    await page.mouse.wheel(0, 2400);
    await page.getByRole("button", { name: `Read ${articles[0].title}`, exact: true }).scrollIntoViewIfNeeded();
    await expect(square).toBeVisible();
    expect(await page.evaluate(() => (window as any).thumbnailWidths.every((width: number) => width === 72))).toBe(true);
    await page.getByRole("tab", { name: "Saved", exact: true }).click();
    await page.getByRole("tab", { name: "Feed", exact: true }).click();
    await expect(square).toBeVisible();
    expect(await square.evaluate(el => el.parentElement!.getBoundingClientRect().width)).toBe(72);
    await page.evaluate(() => localStorage.setItem("ress.settings.v1", JSON.stringify({ theme: "dark" })));
  }
  expect(errors).toEqual([]);
  expect(imageRequests).toBeGreaterThanOrEqual(2);
  console.log("Thumbnail checks passed: first-frame geometry, slow images, scroll, remount, reload, light and dark.");
} finally {
  await browser.close();
}
