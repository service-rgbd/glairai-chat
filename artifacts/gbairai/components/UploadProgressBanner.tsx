import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { UploadPhase, UploadStatus } from "@/lib/upload-status";
import { useColors } from "@/hooks/useColors";

interface UploadProgressBannerProps {
  status: UploadStatus;
  compact?: boolean;
}

const phaseProgress: Record<UploadPhase, number> = {
  preparing: 0.2,
  uploading: 0.65,
  finalizing: 0.9,
  done: 1,
};

export function UploadProgressBanner({ status, compact = false }: UploadProgressBannerProps) {
  const colors = useColors();
  const progress = phaseProgress[status.phase];

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        {status.phase === "done" ? (
          <Text style={[styles.doneIcon, { color: colors.primary }]}>✓</Text>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={2}>
          {status.label}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${progress * 100}%`,
              backgroundColor: status.phase === "done" ? colors.primary : colors.primary,
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
  doneIcon: {
    width: 18,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
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
});
