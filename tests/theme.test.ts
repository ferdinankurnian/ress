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

test("plain backgrounds are neutral in both schemes and preserve the accent", () => {
  expect(colorsFor("light", "plain").paper).toBe("#FFFFFF");
  expect(colorsFor("dark", "plain").paper).toBe("#000000");
  for (const scheme of ["light", "dark"] as const) {
    const plain = colorsFor(scheme, "plain");
    expect(plain.yellow).toBe(theme.color.yellow);
    expect(plain.accentInk).toBe(theme.color.accentInk);
    for (const key of ["paper", "surface", "ink", "muted", "rule"] as const) {
      const hex = plain[key].slice(1);
      expect(hex.slice(0, 2)).toBe(hex.slice(2, 4));
      expect(hex.slice(2, 4)).toBe(hex.slice(4, 6));
    }
    expect(colorsFor(scheme)).toBe(colorsFor(scheme, "warm"));
  }
});
