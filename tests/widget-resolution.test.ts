import { expect, test } from "bun:test";
import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

const { resolve } = require("metro-resolver");
const { resolver } = require("../metro.config.js");
function resolveBridge(platform: string) {
  const result = resolve(
    {
      originModulePath: path.resolve("index.ts"),
      sourceExts: resolver.sourceExts,
      preferNativePlatform: true,
      mainFields: resolver.resolverMainFields,
      getPackageForModule: () => null,
      isAssetFile: () => false,
      fileSystemLookup: (file: string) =>
        existsSync(file)
          ? {
              exists: true,
              type: statSync(file).isDirectory() ? "d" : "f",
              realPath: realpathSync(file),
            }
          : { exists: false },
    },
    "./src/widget/bridge",
    platform,
  );
  return path.relative(process.cwd(), result.filePath);
}
test("Metro includes the real Android widget bridge in Android bundles", () => {
  expect(resolveBridge("android")).toBe("src/widget/bridge.android.tsx");
});
test("web and iOS use the platform fallback without loading Android native APIs", () => {
  expect(resolveBridge("web")).toBe("src/widget/bridge.tsx");
  expect(resolveBridge("ios")).toBe("src/widget/bridge.tsx");
});
