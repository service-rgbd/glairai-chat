import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { NetworkBannerKind } from "@/contexts/NetworkStatusContext";
import { useColors } from "@/hooks/useColors";

interface NetworkIssueBannerProps {
  kind: NetworkBannerKind;
  checking?: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  insetTop?: number;
}

export function NetworkIssueBanner({
  kind,
  checking = false,
  onRetry,
  onDismiss,
  insetTop,
}: NetworkIssueBannerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const blink = useRef(new Animated.Value(1)).current;

  const visible = kind !== "hidden";
  const isRestored = kind === "restored";
  const isOffline = kind === "offline";
  const isUnstable = kind === "unstable";

  useEffect(() => {
    if (!visible || isRestored) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink, isRestored, visible]);

  if (!visible) return null;

  const accent = isRestored ? "#22C55E" : isOffline ? "#EF4444" : "#F59E0B";
  const title = isRestored
    ? "Connexion rétablie"
    : isOffline
      ? "Pas de connexion"
      : "Connexion instable";
  const topPad = insetTop ?? (Platform.OS === "web" ? 12 : insets.top + 4);

  return (
    <View style={[styles.host, { top: topPad }]} pointerEvents="box-none">
      <View
        style={[
          styles.banner,
          {
            backgroundColor: colors.card,
            borderColor: `${accent}55`,
          },
        ]}
      >
        {isRestored ? (
          <View style={[styles.dot, { backgroundColor: accent }]} />
        ) : (
          <Animated.View style={[styles.dot, { backgroundColor: accent, opacity: blink }]} />
        )}

        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>

        {!isRestored ? (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={onRetry}
            disabled={checking}
            hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
          >
            {checking ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={15} color={colors.primary} />
            )}
          </TouchableOpacity>
        ) : (
          <Ionicons name="checkmark-circle" size={18} color={accent} />
        )}

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          onPress={onDismiss}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        >
          <Ionicons name="close" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 420,
    width: "100%",
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
