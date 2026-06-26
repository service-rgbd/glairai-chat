import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, ActivityIndicator, Easing, StyleSheet, Text, View } from "react-native";

import { UploadPhase, UploadStatus } from "@/lib/upload-status";
import { useColors } from "@/hooks/useColors";

interface UploadProgressBannerProps {
  status: UploadStatus;
  compact?: boolean;
  /** Style vitré pour les aperçus vidéo plein écran (story, chat). */
  variant?: "default" | "immersive";
}

const phaseProgress: Record<UploadPhase, number> = {
  preparing: 0.12,
  uploading: 0.58,
  finalizing: 0.88,
  done: 1,
};

const phaseIcon: Record<UploadPhase, keyof typeof Ionicons.glyphMap> = {
  preparing: "options-outline",
  uploading: "cloud-upload-outline",
  finalizing: "sparkles-outline",
  done: "checkmark-circle",
};

export function UploadProgressBanner({
  status,
  compact = false,
  variant = "default",
}: UploadProgressBannerProps) {
  const colors = useColors();
  const progress = phaseProgress[status.phase];
  const percent = Math.round(progress * 100);
  const pulse = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status.phase === "done") {
      pulse.stopAnimation();
      shimmer.stopAnimation();
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    pulseLoop.start();
    shimmerLoop.start();

    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [pulse, shimmer, status.phase]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  if (variant === "immersive") {
    return (
      <Animated.View
        style={[
          styles.immersiveCard,
          compact ? styles.wrapCompact : null,
          { transform: [{ scale: status.phase === "done" ? 1 : pulseScale }] },
        ]}
      >
        <View style={styles.immersiveHeader}>
          <View style={styles.immersiveIconWrap}>
            {status.phase === "done" ? (
              <Ionicons name="checkmark-circle" size={28} color="#34D399" />
            ) : (
              <Ionicons name={phaseIcon[status.phase]} size={26} color="#A78BFA" />
            )}
          </View>
          <View style={styles.immersiveTextCol}>
            <Text style={styles.immersivePercent}>{percent}%</Text>
            <Text style={styles.immersiveLabel} numberOfLines={2}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={styles.immersiveTrack}>
          <LinearGradient
            colors={["#6D4AFF", "#8B5CF6", "#34D399"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.immersiveFill, { width: `${percent}%` }]}
          />
          {status.phase !== "done" ? (
            <Animated.View
              style={[
                styles.immersiveShimmer,
                { transform: [{ translateX: shimmerTranslate }] },
              ]}
            />
          ) : null}
        </View>

        <Text style={styles.immersiveHint}>
          {status.phase === "uploading"
            ? "L'envoi peut prendre quelques instants selon la taille du fichier…"
            : status.phase === "done"
              ? "Prêt"
              : "Ne fermez pas l'application"}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        compact ? styles.wrapCompact : null,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        {status.phase === "done" ? (
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        ) : (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={2}>
          {status.label}
        </Text>
        <Text style={[styles.percentBadge, { color: colors.primary }]}>{percent}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  wrapCompact: {
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  percentBadge: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    minWidth: 36,
    textAlign: "right",
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
  immersiveCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  immersiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  immersiveIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(109, 74, 255, 0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(167, 139, 250, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  immersiveTextCol: {
    flex: 1,
    gap: 2,
  },
  immersivePercent: {
    color: "#F8FAFC",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  immersiveLabel: {
    color: "rgba(248, 250, 252, 0.88)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
  },
  immersiveTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
    position: "relative",
  },
  immersiveFill: {
    height: "100%",
    borderRadius: 999,
  },
  immersiveShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 48,
    backgroundColor: "rgba(255,255,255,0.28)",
    opacity: 0.6,
  },
  immersiveHint: {
    color: "rgba(248, 250, 252, 0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
