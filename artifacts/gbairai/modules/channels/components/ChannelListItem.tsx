import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";

import type { Channel } from "../types";

function formatFollowers(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(".0", "")} M followers`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(".0", "")} K followers`;
  return `${count} followers`;
}

type ChannelListItemProps = {
  channel: Channel;
  onPress: () => void;
  onFollowPress?: () => void;
  followLoading?: boolean;
};

export function ChannelListItem({
  channel,
  onPress,
  onFollowPress,
  followLoading = false,
}: ChannelListItemProps) {
  const colors = useColors();
  const initials = channel.name.slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Avatar uri={channel.avatarUrl} initials={initials} color="#6D4AFF" size={52} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.isVerified ? (
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          ) : null}
        </View>
        <Text style={[styles.followers, { color: colors.mutedForeground }]} numberOfLines={1}>
          {formatFollowers(channel.followersCount)}
        </Text>
      </View>
      {onFollowPress ? (
        <TouchableOpacity
          style={[
            styles.followBtn,
            {
              backgroundColor: channel.isFollowing ? colors.card : "rgba(37, 211, 102, 0.14)",
              borderColor: channel.isFollowing ? colors.border : "transparent",
            },
          ]}
          onPress={(event) => {
            event.stopPropagation();
            onFollowPress();
          }}
          disabled={followLoading}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.followText,
              { color: channel.isFollowing ? colors.mutedForeground : "#1FA855" },
            ]}
          >
            {channel.isFollowing ? "Suivi" : "Suivre"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  followers: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  followBtn: {
    minWidth: 84,
    height: 34,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  followText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
