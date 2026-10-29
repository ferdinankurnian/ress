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
await page.route("https://www.google.com/s2/favicons**", async (route) =>
  route.fulfill({
    body: await readFile("assets/favicon.png"),
    contentType: "image/png",
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
await expect
  .poll(() =>
    page
      .getByRole("button", { name: "Upload source icon", exact: true })
      .locator("img")
      .getAttribute("src"),
  )
  .toContain("google.com/s2/favicons");
const chooserPromise = page.waitForEvent("filechooser");
await page
  .getByRole("button", { name: "Upload source icon", exact: true })
  .click();
const chooser = await chooserPromise;
await chooser.setFiles("assets/favicon.png");
await expect(
  page.getByRole("button", { name: "Use website icon", exact: true }),
).toBeVisible();

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
await expect(page.getByTestId("page-header")).toHaveCSS(
  "border-bottom-color",
  "rgba(0, 0, 0, 0)",
);
await page.getByRole("button", { name: "All", exact: true }).click();
await page
  .getByRole("button", { name: "Read Story 1", exact: true })
  .evaluate((el) => {
    let parent = el.parentElement;
    while (parent && getComputedStyle(parent).overflowY !== "auto")
      parent = parent.parentElement;
    if (parent) parent.scrollTop = 150;
  });
await expect(page.getByTestId("page-header")).toHaveCSS(
  "border-bottom-color",
  "rgb(213, 213, 197)",
);
await page
  .getByRole("button", { name: "Read Story 1", exact: true })
  .evaluate((el) => {
    let parent = el.parentElement;
    while (parent && getComputedStyle(parent).overflowY !== "auto")
      parent = parent.parentElement;
    if (parent) parent.scrollTop = 0;
  });
await expect(page.getByTestId("page-header")).toHaveCSS(
  "border-bottom-color",
  "rgba(0, 0, 0, 0)",
);
await page.getByRole("button", { name: "Renamed source", exact: true }).click();

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
await expect(page.getByRole("button", { name: "Back to stories", exact: true })).toBeVisible();
await expect(page.getByRole("button", { name: "Show reading mode", exact: true })).toBeVisible();
await page.getByRole("button", { name: "Show reading mode", exact: true }).click();
await expect(page.getByText("Cached feed text", { exact: true })).toBeVisible();
await expect(page.getByTestId("article-reader").getByText("A story for checking the reader.", { exact: true })).toBeVisible();
await expect(page.getByRole("button", { name: "Show web page", exact: true })).toBeVisible();
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
await expect(
  page.getByRole("button", { name: "Open Text size", exact: true }),
).toBeVisible();
await expect(page.getByText("Widget preview", { exact: true })).toHaveCount(0);
await page.screenshot({ path: `${output}/settings.png` });
await page.getByRole("button", { name: "Open Reading", exact: true }).click();
await expect(page.getByRole("radio", { name: "Web page by default", exact: true })).toBeChecked();
await page.getByRole("radio", { name: "Reading mode by default", exact: true }).click();
await expect(page.getByRole("radio", { name: "Reading mode by default", exact: true })).toBeChecked();
await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ress.settings.v1") || "{}").readingMode)).toBe("reading");
await page.screenshot({ path: `${output}/reading-settings.png` });
await page.getByRole("button", { name: "Back to Settings", exact: true }).click();
await page
  .getByRole("button", { name: "Open Text size", exact: true })
  .click();
await page
  .getByRole("radio", { name: "small reading text", exact: true })
  .click();
await expect(
  page.getByRole("radio", { name: "small reading text", exact: true }),
).toBeChecked();
await page.screenshot({ path: `${output}/accessibility.png` });
await page
  .getByRole("button", { name: "Back to Settings", exact: true })
  .click();
await page.getByRole("button", { name: "Open Widget", exact: true }).click();
await expect(
  page.getByText("Each widget has its own settings.", { exact: false }),
).toBeVisible();
await expect(
  page.getByText("Only unread articles", { exact: true }),
).toHaveCount(0);
await page
  .getByRole("button", { name: "Back to Settings", exact: true })
  .click();
await page.getByRole("button", { name: "Open About", exact: true }).click();
await expect(page.getByRole("link", { name: "Ress on GitHub" })).toBeVisible();
await expect(page.getByRole("button", { name: "MIT License", exact: true })).toBeVisible();
await page.screenshot({ path: `${output}/about.png` });
await page
  .getByRole("button", { name: "Back to Settings", exact: true })
  .click();

for (const tab of ["Feed", "Saved", "Sources", "Settings"]) {
  await page.getByRole("tab", { name: tab, exact: true }).click();
  const radius = await page
    .getByRole("tab", { name: tab, exact: true })
    .locator(":scope > div")
    .first()
    .evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toBe("20px");
}
// Repeated navigation must replay a vertical transition and settle fully opaque.
for (const tab of ["Sources", "Settings", "Sources", "Settings"]) {
  await page.getByRole("tab", { name: tab, exact: true }).evaluate((el: HTMLElement) => el.click());
  const scene = page.getByTestId("page-scene");
  await expect.poll(() => scene.evaluate((el) => {
    const matrix = new DOMMatrix(getComputedStyle(el).transform);
    return matrix.m42;
  })).toBeGreaterThan(0);
  expect(await scene.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)).toBe(0);
  await expect(scene).toHaveCSS("opacity", "1");
  if (tab === "Sources") {
    // Hidden swipe actions cannot bleed through the page fade or pressed row.
    for (const action of await page.getByRole("button", { name: /^Remove / }).all())
      await expect(action.locator("..")).toHaveCSS("opacity", "0");
  }
}
await page.getByRole("button", { name: "Open Appearance", exact: true }).click();
// Fast choices must retain the last tap and preserve other preferences.
await page.evaluate(() => {
  for (const label of ["Dark", "Light", "Dark", "Light", "Dark", "Light"])
    (document.querySelector(`[aria-label="${label} theme"]`) as HTMLElement).click();
});
await expect(page.getByRole("radio", { name: "Light theme", exact: true })).toBeChecked();
await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ress.settings.v1") || "{}").theme)).toBe("light");
await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ress.settings.v1") || "{}").readingSize)).toBe("small");
// Appearance choices are exclusive, persistent, and Device responds live.
const currentScheme = () =>
  page.evaluate(() => document.documentElement.style.colorScheme);
await page.getByRole("radio", { name: "Dark theme", exact: true }).click();
await expect.poll(currentScheme).toBe("dark");
await expect(
  page.getByRole("radio", { name: "Dark theme", exact: true }),
).toBeChecked();
await page.screenshot({ path: `${output}/settings-dark.png` });
await page.getByRole("button", { name: "Back to Settings", exact: true }).click();
await page.getByRole("button", { name: "Open Reading", exact: true }).click();
await expect(page.getByRole("radio", { name: "Reading mode by default", exact: true })).toBeChecked();
await page.screenshot({ path: `${output}/reading-settings-dark.png` });
await page.getByRole("button", { name: "Back to Settings", exact: true }).click();
await page.getByRole("tab", { name: "Feed", exact: true }).click();
await page.screenshot({ path: `${output}/feed-dark.png` });
await page.evaluate((url) => localStorage.setItem("ress.reader.v1", JSON.stringify({
  [url]: { type: "ress:article", url, title: "The full website article", byline: "Website author", image: "https://one.test/cover.png",
    content: "This reading copy comes from the original website, beyond the RSS summary. It keeps the full article available in the Ress reader.\n\nA second paragraph from the website." },
})), articles[0].url);
await page.getByRole("button", { name: "Read Story 1", exact: true }).click();
await expect(page.getByRole("button", { name: "Show web page", exact: true })).toBeVisible();
await expect(page.getByText("The full website article", { exact: true })).toBeVisible();
await expect(page.getByText("Cached feed text", { exact: true })).toBeHidden();
await page.screenshot({ path: `${output}/reader-dark.png` });
await page.getByRole("button", { name: "Show web page", exact: true }).click();
await expect(page.getByRole("button", { name: "Show reading mode", exact: true })).toBeVisible();
// An individual toggle must not overwrite the saved default.
await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ress.settings.v1") || "{}").readingMode)).toBe("reading");
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
await page.getByRole("button", { name: "Open Appearance", exact: true }).click();
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

const drawerTitle = page.getByText("Add feed", { exact: true }).first();
const drawerBounds = (await drawerTitle.boundingBox())!;
await page.mouse.move(drawerBounds.x + 20, drawerBounds.y + 10);
await page.mouse.down();
await page.mouse.move(drawerBounds.x + 20, drawerBounds.y + 160, { steps: 15 });
await page.mouse.up();
await expect(page.getByLabel("Close sheet").first()).toBeHidden();
const secondSource = page.getByRole("button", {
  name: "Edit Second source",
  exact: true,
});
const secondBox = (await secondSource.boundingBox())!;
await page.mouse.move(
  secondBox.x + secondBox.width - 20,
  secondBox.y + secondBox.height / 2,
);
await page.mouse.down();
await page.mouse.move(
  secondBox.x + secondBox.width - 120,
  secondBox.y + secondBox.height / 2,
  { steps: 12 },
);
await page.mouse.up();
await expect
  .poll(() =>
    secondSource.evaluate(
      (el) => getComputedStyle(el.parentElement!).transform,
    ),
  )
  .toContain("-76");
await page
  .getByRole("button", { name: "Remove Second source", exact: true })
  .click();
await expect(page.getByText("Remove source?", { exact: true })).toBeVisible();
await page.screenshot({ path: `${output}/confirm-remove.png`, animations: "disabled" });
await page.getByRole("button", { name: "Cancel", exact: true }).click();
await expect(
  page.getByRole("button", { name: "Edit Second source", exact: true }),
).toBeVisible();
await expect(page.getByText("Remove source?", { exact: true })).toBeHidden();
await page
  .getByRole("button", { name: "Remove Second source", exact: true })
  .click();
await page
  .getByRole("button", { name: "Confirm remove source", exact: true })
  .click();
await expect(
  page.getByRole("button", { name: "Edit Second source", exact: true }),
).toHaveCount(0);
// Source icon survives sync, editing and restarting the app.
expect(
  await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ress.sources.v1") || "[]")[0].customIcon,
  ),
).toMatch(/^data:image\/png;base64,/);
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
        "article mode toggle and clearly labeled feed fallback",
        "default reading mode persistence",
        "saved search and persistence",
        "page headers",
        "settings",
        "tab radius",
        "automatic favicon preview and custom icon persistence",
        "reading size submenu",
        "about links",
        "scroll header separator",
        "themed removal dialog",
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
