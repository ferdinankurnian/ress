import type { ViewStyle } from "react-native";

/** Upper bound used only to keep the menu on screen. Real width is content-sized. */
const MENU_MAX_WIDTH = 280;
/** Soft height guard so a tall menu doesn't start off the bottom edge. */
const MENU_MAX_HEIGHT = 280;

/**
 * Where a dropdown is drawn. Callers describe intent; this file does the math.
 */
export type DropdownAnchor =
  /**
   * Grow from a point on the trigger (usually its center, below it). `edge`
   * says which side of the box touches that point, so the menu hangs off the
   * item it belongs to — left edge, right edge or centered on it.
   */
  | {
      kind: "pointer";
      pageX: number;
      pageY: number;
      /** Which box edge lines up with `pageX`. Defaults to "start". */
      align?: "start" | "center" | "end";
      /** Actual menu width, used to clamp against the viewport. */
      width?: number;
      /** Open above the point instead of below it. */
      above?: boolean;
    }
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

export type Resolved = {
  style: ViewStyle;
  /** Relative to the menu box itself (not the window). */
  transformOrigin: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

/**
 * Turn an anchor into a position plus a matching scale pivot.
 *
 * transformOrigin is always relative to the menu box so the scale opens and
 * closes from the trigger, not from a random screen corner.
 */
export function resolveDropdownAnchor(
  anchor: DropdownAnchor,
  window: { width: number; height: number },
): Resolved {
  if (anchor.kind === "pointer") {
    // The menu hangs off the trigger: `align` picks which box edge sits on
    // pageX, then the result is nudged back inside the viewport so it never
    // runs off screen. Width is the real menu width when the caller knows it.
    const menuWidth = Math.min(anchor.width ?? MENU_MAX_WIDTH, window.width - 24);
    const align = anchor.align ?? "start";
    const preferredLeft =
      align === "end"
        ? anchor.pageX - menuWidth
        : align === "center"
          ? anchor.pageX - menuWidth / 2
          : anchor.pageX;
    const left = clamp(preferredLeft, 12, window.width - menuWidth - 12);

    const rawTop = anchor.above ? anchor.pageY - MENU_MAX_HEIGHT : anchor.pageY + 6;
    const top = clamp(rawTop, 12, window.height - MENU_MAX_HEIGHT);

    // Origin relative to the box: the trigger point mapped onto the menu, on
    // the edge that touches the trigger so it grows away from it.
    const originX = clamp(anchor.pageX - left, 0, menuWidth);
    const originY = anchor.above ? "bottom" : "top";

    return {
      style: { top, left },
      transformOrigin: `${originX}px ${originY}`,
    };
  }

  if (anchor.kind === "bar") {
    const { edge, barHeight, left, right } = anchor;
    // Hang off the bar; origin is the edge that touches the bar so the box
    // expands away from the trigger instead of sliding sideways.
    const originY = edge === "top" ? "top" : "bottom";
    const originX = right !== undefined ? "right" : "left";
    return {
      style:
        edge === "top"
          ? { top: barHeight + 4, left, right }
          : { bottom: barHeight + 4, left, right },
      transformOrigin: `${originY} ${originX}`,
    };
  }

  const { top, bottom, left, right } = anchor;
  const originY = bottom !== undefined ? "bottom" : "top";
  const originX = right !== undefined ? "right" : "left";
  return {
    style: { top, bottom, left, right },
    transformOrigin: `${originY} ${originX}`,
  };
}
