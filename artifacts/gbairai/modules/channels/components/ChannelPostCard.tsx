import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { getDisplayMediaUrl } from "@/lib/media";

import type { ChannelPost } from "../types";

const REACTIONS = ["👍", "❤️", "🔥", "👏", "😮"];

type ChannelPostCardProps = {
  post: ChannelPost;
  onReact: (emoji: string) => void;
  onRecordView: () => void;
  onOpenMedia?: (post: ChannelPost) => void;
};

function ChannelVideoPreview({ url }: { url: string }) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
    instance.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={styles.media}
      contentFit="cover"
      nativeControls
    />
  );
}

export function ChannelPostCard({ post, onReact, onRecordView, onOpenMedia }: ChannelPostCardProps) {
  const colors = useColors();
  const channelName = post.channel?.name ?? "Chaîne";
  const initials = channelName.slice(0, 2).toUpperCase();

  useEffect(() => {
    onRecordView();
  }, [onRecordView, post.id]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Avatar
          uri={post.channel?.avatarUrl ?? null}
          initials={initials}
          color="#6D4AFF"
          size={40}
        />
        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={[styles.channelName, { color: colors.text }]}>{channelName}</Text>
            {post.channel?.isVerified ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            ) : null}
          </View>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {new Date(post.createdAt).toLocaleString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>

      {post.content ? (
        <Text style={[styles.content, { color: colors.text }]}>{post.content}</Text>
      ) : null}

      {post.mediaUrl && post.mediaType === "image" ? (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => onOpenMedia?.(post)}
        >
          <Image
            source={{ uri: getDisplayMediaUrl("", post.mediaUrl) }}
            style={styles.media}
            contentFit="cover"
          />
        </TouchableOpacity>
      ) : null}

      {post.mediaUrl && post.mediaType === "video" ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onOpenMedia?.(post)}
        >
          <ChannelVideoPreview url={getDisplayMediaUrl("", post.mediaUrl)} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.statsRow}>
        <Text style={[styles.stat, { color: colors.mutedForeground }]}>
          {post.viewsCount} vues
        </Text>
        <Text style={[styles.stat, { color: colors.mutedForeground }]}>
          {post.reactionsCount} réactions
        </Text>
      </View>

      <View style={styles.reactionsRow}>
        {REACTIONS.map((emoji) => {
          const active = post.userReaction === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.reactionBtn,
                {
                  backgroundColor: active ? "rgba(37, 211, 102, 0.18)" : colors.background,
                  borderColor: active ? "#1FA855" : colors.border,
                },
              ]}
              onPress={() => onReact(emoji)}
              activeOpacity={0.8}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  channelName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  media: {
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  videoPlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  stat: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reactionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: {
    fontSize: 18,
  },
});
