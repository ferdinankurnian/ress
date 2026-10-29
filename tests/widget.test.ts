import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
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
    const native = await readFile(join(root, "app/src/main/res/layout/ress_native_content_light.xml"), "utf8");
    expect(native).toContain('android:padding="16dp"');
    for (const font of ["ress_hanken", "ress_hanken_bold", "ress_vollkorn"])
      expect((await readFile(join(root, `app/src/main/res/font/${font}.ttf`))).length).toBeGreaterThan(1000);
    expect(layout).not.toContain('android:scaleType="matrix"');
    expect(layout.match(/android:scaleType="fitXY"/g)).toHaveLength(2);
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

test("real widget runtime registers headless work and dispatches serialized native views", async () => {
  const child = Bun.spawn(
    [process.execPath, "tests/fixtures/widget-runtime.tsx"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`${stdout}\n${stderr}`);
  expect(stdout).toContain("foreground updates passed");
});

// Native rows contain text and images separately so host width changes reflow
// the text instead of stretching a bitmap. Refresh's icon and ripple share a view.
test("native widget insets belong to header and rows, leaving the scroll viewport edge-to-edge", async () => {
  const root = "plugins/widget/res";
  const parser = new XMLParser({ ignoreAttributes: false });
  for (const name of ["ress_native_row", "ress_native_row_square"]) {
    const row = await readFile(`${root}/layout/${name}.xml`, "utf8");
    expect(XMLValidator.validate(row)).toBe(true);
    expect(row).toContain('@font/ress_hanken_bold');
    expect(row).toContain('android:layout_weight="1"');
    expect(row).not.toContain('fitXY');
    expect(row).toContain('android:gravity="top"');
    const article = parser.parse(row).LinearLayout;
    expect(article["@_android:paddingStart"]).toBe("16dp");
    expect(article["@_android:paddingEnd"]).toBe("16dp");
    expect(article.LinearLayout["@_android:paddingTop"]).toBe("16dp");
    expect(article.LinearLayout["@_android:paddingBottom"]).toBe("16dp");
  }
  for (const mode of ["light", "dark"]) {
    const xml = await readFile(`${root}/layout/ress_native_content_${mode}.xml`, "utf8");
    expect(XMLValidator.validate(xml)).toBe(true);
    const surface = parser.parse(xml).LinearLayout;
    expect(surface["@_android:padding"]).toBeUndefined();
    expect(surface["@_android:clipToOutline"]).toBe("true");
    expect(surface.LinearLayout["@_android:paddingLeft"]).toBe("16dp");
    for (const side of ["Top", "Right", "Bottom"])
      expect(surface.LinearLayout[`@_android:padding${side}`]).toBe("4dp");
    expect(surface.LinearLayout["@_android:layout_height"]).toBe("48dp");
    expect(surface.LinearLayout["@_android:gravity"]).toBe("center_vertical");
    expect(surface.ListView["@_android:layout_width"]).toBe("match_parent");
    expect(surface.ListView["@_android:layout_weight"]).toBe("1");
    expect(surface.ListView["@_android:padding"]).toBe("0dp");
    expect(surface.ListView["@_android:scrollbarStyle"]).toBe("insideOverlay");
    expect(xml.match(/@\+id\/ress_refresh/g)).toHaveLength(1);
    expect(xml).toContain('@drawable/ress_native_ripple');
  }
  for (const variant of ["layout", "layout-night"]) {
    const layout = await readFile(`${root}/${variant}/ress_native_widget.xml`, "utf8");
    expect(XMLValidator.validate(layout)).toBe(true);
  }
});

// The provider's filename allowlist is an integration contract, not a naming
// convention: an extra suffix aborts the entire native widget render.
test("native thumbnails and favicons use names accepted by the image provider", async () => {
  const root = "node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget";
  const provider = await readFile(`${root}/RNWidgetImageProvider.java`, "utf8");
  const renderer = await readFile(`${root}/RessNativeWidget.java`, "utf8");
  const literal = provider.match(/IMAGE_NAME = Pattern\.compile\(\s*("(?:\\.|[^"\\])*")/);
  expect(literal).not.toBeNull();
  const allowed = new RegExp(`^(?:${JSON.parse(literal![1]!)})$`);
  for (const mode of ["light", "dark"]) {
    for (const widgetId of [1, 142]) {
      for (let row = 0; row < 10; row++) {
        const prefix = `widget_${widgetId}_mode_${mode}_collection_0_${row}`;
        expect(allowed.test(`${prefix}_${"a".repeat(64)}.png`)).toBe(true);
        expect(allowed.test(`${prefix}_icon_${"a".repeat(64)}.png`)).toBe(false);
      }
    }
  }
  expect(renderer).toContain('"favicon", save(c, prefix,');
  expect(renderer).toContain('"image", save(c, prefix,');
});

test("refresh intents supply a bundle and the receiver accepts missing data", async () => {
  const root = "node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget";
  const renderer = await readFile(`${root}/RessNativeWidget.java`, "utf8");
  const receiver = await readFile(`${root}/RNWidgetProvider.java`, "utf8");
  expect(renderer).toContain('if (!mutable) intent.putExtra("clickActionData", new Bundle());');
  const guard = receiver.indexOf("if (clickActionData == null) clickActionData = new Bundle();");
  expect(guard).toBeGreaterThan(-1);
  expect(guard).toBeLessThan(receiver.indexOf("Arguments.fromBundle(clickActionData)"));
});


test("native list adapters are attached at the AppWidget root with distinct theme IDs", async () => {
  const source = await readFile("node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RessNativeWidget.java", "utf8");
  expect(source).toContain("root.setRemoteAdapter(list, adapter)");
  expect(source).not.toContain("view.setRemoteAdapter(");
  for (const mode of ["light", "dark"]) {
    const layout = await readFile(`plugins/widget/res/layout/ress_native_content_${mode}.xml`, "utf8");
    expect(layout).toContain(`@+id/ress_list_${mode}`);
  }
});


test("native adapter declares both rectangle and square row layouts", async () => {
  const source = await readFile("node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RessNativeWidget.java", "utf8");
  expect(source).toContain('"row_square" : "row"');
  expect(source).toContain("public int getViewTypeCount() { return 2; }");
});

test("square widget details share a top-aligned row with a 72dp thumbnail", async () => {
  const parser = new XMLParser({ ignoreAttributes: false });
  const xml = await readFile("plugins/widget/res/layout/ress_native_row_square.xml", "utf8");
  const row = parser.parse(xml).LinearLayout.LinearLayout.LinearLayout;
  expect(row["@_android:gravity"]).toBe("top");
  expect(row.ImageView["@_android:layout_width"]).toBe("72dp");
  expect(row.ImageView["@_android:layout_height"]).toBe("72dp");
  expect(row.LinearLayout["@_android:layout_weight"]).toBe("1");
  expect(row.LinearLayout.LinearLayout.TextView["@_android:id"]).toBe("@+id/ress_source");
  expect(row.LinearLayout.TextView[0]["@_android:maxLines"]).toBe("3");
  const standard = parser.parse(await readFile("plugins/widget/res/layout/ress_native_row.xml", "utf8")).LinearLayout.LinearLayout;
  expect(standard.ImageView["@_android:layout_width"]).toBe("match_parent");
  expect(standard.ImageView["@_android:adjustViewBounds"]).toBe("true");
});
