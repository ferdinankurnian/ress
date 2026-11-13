import { test, expect } from "bun:test";
import { resolveDropdownAnchor } from "../src/ui/dropdownAnchor";

const win = { width: 412, height: 915 };

test("pointer anchor sits under the chip and pivots from the icon", () => {
  const r = resolveDropdownAnchor({ kind: "pointer", pageX: 172, pageY: 131 }, win);
  expect(r.style.top).toBe(139);
  expect(r.style.left).toBe(152);
  expect(r.transformOrigin).toBe("180px 139px");
});

test("pointer anchor clamps to stay on screen", () => {
  const r = resolveDropdownAnchor({ kind: "pointer", pageX: 400, pageY: 900 }, win);
  expect(r.style.left).toBe(412 - 208);
  expect(r.style.top).toBe(915 - 200);
});

test("bar anchor clears the toolbar", () => {
  const r = resolveDropdownAnchor({ kind: "bar", edge: "top", right: 16, barHeight: 60 }, win);
  expect(r.style.top).toBe(64);
  expect(r.style.right).toBe(16);
  expect(r.transformOrigin).toBe("top right");
});

test("menu pivots from the chip, not the touch point", () => {
  // A chip at x=60..124 touched near its right edge still pivots from the icon.
  const r = resolveDropdownAnchor({ kind: "pointer", pageX: 92, pageY: 100 }, win);
  expect(r.style.top).toBe(108);
  expect(r.transformOrigin.endsWith("108px")).toBe(true);
  const pivotX = Number(r.transformOrigin.split(" ")[0].replace("px", ""));
  // Pivot sits inside the chip's horizontal span, so the box grows out of it.
  expect(pivotX).toBeGreaterThanOrEqual(60);
  expect(pivotX).toBeLessThanOrEqual(124);
});
