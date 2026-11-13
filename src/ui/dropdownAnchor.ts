import type { ViewStyle } from "react-native";

/** Roughly how wide a menu renders. Only used to keep menus on screen. */
const MENU_WIDTH = 208;
/** Half of a 64px source chip's icon, so context menus grow out of the icon. */
const CHIP_ICON_INSET = 28;
/** Above this a menu would run off the bottom edge. */
const MENU_MAX_HEIGHT = 200;

/** Where a dropdown is drawn. Callers describe intent; this file does the math. */
export type DropdownAnchor =
  /** Just under the pressed element, clamped to stay on screen. */
  | { kind: "pointer"; pageX: number; pageY: number }
  /** Fixed offsets, for menus pinned near a screen edge. */
  | { kind: "fixed"; top?: number; bottom?: number; left?: number; right?: number }
  /** An edge plus the height of the bar the menu hangs from. */
  | {
      kind: "bar";
      edge: "top" | "bottom";
      left?: number;
      right?: number;
      barHeight: number;
    };

export type Resolved = { style: ViewStyle; transformOrigin: string };

/**
 * Turn an anchor into a position plus a matching scale pivot.
 *
 * The pivot has to come from the anchor, not from a fixed corner: a menu that
 * scales around the wrong point visibly slides in from elsewhere on screen.
 */
export function resolveDropdownAnchor(
  anchor: DropdownAnchor,
  window: { width: number; height: number },
): Resolved {
  if (anchor.kind === "pointer") {
    const left = Math.max(
      12,
      Math.min(anchor.pageX - 20, window.width - MENU_WIDTH),
    );
    const top = Math.min(anchor.pageY + 8, window.height - MENU_MAX_HEIGHT);
    return {
      style: { top, left },
      // Grow out of the pressed chip rather than the screen corner.
      transformOrigin: `${left + CHIP_ICON_INSET}px ${top}px`,
    };
  }
  if (anchor.kind === "bar") {
    const { edge, barHeight, left, right } = anchor;
    return {
      style:
        edge === "top"
          ? { top: barHeight + 4, left, right }
          : { bottom: barHeight + 4, left, right },
      transformOrigin: `${edge} ${right === undefined ? "left" : "right"}`,
    };
  }
  const { top, bottom, left, right } = anchor;
  return {
    style: { top, bottom, left, right },
    transformOrigin: `${bottom === undefined ? "top" : "bottom"} ${
      right === undefined ? "left" : "right"
    }`,
  };
}
