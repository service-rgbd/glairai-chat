import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { GChat, GMessage, GStory, GUser } from "@/contexts/chats-types";
import { formatTimestamp } from "@/lib/format-timestamp";
import { getEmoji3dPayloadFromContent } from "@/lib/emoji-messages";
import { getCallMessagePreview } from "@/lib/call-messages";
import { DELETED_MESSAGE_LABEL } from "@/lib/message-meta";
import { getGroupDisplayColor, getGroupDisplayInitials } from "@/lib/group-utils";
import { useColors } from "@/hooks/useColors";

import { Avatar } from "./Avatar";

interface ChatItemProps {
  chat: GChat;
  otherUser?: GUser;
  lastMessage?: GMessage;
  currentUserId: string;
  users?: Record<string, GUser>;
  typingLabel?: string | null;
  userStories?: GStory[];
  onStoryPress?: () => void;
  onPress: () => void;
  onLongPress?: () => void;
}

export function ChatItem({
  chat,
  otherUser,
  lastMessage,
  currentUserId,
  users = {},
  typingLabel,
  userStories = [],
  onStoryPress,
  onPress,
  onLongPress,
}: ChatItemProps) {
  const colors = useColors();
  const isGroup = chat.type === "group";
  const displayName = isGroup ? (chat.name ?? "Groupe") : (otherUser?.name ?? "");
  const isOnline = otherUser?.lastSeen === null;
  const initials = isGroup
    ? getGroupDisplayInitials(chat, users, currentUserId)
    : (otherUser?.initials ?? "??");
  const color = isGroup ? getGroupDisplayColor(chat.id) : (otherUser?.color ?? colors.primary);
  const avatarUri = isGroup ? (chat.avatarUrl ?? null) : (otherUser?.avatar ?? null);
  const hasUnread = chat.unreadCount > 0;
  const hasStory = !isGroup && userStories.length > 0;
  const hasUnseenStory = hasStory && userStories.some((story) => !story.viewerIds.includes(currentUserId));
  const avatarSize = 62;
  const ringPadding = 3;
  const ringSize = avatarSize + ringPadding * 2;

  const getPreview = () => {
    if (typingLabel) return typingLabel;
    if (!lastMessage) return "Démarrer une conversation";
    const prefix = lastMessage.senderId === currentUserId ? "Vous: " : (isGroup ? `${users[lastMessage.senderId]?.name?.split(" ")[0] ?? ""}: ` : "");
    if (lastMessage.isDeleted) {
      return prefix + DELETED_MESSAGE_LABEL;
    }
    const callPreview =
      lastMessage.type === "text"
        ? getCallMessagePreview(lastMessage.content, currentUserId, lastMessage.senderId)
        : null;
    const textPreview =
      lastMessage.type === "text"
        ? (callPreview ?? getEmoji3dPayloadFromContent(lastMessage.content)?.emoji ?? lastMessage.content)
        : lastMessage.content;
    const preview =
      lastMessage.type === "audio"
        ? "Note vocale"
        : lastMessage.type === "video"
          ? "Vidéo"
          : lastMessage.type === "image"
            ? "Photo"
            : textPreview;
    return prefix + preview;
  };

  const statusIcon = () => {
    if (typingLabel) return null;
    if (!lastMessage || lastMessage.senderId !== currentUserId) return null;
    const iconProps = { size: 14, style: { marginRight: 2 } };
    if (lastMessage.status === "read") return <Ionicons name="checkmark-done" {...iconProps} color={colors.accent} />;
    if (lastMessage.status === "delivered") return <Ionicons name="checkmark-done" {...iconProps} color={colors.mutedForeground} />;
    return <Ionicons name="checkmark" {...iconProps} color={colors.mutedForeground} />;
  };

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      activeOpacity={0.7}
    >
      {hasStory ? (
        <TouchableOpacity
          onPress={() => onStoryPress?.()}
          activeOpacity={0.85}
          style={[
            styles.storyRing,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: hasUnseenStory ? colors.primary : colors.border,
            },
          ]}
        >
          <Avatar
            uri={avatarUri}
            initials={initials}
            color={color}
            size={avatarSize}
            showOnline
            isOnline={isOnline}
          />
        </TouchableOpacity>
      ) : (
        <Avatar
          uri={avatarUri}
          initials={initials}
          color={color}
          size={avatarSize}
          showOnline={!isGroup}
          isOnline={isOnline}
        />
      )}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.time, { color: hasUnread ? colors.primary : colors.mutedForeground }]}>
            {lastMessage ? formatTimestamp(lastMessage.timestamp) : ""}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.previewRow}>
            {statusIcon()}
            <Text
              style={[
                styles.preview,
                { color: typingLabel ? colors.primary : hasUnread ? colors.text : colors.mutedForeground },
                (hasUnread || typingLabel) && styles.previewBold,
              ]}
              numberOfLines={1}
            >
              {getPreview()}
            </Text>
          </View>
          <View style={styles.trailingIndicators}>
            {chat.isMuted ? (
              <Ionicons name="notifications-off-outline" size={17} color={colors.mutedForeground} />
            ) : null}
            {hasUnread && (
              <View style={[styles.badge, { backgroundColor: colors.unreadBadge }]}>
                <Text style={styles.badgeText}>{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 84,
  },
  storyRing: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  preview: {
    fontSize: 16,
    flex: 1,
  },
  previewBold: {
    fontFamily: "Inter_500Medium",
  },
  trailingIndicators: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
