import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { GChat, GMessage, GUser, formatTimestamp } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

import { Avatar } from "./Avatar";

interface ChatItemProps {
  chat: GChat;
  otherUser?: GUser;
  lastMessage?: GMessage;
  currentUserId: string;
  onPress: () => void;
}

export function ChatItem({ chat, otherUser, lastMessage, currentUserId, onPress }: ChatItemProps) {
  const colors = useColors();
  const isGroup = chat.type === "group";
  const displayName = isGroup ? (chat.name ?? "Groupe") : (otherUser?.name ?? "");
  const isOnline = otherUser?.lastSeen === null;
  const initials = isGroup ? "GR" : (otherUser?.initials ?? "??");
  const color = otherUser?.color ?? colors.primary;
  const hasUnread = chat.unreadCount > 0;

  const getPreview = () => {
    if (!lastMessage) return "Démarrer une conversation";
    const prefix = lastMessage.senderId === currentUserId ? "Vous: " : (isGroup ? `${users[lastMessage.senderId]?.name?.split(" ")[0] ?? ""}: ` : "");
    return prefix + lastMessage.content;
  };

  const users: Record<string, GUser> = {};

  const statusIcon = () => {
    if (!lastMessage || lastMessage.senderId !== currentUserId) return null;
    const iconProps = { size: 14, style: { marginRight: 2 } };
    if (lastMessage.status === "read") return <Ionicons name="checkmark-done" {...iconProps} color={colors.accent} />;
    if (lastMessage.status === "delivered") return <Ionicons name="checkmark-done" {...iconProps} color={colors.mutedForeground} />;
    return <Ionicons name="checkmark" {...iconProps} color={colors.mutedForeground} />;
  };

  return (
    <TouchableOpacity style={[styles.container, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <Avatar
        uri={otherUser?.avatar}
        initials={initials}
        color={color}
        size={54}
        showOnline={!isGroup}
        isOnline={isOnline}
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.text }, hasUnread && styles.nameBold]} numberOfLines={1}>
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
              style={[styles.preview, { color: hasUnread ? colors.text : colors.mutedForeground }, hasUnread && styles.previewBold]}
              numberOfLines={1}
            >
              {getPreview()}
            </Text>
          </View>
          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: colors.unreadBadge }]}>
              <Text style={styles.badgeText}>{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontSize: 15.5,
    fontFamily: "Inter_400Regular",
    flex: 1,
    marginRight: 8,
  },
  nameBold: {
    fontFamily: "Inter_600SemiBold",
  },
  time: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  preview: {
    fontSize: 13.5,
    flex: 1,
  },
  previewBold: {
    fontFamily: "Inter_500Medium",
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
