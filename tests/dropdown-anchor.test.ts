import { test, expect } from "bun:test";
import { resolveDropdownAnchor } from "../src/ui/dropdownAnchor";

const win = { width: 412, height: 915 };

function pivotX(transformOrigin: string) {
  return Number(transformOrigin.split(" ")[0].replace("px", ""));
}

test("pointer anchor sits under the chip and pivots from the icon", () => {
  const r = resolveDropdownAnchor(
    { kind: "pointer", pageX: 172, pageY: 131, align: "center", width: 220 },
    win,
  );
  expect(r.style.top).toBe(137);
  // Centered on the trigger, then kept on screen.
  expect(r.style.left).toBe(172 - 110);
  expect(pivotX(r.transformOrigin)).toBe(110);
});

test("pointer anchor clamps to stay on screen", () => {
  const r = resolveDropdownAnchor(
    { kind: "pointer", pageX: 400, pageY: 900, width: 220 },
    win,
  );
  expect(r.style.left).toBe(412 - 220 - 12);
  expect(r.style.top).toBe(915 - 280);
});

test("bar anchor clears the toolbar", () => {
  const r = resolveDropdownAnchor(
    { kind: "bar", edge: "top", right: 16, barHeight: 60 },
    win,
  );
  expect(r.style.top).toBe(64);
  expect(r.style.right).toBe(16);
  expect(r.transformOrigin).toBe("top right");
});

test("menu pivots from the chip, not the touch point", () => {
  // A chip at x=60..124 touched near its right edge still pivots from the icon.
  const r = resolveDropdownAnchor(
    { kind: "pointer", pageX: 92, pageY: 100, align: "center", width: 220 },
    win,
  );
  expect(r.style.top).toBe(106);
  // Pivot sits inside the chip's horizontal span, so the box grows out of it.
  expect(pivotX(r.transformOrigin)).toBeGreaterThanOrEqual(60);
  expect(pivotX(r.transformOrigin)).toBeLessThanOrEqual(124);
});

test("align picks which box edge touches the trigger", () => {
  const start = resolveDropdownAnchor(
    { kind: "pointer", pageX: 100, pageY: 100, align: "start", width: 220 },
    win,
  );
  const end = resolveDropdownAnchor(
    { kind: "pointer", pageX: 100, pageY: 100, align: "end", width: 220 },
    win,
  );
  expect(start.style.left).toBe(100);
  // Clamped, never off the left edge.
  expect(end.style.left).toBe(12);
  expect(pivotX(start.transformOrigin)).toBe(0);
  // Pivot follows the clamped box, still on the trigger side of the menu.
  expect(pivotX(end.transformOrigin)).toBe(88);
});

test("each chip anchors to its own position", () => {
  const a = resolveDropdownAnchor(
    { kind: "pointer", pageX: 40, pageY: 100, align: "center", width: 220 },
    win,
  );
  const b = resolveDropdownAnchor(
    { kind: "pointer", pageX: 300, pageY: 100, align: "center", width: 220 },
    win,
  );
  expect(a.style.left).not.toBe(b.style.left);
});

test("anchor above flips the pivot to the bottom edge", () => {
  const r = resolveDropdownAnchor(
    { kind: "pointer", pageX: 200, pageY: 600, align: "center", above: true },
    win,
  );
  expect(r.transformOrigin.endsWith("bottom")).toBe(true);
});
