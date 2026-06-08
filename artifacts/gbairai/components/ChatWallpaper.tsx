import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, useColorScheme, View, type ViewProps } from "react-native";

import {
  getChatWallpaper,
  type ChatWallpaperId,
} from "@/lib/chat-wallpapers";

type ChatWallpaperProps = ViewProps & {
  wallpaperId: ChatWallpaperId;
};

export function ChatWallpaper({ wallpaperId, style, ...props }: ChatWallpaperProps) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const wallpaper = getChatWallpaper(wallpaperId);

  if (wallpaper.source.kind === "none") {
    return null;
  }

  if (wallpaper.source.kind === "image") {
    const source = isDark && wallpaper.source.dark ? wallpaper.source.dark : wallpaper.source.light;
    return (
      <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" {...props}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" />
        {wallpaper.source.overlay ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: wallpaper.source.overlay }]} />
        ) : null}
      </View>
    );
  }

  const palette = isDark ? wallpaper.source.dark : wallpaper.source.light;

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" {...props}>
      <LinearGradient
        colors={[...palette.colors]}
        locations={palette.locations ? [...palette.locations] : undefined}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {palette.overlay ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay }]} />
      ) : null}
    </View>
  );
}

export function ChatWallpaperPreview({
  wallpaperId,
  size = 72,
  isDark,
}: {
  wallpaperId: ChatWallpaperId;
  size?: number;
  isDark?: boolean;
}) {
  const scheme = useColorScheme();
  const dark = isDark ?? scheme === "dark";
  const wallpaper = getChatWallpaper(wallpaperId);

  if (wallpaper.source.kind === "none") {
    return (
      <View
        style={[
          styles.preview,
          {
            width: size,
            height: size,
            backgroundColor: dark ? "#111827" : "#F8FAFC",
            borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)",
          },
        ]}
      />
    );
  }

  if (wallpaper.source.kind === "image") {
    const source = dark && wallpaper.source.dark ? wallpaper.source.dark : wallpaper.source.light;
    return (
      <View style={[styles.preview, { width: size, height: size, overflow: "hidden" }]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
        {wallpaper.source.overlay ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: wallpaper.source.overlay }]} />
        ) : null}
      </View>
    );
  }

  const palette = dark ? wallpaper.source.dark : wallpaper.source.light;

  return (
    <View style={[styles.preview, { width: size, height: size, overflow: "hidden" }]}>
      <LinearGradient
        colors={[...palette.colors]}
        locations={palette.locations ? [...palette.locations] : undefined}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {palette.overlay ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
});
