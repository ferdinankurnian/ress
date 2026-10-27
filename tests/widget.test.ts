import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { XMLValidator } from "fast-xml-parser";
import { widgetImage } from "../src/widget/images";

test("widget placeholder preserves the native renderer's view IDs", async () => {
  const root = await mkdtemp(join(tmpdir(), "ress-widget-"));
  try {
    const plugin = require("../plugins/with-widget-placeholder.cjs");
    const config = plugin({ name: "Ress", slug: "ress" });
    await config.mods.android.dangerous({
      modRequest: { platformProjectRoot: root },
    });
    const layout = await readFile(
      join(root, "app/src/main/res/layout/rn_widget.xml"),
      "utf8",
    );
    expect(XMLValidator.validate(layout)).toBe(true);
    for (const id of [
      "rn_widget_image_light",
      "rn_widget_image_dark",
      "rn_widget_clickable_container",
      "rn_widget_collection_container",
    ])
      expect(layout).toContain(`@+id/${id}`);
    expect(layout).toContain("Loading your feeds");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("widget images become bounded inline data; bad responses fall back to text", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      })) as unknown as typeof fetch;
    expect(await widgetImage("https://widget.test/good.png")).toBe(
      "data:image/png;base64,AQID",
    );
    globalThis.fetch = (async () =>
      new Response("not an image", {
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;
    expect(await widgetImage("https://widget.test/bad.png")).toBe("");
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await widgetImage("https://widget.test/offline.png")).toBe("");
    expect(await widgetImage()).toBe("");
  } finally {
    globalThis.fetch = original;
  }
});
