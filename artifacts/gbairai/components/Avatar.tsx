import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useCachedMediaUrl } from "@/hooks/useCachedMediaUrl";
import { resolveAvatarUrl } from "@/lib/avatar";

interface AvatarProps {
  uri?: string | null;
  initials: string;
  color: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
}

export function Avatar({ uri, initials, color, size = 50, showOnline = false, isOnline = false }: AvatarProps) {
  const colors = useColors();
  const fontSize = size * 0.38;
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedUri = useCachedMediaUrl(resolveAvatarUrl(uri));
  const shouldRenderImage = Boolean(resolvedUri) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  return (
    <View style={{ width: size, height: size }}>
      {shouldRenderImage && resolvedUri ? (
        <Image
          source={{ uri: resolvedUri, cacheKey: resolvedUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
          <Text style={[styles.initials, { fontSize, color: "#fff" }]}>{initials}</Text>
        </View>
      )}
      {showOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: (size * 0.28) / 2,
              backgroundColor: isOnline ? colors.online : colors.mutedForeground,
              borderColor: colors.background,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  initials: {
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  onlineDot: {
    position: "absolute",
    borderWidth: 2,
  },
});
