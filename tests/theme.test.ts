import { expect, test } from "bun:test";
import { colorsFor, resolveTheme, theme } from "../src/ui/theme";

test("Device follows system appearance and explicit choices override it", () => {
  expect(resolveTheme("device", "dark")).toBe("dark");
  expect(resolveTheme("device", "light")).toBe("light");
  expect(resolveTheme("device", null)).toBe("light");
  expect(resolveTheme("light", "dark")).toBe("light");
  expect(resolveTheme("dark", "light")).toBe("dark");
});
test("both palettes keep yellow controls readable with dark ink", () => {
  for (const scheme of ["light", "dark"] as const) {
    expect(colorsFor(scheme).yellow).toBe(theme.color.yellow);
    expect(colorsFor(scheme).accentInk).toBe(theme.color.ink);
  }
  expect(colorsFor("dark").paper).not.toBe(colorsFor("light").paper);
});
