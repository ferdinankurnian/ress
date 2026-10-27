import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseFeed } from "../src/data/feeds";
const output = ".hallmark/screenshots";
await mkdir(output, { recursive: true });
const sources = [
  {
    id: "https://one.test/feed",
    url: "https://one.test/feed",
    title: "First source",
    category: "Feeds",
  },
  {
    id: "https://two.test/feed",
    url: "https://two.test/feed",
    title: "Second source",
    category: "Feeds",
  },
];
const feeds = sources.map((source, index) => ({
  source,
  xml: `<rss><channel><title>${source.title}</title><link>https://one.test</link><image><url>https://one.test/icon.png</url></image><item><guid>${index}</guid><title>Story ${index + 1}</title><link>https://one.test/post${index}</link><pubDate>Wed, 28 Oct 2026 00:00:00 GMT</pubDate><description>A story for checking the reader.</description><media:thumbnail url="https://one.test/cover.png"/></item></channel></rss>`,
}));
const articles = feeds.flatMap(({ source, xml }) => parseFeed(xml, source));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});
const errors: string[] = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.error(e.message);
});
const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".json": "application/json",
};
await page.route("https://ress.test/**", async (route) => {
  const name = decodeURIComponent(new URL(route.request().url()).pathname);
  const file = path.resolve("dist", name === "/" ? "index.html" : `.${name}`);
  if (!file.startsWith(path.resolve("dist") + "/")) return route.abort();
  try {
    await route.fulfill({
      body: await readFile(file),
      contentType: mime[path.extname(file)] || "application/octet-stream",
    });
  } catch {
    await route.fulfill({ status: 404, body: "Not found" });
  }
});
await page.route("https://one.test/**", async (route) =>
  route.fulfill({
    body: await readFile("assets/icon.png"),
    contentType: "image/png",
    headers: { "access-control-allow-origin": "*" },
  }),
);
for (const feed of feeds)
  await page.route(feed.source.url, (route) =>
    route.fulfill({
      body: feed.xml,
      contentType: "application/xml",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
// A new installation must start empty, with no implicit network subscriptions.
await page.goto("https://ress.test/");
await expect(
  page.getByText("Your feed starts here.", { exact: true }),
).toBeVisible({ timeout: 60000 });
await expect(page.getByRole("textbox")).toHaveCount(0);
await page.screenshot({ path: `${output}/fresh-install.png` });
await page.getByRole("tab", { name: "Sources", exact: true }).click();
await page.getByRole("button", { name: "Add source", exact: true }).click();
await page.getByRole("button", { name: "Add feed", exact: true }).click();
await expect(page.getByLabel("Close source menu")).toBeHidden();
await expect(page.getByRole("textbox", { name: "Feed URL" })).toBeVisible();
await page.getByRole("textbox", { name: "Source name" }).fill(sources[0].title);
await page.getByRole("textbox", { name: "Feed URL" }).fill(sources[0].url);
await page.getByRole("button", { name: "Add feed", exact: true }).click();
await expect(
  page.getByRole("button", { name: `Edit ${sources[0].title}` }),
).toBeVisible();
await page.getByRole("button", { name: `Edit ${sources[0].title}` }).click();
await page.getByRole("textbox", { name: "Source name" }).fill("Renamed source");
await page.getByRole("button", { name: "Save changes", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Edit Renamed source" }),
).toBeVisible();
await page.getByRole("button", { name: "Add source", exact: true }).click();
await page.getByRole("button", { name: "Add feed", exact: true }).click();
await expect(page.getByLabel("Close source menu")).toBeHidden();
await page.getByRole("textbox", { name: "Feed URL" }).fill(sources[1].url);
await page.getByRole("button", { name: "Add feed", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Edit Second source" }),
).toBeVisible();
await expect(page.getByLabel("Close sheet").first()).toBeHidden();
await page.screenshot({ path: `${output}/sources.png` });
const swipeTarget = page.getByRole("button", {
  name: "Edit Renamed source",
  exact: true,
});
await expect(swipeTarget).toBeEnabled();
const box = (await swipeTarget.boundingBox())!;
await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 120, box.y + box.height / 2, {
  steps: 12,
});
await page.mouse.up();
await expect
  .poll(() =>
    swipeTarget.evaluate((el) => getComputedStyle(el.parentElement!).transform),
  )
  .toContain("-76");
await page.screenshot({ path: `${output}/source-swipe.png` });

await page.getByRole("tab", { name: "Feed", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Read Story 2", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Renamed source", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Read Story 2", exact: true }),
).toHaveCount(0);
await expect(page.getByLabel("Article image")).toBeVisible();
await page.screenshot({ path: `${output}/feed.png` });
await page
  .getByRole("button", { name: "Save article", exact: true })
  .first()
  .click();
await page.getByRole("tab", { name: "Saved", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Refresh feeds", exact: true }),
).toHaveCount(0);
await expect(
  page.getByRole("button", { name: "Read Story 1", exact: true }),
).toBeVisible();
await page.getByRole("button", { name: "Read Story 1", exact: true }).click();
await expect(page.getByText("The reading room", { exact: true })).toBeVisible();
await page.screenshot({ path: `${output}/reader.png` });
await page
  .getByRole("button", { name: "Back to stories", exact: true })
  .click();
await page.reload();
await expect(page.getByRole("tab", { name: "Saved", exact: true })).toBeVisible(
  { timeout: 60000 },
);
await page.getByRole("tab", { name: "Saved", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Read Story 1", exact: true }),
).toBeVisible();
await page
  .getByRole("textbox", { name: "Search saved articles" })
  .fill("no-such-story");
await expect(
  page.getByText("No stories match.", { exact: true }),
).toBeVisible();
await page.getByRole("tab", { name: "Settings", exact: true }).click();
await expect(page.getByText("Reading", { exact: true })).toBeVisible();
await expect(page.getByText("Widget preview", { exact: true })).toHaveCount(0);
await page.screenshot({ path: `${output}/settings.png` });
for (const tab of ["Feed", "Saved", "Sources", "Settings"]) {
  await page.getByRole("tab", { name: tab, exact: true }).click();
  const radius = await page
    .getByRole("tab", { name: tab, exact: true })
    .locator(":scope > div")
    .first()
    .evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toBe("20px");
}
// Appearance choices are exclusive, persistent, and Device responds live.
const currentScheme = () =>
  page.evaluate(() => document.documentElement.style.colorScheme);
await page.getByRole("radio", { name: "Dark theme", exact: true }).click();
await expect.poll(currentScheme).toBe("dark");
await expect(
  page.getByRole("radio", { name: "Dark theme", exact: true }),
).toBeChecked();
await page.screenshot({ path: `${output}/settings-dark.png` });
await page.getByRole("tab", { name: "Feed", exact: true }).click();
await page.screenshot({ path: `${output}/feed-dark.png` });
await page.getByRole("button", { name: "Read Story 1", exact: true }).click();
await page.screenshot({ path: `${output}/reader-dark.png` });
await page
  .getByRole("button", { name: "Back to stories", exact: true })
  .click();
await page.reload();
await expect(
  page.getByRole("tab", { name: "Settings", exact: true }),
).toBeVisible({ timeout: 60000 });
await expect.poll(currentScheme).toBe("dark");
await page.getByRole("tab", { name: "Settings", exact: true }).click();
await page.emulateMedia({ colorScheme: "dark" });
await page.getByRole("radio", { name: "Light theme", exact: true }).click();
await expect.poll(currentScheme).toBe("light");
await page.getByRole("radio", { name: "Device theme", exact: true }).click();
await expect.poll(currentScheme).toBe("dark");
await page.emulateMedia({ colorScheme: "light" });
await expect.poll(currentScheme).toBe("light");
await page.getByRole("radio", { name: "Dark theme", exact: true }).click();
await expect.poll(currentScheme).toBe("dark");
await page.getByRole("tab", { name: "Sources", exact: true }).click();
await page.getByRole("button", { name: "Add source", exact: true }).click();
await page.getByRole("button", { name: "Add feed", exact: true }).click();
await expect(page.getByLabel("Close source menu")).toBeHidden();
await expect(page.getByRole("textbox", { name: "Feed URL" })).toBeVisible();
await page.screenshot({
  path: `${output}/source-sheet-dark.png`,
  animations: "disabled",
});
await writeFile(
  ".hallmark/ui-check.json",
  JSON.stringify(
    {
      checked: new Date().toISOString(),
      checks: [
        "empty install",
        "add feed",
        "automatic source name",
        "edit source",
        "source filter",
        "source swipe",
        "article image",
        "reader",
        "saved search and persistence",
        "page headers",
        "settings",
        "tab radius",
        "dark and light themes",
        "theme persistence",
        "live device theme",
      ],
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(`UI checks passed. Screenshots: ${output}`);
