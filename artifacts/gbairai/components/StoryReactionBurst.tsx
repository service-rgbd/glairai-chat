import { Image } from "expo-image";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { fluentEmoji3dUrl } from "@/lib/story-reactions";

interface StoryReactionBurstProps {
  fluentName: string;
  onDone?: () => void;
}

export function StoryReactionBurst({ fluentName, onDone }: StoryReactionBurstProps) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.15,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -120,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => onDone?.());
    });
  }, [fluentName, onDone, opacity, scale, translateY]);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={{
          opacity,
          transform: [{ scale }, { translateY }],
        }}
      >
        <Image
          source={{ uri: fluentEmoji3dUrl(fluentName) }}
          style={styles.emoji}
          contentFit="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  emoji: {
    width: 96,
    height: 96,
  },
});
