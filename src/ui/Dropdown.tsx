import React, { useEffect, useRef, useState } from "react";
import { Pressable, useWindowDimensions, View, type ViewStyle } from "react-native";
import { MotionModal } from "./Motion";

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

type Resolved = { style: ViewStyle; transformOrigin: string };

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

/**
 * One dropdown surface for the whole app: a dismiss backdrop, a menu box the
 * caller anchors, and the shared pop animation.
 *
 * `mode` picks how it mounts:
 * - `modal` covers the screen in a native modal and scales in. Use it for
 *   context menus and header menus.
 * - `inline` stays in the caller's tree and fades out in place. Use it inside
 *   a surface that already covers the screen, such as the reader.
 */
export function Dropdown({
  visible,
  onClose,
  anchor,
  menuStyle,
  accessibilityLabel,
  mode = "modal",
  children,
}: {
  visible: boolean;
  onClose: () => void;
  anchor: DropdownAnchor | null;
  menuStyle?: ViewStyle;
  accessibilityLabel: string;
  mode?: "modal" | "inline";
  children: React.ReactNode;
}) {
  const window = useWindowDimensions();
  const resolved = anchor ? resolveDropdownAnchor(anchor, window) : null;
  // Hold the last anchor through the close animation. Dropping it early sends
  // the menu back to the backdrop's static origin mid-flight.
  const held = useRef<Resolved | null>(null);
  if (resolved) held.current = resolved;
  const shown = resolved ?? held.current;

  const menu = (
    <View style={[menuStyle, shown?.style]}>{children}</View>
  );

  if (mode === "inline") {
    return (
      <InlineDropdown visible={visible} onClose={onClose} accessibilityLabel={accessibilityLabel}>
        {menu}
      </InlineDropdown>
    );
  }

  return (
    <MotionModal
      visible={visible}
      onClose={onClose}
      transformOrigin={shown?.transformOrigin}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "transparent" }}
        onPress={onClose}
        accessibilityLabel={accessibilityLabel}
      >
        {menu}
      </Pressable>
    </MotionModal>
  );
}

/** Keeps the menu mounted for the length of its exit fade. */
function InlineDropdown({
  visible,
  onClose,
  accessibilityLabel,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    // Matches the fade duration so the menu isn't yanked mid-animation.
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [visible]);
  if (!mounted) return null;
  return (
    <View style={{ position: "absolute", inset: 0 }} pointerEvents="box-none">
      <Pressable
        style={{ position: "absolute", inset: 0 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onClose}
      />
      {children}
    </View>
  );
}
