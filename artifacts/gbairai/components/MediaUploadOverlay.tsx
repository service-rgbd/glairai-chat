import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { UploadProgressBanner } from "@/components/UploadProgressBanner";
import type { UploadStatus } from "@/lib/upload-status";

interface MediaUploadOverlayProps {
  status: UploadStatus | null;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function MediaUploadOverlay({
  status,
  children,
  style,
  contentStyle,
}: MediaUploadOverlayProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
      {status ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <UploadProgressBanner status={status} variant="immersive" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    position: "relative",
  },
  content: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});
