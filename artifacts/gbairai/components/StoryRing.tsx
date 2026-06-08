import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { GStory, GUser } from "@/contexts/chats-types";
import { useColors } from "@/hooks/useColors";
import { getDisplayMediaUrl, parseStoryMediaPayload } from "@/lib/media";

import { Avatar } from "./Avatar";

interface StoryRingProps {
  user: GUser;
  stories: GStory[];
  currentUserId?: string;
  isMe?: boolean;
  onPress: () => void;
  size?: number;
}

export function StoryRing({
  user,
  stories,
  currentUserId = "me",
  isMe = false,
  onPress,
  size = 62,
}: StoryRingProps) {
  const colors = useColors();
  const hasUnseen = stories.some((s) => !s.viewerIds.includes(currentUserId));
  const hasStory = stories.length > 0;
  const latest = stories[stories.length - 1];
  const mediaPayload = latest?.type !== "text" && latest ? parseStoryMediaPayload(latest.content) : null;
  const mediaUrl = mediaPayload ? getDisplayMediaUrl(mediaPayload.key, mediaPayload.url) : null;
  const storyThumbnailUrl = mediaPayload?.thumbnailUrl
    ? getDisplayMediaUrl("", mediaPayload.thumbnailUrl)
    : null;
  const avatarSize = Math.min(size, 36);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: latest?.backgroundColor ?? colors.card,
          borderColor: hasStory && hasUnseen ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      {latest?.type === "image" && mediaUrl ? (
        <Image source={{ uri: mediaUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
      ) : latest?.type === "video" ? (
        storyThumbnailUrl ? (
          <Image source={{ uri: storyThumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : (
          <View style={styles.videoBg}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        )
      ) : null}
      <View style={styles.overlay} />
      <View style={styles.avatarArea}>
        <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={avatarSize} />
        {isMe ? (
          <View style={[styles.addBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.addIcon}>+</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {isMe ? "Mon statut" : user.name.split(" ")[0]}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 104,
    height: 152,
    borderRadius: 18,
    borderWidth: 2,
    overflow: "hidden",
    padding: 10,
    justifyContent: "space-between",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  videoBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    color: "#fff",
    fontSize: 28,
  },
  avatarArea: { alignSelf: "flex-start" },
  addBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addIcon: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  name: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
