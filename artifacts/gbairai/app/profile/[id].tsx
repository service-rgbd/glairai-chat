import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ChatOptionsSheet, type ChatOptionItem } from "@/components/ChatOptionsSheet";
import { useAuth } from "@/contexts/AuthContext";
import { formatTimestamp } from "@/lib/format-timestamp";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { assertCanStartCall } from "@/lib/call-session-client";
import { saveUserToNativeContacts } from "@/lib/native-contacts";

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const {
    users,
    chats,
    startOutgoingCall,
    startConversationWithUser,
    blockUser,
    unblockUser,
    isUserBlocked,
  } = useChats();
  const [showOptions, setShowOptions] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const currentUserId = currentUser?.id ?? "me";

  const user = id ? users[id] : undefined;
  const chat = chats.find(
    (c) =>
      c.participantIds.includes(id ?? "") &&
      c.participantIds.includes(currentUserId) &&
      c.type === "direct",
  );

  if (!user) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Profil introuvable</Text>
      </View>
    );
  }

  const isOnline = user.lastSeen === null;
  const lastSeenLabel = isOnline
    ? "En ligne"
    : user.lastSeen
      ? `Vu ${formatTimestamp(user.lastSeen)}`
      : "Hors ligne";

  const isBlocked = isUserBlocked(user.id);

  const openChat = async () => {
    if (chat) {
      router.replace(`/chat/${chat.id}`);
      return;
    }
    try {
      const conversationId = await startConversationWithUser(user.id);
      router.replace(`/chat/${conversationId}`);
    } catch (error) {
      Alert.alert(
        "Discussion impossible",
        error instanceof Error ? error.message : "Impossible d'ouvrir la conversation.",
      );
    }
  };

  const openCall = (type: "audio" | "video") => {
    if (!user || isBlocked) return;
    const conversationId = chat?.id;
    if (!conversationId) {
      Alert.alert("Appel impossible", "Envoyez d'abord un message à ce contact.");
      return;
    }
    try {
      assertCanStartCall(conversationId);
    } catch {
      Alert.alert("Occupé", "Terminez l'appel en cours avant d'en lancer un autre.");
      return;
    }
    const callId = startOutgoingCall({
      userId: user.id,
      conversationId,
      type,
    });
    router.push({
      pathname: "/call/[conversationId]",
      params: { conversationId, type, callId },
    });
  };

  const handleSaveContact = async () => {
    if (!user.phone?.trim()) {
      Alert.alert("Numéro indisponible", "Ce contact n'a pas de numéro enregistré.");
      return;
    }
    setIsSavingContact(true);
    try {
      const result = await saveUserToNativeContacts({
        name: user.name,
        phone: user.phone,
        defaultCountryCode: currentUser?.countryCode ?? "GN",
      });
      if (result.status === "permission_denied") {
        Alert.alert(
          "Permission requise",
          "Autorisez l'accès aux contacts pour enregistrer ce numéro.",
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Réglages",
              onPress: () => void Linking.openSettings(),
            },
          ],
        );
        return;
      }
      if (result.status === "already_exists") {
        Alert.alert(
          "Déjà enregistré",
          `${result.contactName} est déjà dans vos contacts avec ce numéro.`,
        );
        return;
      }
      Alert.alert("Contact enregistré", `${user.name} a été ajouté à vos contacts.`);
    } catch (error) {
      Alert.alert(
        "Échec",
        error instanceof Error ? error.message : "Impossible d'enregistrer ce contact.",
      );
    } finally {
      setIsSavingContact(false);
    }
  };

  const profileOptions: ChatOptionItem[] = [
    {
      key: "save-contact",
      label: isSavingContact ? "Enregistrement..." : "Enregistrer dans Contacts",
      icon: "person-add-outline",
      onPress: () => {
        void handleSaveContact();
      },
    },
    ...(chat
      ? [
          {
            key: "shared-media",
            label: "Médias partagés",
            icon: "images-outline" as const,
            onPress: () => router.push(`/chat-media/${chat.id}`),
          },
        ]
      : []),
    {
      key: "report",
      label: "Signaler",
      icon: "flag-outline",
      destructive: true,
      onPress: () => {
        Alert.alert("Signalement envoyé", "Merci. Notre équipe examinera ce signalement.");
      },
    },
  ];

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
            <Text style={styles.profileStatus}>{lastSeenLabel}</Text>
          </View>
        </LinearGradient>

        <View style={styles.actions}>
          <ActionButton
            icon={<Ionicons name="chatbubble-outline" size={22} color={colors.primary} />}
            label="Message"
            onPress={() => void openChat()}
          />
          <ActionButton
            icon={<Ionicons name="call-outline" size={22} color={colors.primary} />}
            label="Appel"
            onPress={() => openCall("audio")}
          />
          <ActionButton
            icon={<Ionicons name="videocam-outline" size={22} color={colors.primary} />}
            label="Vidéo"
            onPress={() => openCall("video")}
          />
          {chat ? (
            <ActionButton
              icon={<Ionicons name="images-outline" size={22} color={colors.primary} />}
              label="Médias"
              onPress={() => router.push(`/chat-media/${chat.id}`)}
            />
          ) : null}
          <ActionButton
            icon={<Feather name="more-horizontal" size={22} color={colors.primary} />}
            label="Plus"
            onPress={() => setShowOptions(true)}
          />
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.infoRow}
            activeOpacity={0.8}
            onPress={() => void handleSaveContact()}
            disabled={isSavingContact}
          >
            <View style={styles.infoCopy}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Numéro</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{user.phone}</Text>
            </View>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
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
          {chat ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.8}
                onPress={() => router.push(`/chat-media/${chat.id}`)}
              >
                <View style={styles.infoCopy}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Médias</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>Photos et vidéos partagées</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        <View style={[styles.dangerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.dangerRow}
            activeOpacity={0.7}
            onPress={() => {
              if (isBlocked) {
                void unblockUser(user.id);
                return;
              }
              Alert.alert(
                "Bloquer",
                `${user.name} ne pourra plus vous contacter et ses statuts seront masqués.`,
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Bloquer",
                    style: "destructive",
                    onPress: () => {
                      void blockUser(user.id).then(() => router.back());
                    },
                  },
                ],
              );
            }}
          >
            <Ionicons name="ban-outline" size={20} color={colors.destructive} />
            <Text style={[styles.dangerText, { color: colors.destructive }]}>
              {isBlocked ? "Débloquer" : `Bloquer ${user.name.split(" ")[0]}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ChatOptionsSheet
        visible={showOptions}
        title={user.name}
        subtitle="Options du profil"
        options={profileOptions}
        onClose={() => setShowOptions(false)}
      />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoCopy: { flex: 1, gap: 4, paddingRight: 12 },
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
