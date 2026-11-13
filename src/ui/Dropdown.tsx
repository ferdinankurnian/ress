import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { resolveDropdownAnchor, type DropdownAnchor, type Resolved } from "./dropdownAnchor";

/**
 * One dropdown surface for the whole app: a dismiss backdrop, a menu box the
 * caller anchors, and the shared pop animation.
 *
 * Works anywhere. Pass a trigger-relative `anchor` and the box scales from that
 * point on both open and close. Width is always content-sized.
 *
 * `mode` picks how it mounts:
 * - `modal` covers the screen in a native modal. Use for context menus and
 *   header menus that need to escape their parent stacking context.
 * - `inline` stays in the caller's tree. Use inside a surface that already
 *   covers the screen (reader, sheets, etc).
 */
export function Dropdown({
  visible,
  onClose,
  anchor,
  menuStyle,
  accessibilityLabel,
  mode = "modal",
  content,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  anchor: DropdownAnchor | null;
  menuStyle?: ViewStyle;
  accessibilityLabel: string;
  mode?: "modal" | "inline";
  /**
   * Data the menu items are built from. Held through the close animation so the
   * item list cannot change while the box is still fading out.
   */
  content?: unknown;
  children: React.ReactNode | ((content: any) => React.ReactNode);
}) {
  const window = useWindowDimensions();
  const resolved = anchor ? resolveDropdownAnchor(anchor, window) : null;

  const render = (value: unknown) =>
    typeof children === "function"
      ? (children as (content: any) => React.ReactNode)(value)
      : children;

  if (mode === "inline") {
    return (
      <InlineDropdown
        visible={visible}
        onClose={onClose}
        accessibilityLabel={accessibilityLabel}
        resolved={resolved}
        menuStyle={menuStyle}
        content={content}
        render={render}
      />
    );
  }

  return (
    <ModalDropdown
      visible={visible}
      onClose={onClose}
      accessibilityLabel={accessibilityLabel}
      resolved={resolved}
      menuStyle={menuStyle}
      content={content}
      render={render}
    />
  );
}

const OPEN_MS = 180;
const CLOSE_MS = 140;

function useDropdownAnimation(visible: boolean) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? OPEN_MS : CLOSE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  return { mounted, progress };
}

function useHeldAnchor(resolved: Resolved | null) {
  // Hold the last anchor through the close animation so the box does not jump
  // to a default position while it is still fading out.
  const held = useRef<Resolved | null>(null);
  if (resolved) held.current = resolved;
  return resolved ?? held.current;
}

function useHeldContent(content: unknown) {
  const held = useRef<unknown>(content);
  if (content !== undefined) held.current = content;
  return held.current;
}

function MenuBox({
  progress,
  shown,
  menuStyle,
  children,
}: {
  progress: Animated.Value;
  shown: Resolved;
  menuStyle?: ViewStyle;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      style={[
        menuStyle,
        {
          position: "absolute",
          // Content dictates width. Without this the full-screen overlay makes
          // the box stretch edge-to-edge.
          alignSelf: "flex-start",
          opacity: progress,
        },
        shown.style,
        {
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
          ],
          // Relative to the menu box — opens/closes from the trigger.
          transformOrigin: shown.transformOrigin,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Full-screen dismiss target with the menu box animating on its own.
 *
 * The menu must be the thing that scales, not a full-screen wrapper: scaling a
 * wrapper rotates the box around a screen-wide pivot and drags it off its
 * anchor. The wrapper here is static; only the box pops.
 */
function ModalDropdown({
  visible,
  onClose,
  accessibilityLabel,
  resolved,
  menuStyle,
  content,
  render,
}: {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  resolved: Resolved | null;
  menuStyle?: ViewStyle;
  content?: unknown;
  render: (content: unknown) => React.ReactNode;
}) {
  const { mounted, progress } = useDropdownAnimation(visible);
  const shown = useHeldAnchor(resolved);
  const heldContent = useHeldContent(content);

  if (!mounted || !shown) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1 }}
        onPress={onClose}
        accessibilityLabel={accessibilityLabel}
      >
        <MenuBox progress={progress} shown={shown} menuStyle={menuStyle}>
          {render(heldContent)}
        </MenuBox>
      </Pressable>
    </Modal>
  );
}

/** Same animation as modal, stays in the caller's tree. */
function InlineDropdown({
  visible,
  onClose,
  accessibilityLabel,
  resolved,
  menuStyle,
  content,
  render,
}: {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  resolved: Resolved | null;
  menuStyle?: ViewStyle;
  content?: unknown;
  render: (content: unknown) => React.ReactNode;
}) {
  const { mounted, progress } = useDropdownAnimation(visible);
  const shown = useHeldAnchor(resolved);
  const heldContent = useHeldContent(content);

  if (!mounted || !shown) return null;

  return (
    <View style={{ position: "absolute", inset: 0 }} pointerEvents="box-none">
      <Pressable
        style={{ position: "absolute", inset: 0 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onClose}
      />
      <MenuBox progress={progress} shown={shown} menuStyle={menuStyle}>
        {render(heldContent)}
      </MenuBox>
    </View>
  );
}
