import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import type { GroupMemberInvite } from "@/lib/group-member-invites";
import { getGroupDisplayColor, initialsFromName } from "@/lib/group-utils";
import { useColors } from "@/hooks/useColors";

type Props = {
  invites: GroupMemberInvite[];
  busyInviteId?: string | null;
  onAccept: (invite: GroupMemberInvite) => void;
  onDecline: (invite: GroupMemberInvite) => void;
};

export function GroupInviteBanner({ invites, busyInviteId, onAccept, onDecline }: Props) {
  const colors = useColors();
  if (!invites.length) return null;

  return (
    <View style={styles.wrap}>
      {invites.map((invite) => {
        const busy = busyInviteId === invite.id;
        const title = invite.conversationTitle?.trim() || "Groupe";
        return (
          <View
            key={invite.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Avatar
              uri={invite.conversationAvatarUrl}
              initials={initialsFromName(title)}
              color={getGroupDisplayColor(invite.conversationId)}
              size={44}
            />
            <View style={styles.body}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                {invite.invitedByName} vous invite à rejoindre ce groupe
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.declineBtn, { borderColor: colors.border }]}
                onPress={() => onDecline(invite)}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                onPress={() => onAccept(invite)}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.acceptText}>Rejoindre</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  declineBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    minWidth: 84,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
