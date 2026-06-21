import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
} from "react-native-gesture-handler";

import { useColors } from "@/hooks/useColors";

const SWIPE_REPLY_THRESHOLD = 56;
const MAX_SWIPE = 84;

type Props = {
  children: React.ReactNode;
  enabled?: boolean;
  onReply: () => void;
};

export function SwipeableMessageRow({ children, enabled = true, onReply }: Props) {
  const colors = useColors();
  const translateX = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const next = Math.min(0, Math.max(event.nativeEvent.translationX, -MAX_SWIPE));
    translateX.setValue(next);
    if (!triggered.current && next <= -SWIPE_REPLY_THRESHOLD) {
      triggered.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onReplyRef.current();
    }
  };

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    const { state } = event.nativeEvent;
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
      }).start();
      triggered.current = false;
    }
  };

  const iconOpacity = translateX.interpolate({
    inputRange: [-SWIPE_REPLY_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const iconScale = translateX.interpolate({
    inputRange: [-SWIPE_REPLY_THRESHOLD, 0],
    outputRange: [1, 0.85],
    extrapolate: "clamp",
  });

  const rowStyle = useMemo(
    () => ({
      transform: [{ translateX }],
    }),
    [translateX],
  );

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.replyIcon,
          {
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          },
        ]}
      >
        <Ionicons name="arrow-undo" size={18} color={colors.primary} />
      </Animated.View>
      <PanGestureHandler
        enabled={enabled}
        activeOffsetX={[-12, 10000]}
        failOffsetY={[-12, 12]}
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    justifyContent: "center",
  },
  replyIcon: {
    position: "absolute",
    right: 8,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
