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
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  // Hold the last anchor through the close animation so the box does not jump
  // to a default position while it is still fading out.
  const held = useRef<Resolved | null>(null);
  if (resolved) held.current = resolved;
  const shown = resolved ?? held.current;
  // Same reason as the anchor: the item list must not change mid-fade.
  const heldContent = useRef<unknown>(content);
  if (content !== undefined) heldContent.current = content;
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);
  if (!mounted || !shown) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1 }}
        onPress={onClose}
        accessibilityLabel={accessibilityLabel}
      >
        {/* The animated element is the box itself, shrink-wrapped at the
            anchor, so scaling cannot drag it off position. The backdrop
            above stays static to catch dismissal taps. */}
        <Animated.View
          style={[
            menuStyle,
            { position: "absolute", opacity: progress },
            shown.style,
            {
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
              transformOrigin: shown.transformOrigin,
            },
          ]}
        >
          {render(heldContent.current)}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/** Keeps the menu mounted for the length of its exit fade. */
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
  const [mounted, setMounted] = useState(visible);
  // The anchor must survive the fade-out, or the box jumps to a default spot.
  const held = useRef<Resolved | null>(null);
  if (resolved) held.current = resolved;
  const shown = resolved ?? held.current;
  const heldContent = useRef<unknown>(content);
  if (content !== undefined) heldContent.current = content;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    // Matches the fade duration so the menu isn't yanked mid-animation.
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [visible]);
  if (!mounted || !shown) return null;
  return (
    <View style={{ position: "absolute", inset: 0 }} pointerEvents="box-none">
      <Pressable
        style={{ position: "absolute", inset: 0 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onClose}
      />
      <View style={[menuStyle, shown.style]}>{render(heldContent.current)}</View>
    </View>
  );
}
