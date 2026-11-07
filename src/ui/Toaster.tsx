import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, type Palette } from "./theme";

const f = theme.font;

// Sonner-style notifications: floating cards stacked at the top center of the
// screen. Call toast() from anywhere — even outside React components — and the
// newest card drops in while older ones collapse upward. The front card
// dismisses on tap or on a swipe up; the rest dismiss themselves after a beat.
type ToastItem = { id: number; message: string };
const listeners = new Set<(message: string) => void>();
let nextId = 1;

/** Show a brief notification at the top center of the screen. */
export function toast(message: string) {
  if (!message) return;
  for (const listener of listeners) listener(message);
}

const MAX_STACK = 3;
const LIFETIME = 4000;
const SWIPE_DISMISS = 70;
const EXIT_TRAVEL = -120;

export function Toaster({
  colors: c,
  dark,
}: {
  colors: Palette;
  dark: boolean;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => {
    const listener = (message: string) =>
      setToasts((current) => [
        ...current.slice(-(MAX_STACK - 1)),
        { id: nextId++, message },
      ]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: (insets.top || 12) + 12 }]}
    >
      {toasts.map((item, index) => (
        <ToastCard
          key={item.id}
          message={item.message}
          colors={c}
          dark={dark}
          depth={toasts.length - 1 - index}
          onDismiss={() =>
            setToasts((current) =>
              current.filter((shown) => shown.id !== item.id),
            )
          }
        />
      ))}
    </View>
  );
}

function ToastCard({
  message,
  colors: c,
  dark,
  depth,
  onDismiss,
}: {
  message: string;
  colors: Palette;
  dark: boolean;
  depth: number;
  onDismiss: () => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(depth)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const exiting = useRef(false);
  const dragging = useRef(false);
  const reducedMotion = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const animate = (
    value: Animated.Value,
    toValue: number,
    duration: number,
    easing = Easing.out(Easing.cubic),
  ) =>
    Animated.timing(value, {
      toValue,
      duration: reducedMotion.current ? 0 : duration,
      easing,
      useNativeDriver: true,
      isInteraction: false,
    });

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) reducedMotion.current = value;
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        reducedMotion.current = value;
      },
    );
    animate(progress, 1, 240).start();
    return () => {
      active = false;
      subscription.remove();
    };
  }, [progress]);

  useEffect(() => {
    animate(lift, depth, 200).start();
  }, [depth, lift]);

  function finish() {
    if (exiting.current) return;
    exiting.current = true;
    Animated.parallel([
      animate(progress, 0, 180, Easing.in(Easing.cubic)),
      animate(drag, EXIT_TRAVEL, 180, Easing.in(Easing.cubic)),
    ]).start(({ finished }) => {
      if (finished) onDismissRef.current();
    });
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(() => {
        // A toast held under a finger waits for the gesture to end.
        if (dragging.current) schedule();
        else finish();
      }, LIFETIME);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        !exiting.current &&
        gesture.dy < -6 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        dragging.current = true;
      },
      onPanResponderMove: (_event, gesture) =>
        drag.setValue(Math.min(0, gesture.dy)),
      onPanResponderRelease: (_event, gesture) => {
        dragging.current = false;
        if (gesture.dy < -SWIPE_DISMISS || gesture.vy < -0.8) finish();
        else
          Animated.spring(drag, {
            toValue: 0,
            damping: 26,
            stiffness: 260,
            useNativeDriver: true,
          }).start();
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        Animated.spring(drag, {
          toValue: 0,
          damping: 26,
          stiffness: 260,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const enterTranslate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 0],
  });
  const liftTranslate = Animated.multiply(lift, -12);
  const translateY = Animated.add(
    enterTranslate,
    Animated.add(liftTranslate, drag),
  );
  const scale = lift.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [1, 0.94, 0.88],
    extrapolate: "clamp",
  });
  const stackOpacity = lift.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [1, 0.65, 0.3],
    extrapolate: "clamp",
  });
  const dragOpacity = drag.interpolate({
    inputRange: [EXIT_TRAVEL, 0],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  return (
    <View pointerEvents="box-none" style={styles.slot}>
      <Animated.View
        {...(depth === 0 ? pan.panHandlers : {})}
        pointerEvents={depth === 0 ? "auto" : "none"}
        collapsable={false}
        style={{
          transform: [{ translateY }, { scale }],
          opacity: Animated.multiply(stackOpacity, dragOpacity),
        }}
      >
        <Pressable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={message}
          onPress={finish}
          style={[
            styles.card,
            {
              backgroundColor: dark ? c.surface : c.white,
              borderColor: c.rule,
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.18)",
            },
          ]}
        >
          <Text numberOfLines={3} style={[styles.message, { color: c.ink }]}>
            {message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  slot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 356,
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  message: { fontFamily: f.medium, fontSize: 14, lineHeight: 19 },
});
