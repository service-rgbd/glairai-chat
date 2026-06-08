import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { GStory, GUser } from "@/contexts/chats-types";
import { useColors } from "@/hooks/useColors";
import { getDisplayMediaUrl, parseStoryMediaPayload } from "@/lib/media";
import { storyTextColor } from "@/lib/story-text";

import { Avatar } from "./Avatar";

interface StoryRingProps {
  user: GUser;
  stories: GStory[];
  currentUserId?: string;
  isMe?: boolean;
  onPress: () => void;
  size?: number;
}

const DEFAULT_SIZE = 72;

export function StoryRing({
  user,
  stories,
  currentUserId = "me",
  isMe = false,
  onPress,
  size = DEFAULT_SIZE,
}: StoryRingProps) {
  const colors = useColors();
  const hasStory = stories.length > 0;
  const hasUnseen = stories.some((story) => !story.viewerIds.includes(currentUserId));
  const latest = stories[stories.length - 1];
  const mediaPayload = latest?.type !== "text" && latest ? parseStoryMediaPayload(latest.content) : null;
  const mediaUrl = mediaPayload ? getDisplayMediaUrl(mediaPayload.key, mediaPayload.url) : null;
  const storyThumbnailUrl = mediaPayload?.thumbnailUrl
    ? getDisplayMediaUrl("", mediaPayload.thumbnailUrl)
    : null;

  const innerSize = size - 6;
  const avatarSize = innerSize - 4;

  const ringColor = hasStory
    ? hasUnseen
      ? colors.primary
      : colors.mutedForeground
    : colors.border;

  return (
    <TouchableOpacity style={[styles.item, { width: size + 14 }]} onPress={onPress} activeOpacity={0.84}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ringColor,
          },
        ]}
      >
        <View
          style={[
            styles.inner,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
            },
          ]}
        >
          {latest?.type === "text" ? (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: latest.backgroundColor || colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 6,
                },
              ]}
            >
              <Text
                style={[
                  styles.textPreview,
                  { color: storyTextColor(latest.backgroundColor || colors.primary) },
                ]}
                numberOfLines={2}
              >
                {latest.content}
              </Text>
            </View>
          ) : latest?.type === "image" && mediaUrl ? (
            <Image source={{ uri: mediaUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : latest?.type === "video" ? (
            storyThumbnailUrl ? (
              <Image source={{ uri: storyThumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            ) : (
              <View style={styles.videoBg}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            )
          ) : (
            <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={avatarSize} />
          )}
        </View>

        {isMe ? (
          <View style={[styles.addBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.addIcon}>+</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.name, { color: colors.text, maxWidth: size + 14 }]} numberOfLines={1}>
        {isMe ? "Mon statut" : user.name.split(" ")[0]}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    gap: 7,
  },
  ring: {
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  inner: {
    overflow: "hidden",
    backgroundColor: "#E2E8F0",
  },
  textPreview: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  videoBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    color: "#fff",
    fontSize: 18,
  },
  addBadge: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  addIcon: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 16,
  },
  name: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
