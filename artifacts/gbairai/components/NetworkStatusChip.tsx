import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";

import { useOptionalNetworkStatus } from "@/contexts/NetworkStatusContext";
import { useColors } from "@/hooks/useColors";

export function NetworkStatusChip() {
  const colors = useColors();
  const network = useOptionalNetworkStatus();
  const blink = useRef(new Animated.Value(1)).current;

  const status = network?.status ?? "online";
  const isOffline = status === "offline";
  const isUnstable = status === "unstable";
  const visible = isOffline || isUnstable;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 450, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink, visible]);

  if (!visible || !network) return null;

  const accent = isOffline ? "#EF4444" : "#F59E0B";

  return (
    <TouchableOpacity
      onPress={network.showIssueBanner}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={isOffline ? "Pas de connexion" : "Connexion instable"}
    >
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: accent,
            opacity: blink,
            borderColor: colors.card,
          },
        ]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
