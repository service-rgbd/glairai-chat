import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { SearchBar } from "@/components/SearchBar";
import type { ComposeContactOption } from "@/contexts/chats-types";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";

export default function ContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { composeContactsSnapshot, getComposeContacts, startConversationWithUser, updateSavedContactName } =
    useChats();
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ComposeContactOption[]>(() => composeContactsSnapshot);
  const [loading, setLoading] = useState(() => composeContactsSnapshot.length === 0);
  const [renameTarget, setRenameTarget] = useState<ComposeContactOption | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (composeContactsSnapshot.length === 0) return;
    setContacts(composeContactsSnapshot);
    setLoading(false);
  }, [composeContactsSnapshot]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await getComposeContacts();
        if (!cancelled) {
          setContacts(next);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [getComposeContacts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.phone.toLowerCase().includes(query),
    );
  }, [contacts, search]);

  const handleInvite = async (item: ComposeContactOption) => {
    await Share.share({
      message: `Rejoins-moi sur Gbairai : https://gbairai.app`,
      title: `Inviter ${item.name}`,
    });
  };

  const handlePress = async (item: ComposeContactOption) => {
    if (!item.userId) {
      await handleInvite(item);
      return;
    }
    const chatId = await startConversationWithUser(item.userId);
    router.push(`/chat/${chatId}`);
  };

  const openRename = (item: ComposeContactOption) => {
    setRenameTarget(item);
    setRenameValue(item.name);
  };

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setIsRenaming(true);
    try {
      await updateSavedContactName(renameTarget.phone, renameValue.trim());
      setContacts((current) =>
        current.map((contact) =>
          contact.id === renameTarget.id
            ? { ...contact, name: renameValue.trim(), initials: renameValue.trim().slice(0, 2).toUpperCase() }
            : contact,
        ),
      );
      setRenameTarget(null);
    } catch (error) {
      Alert.alert(
        "Renommage impossible",
        error instanceof Error ? error.message : "Impossible de renommer ce contact.",
      );
    } finally {
      setIsRenaming(false);
    }
  };

  const handleLongPress = (item: ComposeContactOption) => {
    if (item.contactSource !== "story_reply" && item.contactSource !== "manual") {
      return;
    }

    Alert.alert(item.name, "Contact ajouté automatiquement via une réponse à un statut.", [
      { text: "Annuler", style: "cancel" },
      { text: "Renommer", onPress: () => openRename(item) },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: colors.headerBg },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Contacts</Text>
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Rechercher un contact..." />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: bottomPad + 96, flexGrow: 1 }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Chargement des contacts...
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Aucun contact disponible
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => void handlePress(item)}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={350}
            activeOpacity={0.7}
          >
            <Avatar uri={item.avatar} initials={item.initials} color={item.color} size={46} />
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>{item.phone}</Text>
              {item.isRegistered ? (
                <Text style={[styles.registered, { color: colors.primary }]}>
                  {item.contactSource === "story_reply" ? "Ajouté via statut" : "Sur Gbairai"}
                </Text>
              ) : (
                <Text style={[styles.invite, { color: colors.primary }]}>Inviter</Text>
              )}
            </View>
            {item.userId ? (
              <Ionicons name="chatbubble-outline" size={20} color={colors.mutedForeground} />
            ) : (
              <Ionicons name="share-outline" size={20} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
        )}
      />

      <Modal visible={Boolean(renameTarget)} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Renommer le contact</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Nom du contact"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRenameTarget(null)} style={styles.modalBtn} activeOpacity={0.7}>
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void submitRename()}
                style={styles.modalBtn}
                disabled={!renameValue.trim() || isRenaming}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: colors.primary }]}>
                  {isRenaming ? "Enregistrement..." : "Enregistrer"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  registered: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  invite: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 18,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  modalBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
