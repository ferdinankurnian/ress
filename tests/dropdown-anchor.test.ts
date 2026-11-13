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
