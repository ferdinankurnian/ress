import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, PanResponder, View } from "react-native";
export function Scene({
  children,
  scene,
  animateOnMount = false,
}: {
  children: React.ReactNode;
  scene: string;
  animateOnMount?: boolean;
}) {
  const progress = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current;
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      if (!animateOnMount) return;
    }
    progress.stopAnimation();
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [scene, progress, animateOnMount]);
  return (
    <Animated.View
      testID="page-scene"
      collapsable={false}
      style={{
        flex: 1,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
export function MotionModal({
  visible,
  onClose,
  children,
  drawer = false,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  drawer?: boolean;
}) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const closing = useRef(onClose);
  closing.current = onClose;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
    }
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 420 : 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible]);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) closing.current();
        else
          Animated.spring(drag, {
            toValue: 0,
            damping: 28,
            stiffness: 250,
            useNativeDriver: true,
          }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;
  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#000",
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, drawer ? 0.4 : 0.15],
            }),
          }}
        />
        <Animated.View
          {...(drawer ? pan.panHandlers : {})}
          // Composite the surface and its shadow together during the fade.
          needsOffscreenAlphaCompositing={!drawer}
          renderToHardwareTextureAndroid={!drawer}
          collapsable={false}
          style={{
            flex: 1,
            opacity: drawer ? 1 : progress,
            transform: drawer
              ? [
                  {
                    translateY: Animated.add(
                      drag,
                      progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [900, 0],
                      }),
                    ),
                  },
                ]
              : [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.92, 1],
                    }),
                  },
                ],
            transformOrigin: "top right",
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
export function PopIn({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transformOrigin: "top right",
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
