import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useChats } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { users, chats } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const user = id ? users[id] : undefined;
  const chat = chats.find((c) => c.participantIds.includes(id ?? "") && c.participantIds.includes("me") && c.type === "direct");

  if (!user) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Profil introuvable</Text>
      </View>
    );
  }

  const isOnline = user.lastSeen === null;

  const ActionButton = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) => (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.8}>
      {icon}
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
        <LinearGradient
          colors={[user.color, colors.background]}
          style={[styles.headerGrad, { paddingTop: topPad + 12 }]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>

          <View style={styles.avatarSection}>
            <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={100} showOnline isOnline={isOnline} />
            <Text style={styles.profileName}>{user.name}</Text>
            <Text style={styles.profileStatus}>
              {isOnline ? "En ligne" : "Vu récemment"}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.actions}>
          <ActionButton
            icon={<Ionicons name="chatbubble-outline" size={22} color={colors.primary} />}
            label="Message"
            onPress={() => chat && router.replace(`/chat/${chat.id}`)}
          />
          <ActionButton
            icon={<Ionicons name="call-outline" size={22} color={colors.primary} />}
            label="Appel"
            onPress={() => {}}
          />
          <ActionButton
            icon={<Ionicons name="videocam-outline" size={22} color={colors.primary} />}
            label="Vidéo"
            onPress={() => {}}
          />
          <ActionButton
            icon={<Feather name="more-horizontal" size={22} color={colors.primary} />}
            label="Plus"
            onPress={() => {}}
          />
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Numéro</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user.phone}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Bio</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user.bio || "Aucune bio"}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Statut</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user.status}</Text>
          </View>
        </View>

        <View style={[styles.dangerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.dangerRow} activeOpacity={0.7}>
            <Ionicons name="ban-outline" size={20} color={colors.destructive} />
            <Text style={[styles.dangerText, { color: colors.destructive }]}>Bloquer {user.name.split(" ")[0]}</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.dangerRow} activeOpacity={0.7}>
            <Ionicons name="flag-outline" size={20} color={colors.destructive} />
            <Text style={[styles.dangerText, { color: colors.destructive }]}>Signaler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerGrad: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarSection: { alignItems: "center", gap: 10 },
  profileName: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  profileStatus: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
    borderRadius: 14,
  },
  actionLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  infoCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    overflow: "hidden",
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  infoLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  infoValue: { fontSize: 15, fontFamily: "Inter_400Regular" },
  divider: { height: StyleSheet.hairlineWidth },
  dangerCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dangerText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
