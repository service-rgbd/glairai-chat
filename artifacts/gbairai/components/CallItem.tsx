import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { GCall, GUser } from "@/contexts/chats-types";
import { formatTimestamp } from "@/lib/format-timestamp";
import { useColors } from "@/hooks/useColors";

import { Avatar } from "./Avatar";

interface CallItemProps {
  call: GCall;
  user: GUser;
  onPress: () => void;
}

export function CallItem({ call, user, onPress }: CallItemProps) {
  const colors = useColors();
  const isIncoming = call.direction === "incoming";
  const isNegative = call.failed || call.missed;
  const iconColor = isNegative ? colors.missedCall : isIncoming ? colors.accent : colors.primary;

  const getStatusLabel = () => {
    const time = formatTimestamp(call.timestamp);
    if (call.failed) return `${time} · Échec`;
    if (call.missed) return "Appel manqué";
    return time;
  };

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={52} showOnline isOnline={user.lastSeen === null} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: isNegative ? colors.missedCall : colors.text }]}>{user.name}</Text>
        <View style={styles.subRow}>
          <Ionicons
            name={isIncoming ? "arrow-down" : "arrow-up"}
            size={12}
            color={iconColor}
          />
          <Text style={[styles.meta, { color: call.failed ? colors.missedCall : colors.mutedForeground }]}>
            {call.type === "video" ? "Vidéo" : "Audio"} · {getStatusLabel()}
            {call.duration ? ` · ${call.duration}` : ""}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.callBtn} onPress={onPress} activeOpacity={0.7}>
        <Ionicons
          name={call.type === "video" ? "videocam-outline" : "call-outline"}
          size={22}
          color={colors.primary}
        />
      </TouchableOpacity>
    </View>
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
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15.5,
    fontFamily: "Inter_500Medium",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  callBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
});
