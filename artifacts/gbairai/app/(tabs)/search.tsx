import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
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
import { useAuth } from "@/contexts/AuthContext";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { buildGlobalSearchResults, type GlobalSearchResult } from "@/lib/global-search";
import { leaveOverlayScreen } from "@/lib/navigation";

function ResultIcon({ result }: { result: GlobalSearchResult }) {
  const colors = useColors();
  if (result.kind === "contact") {
    return (
      <Avatar
        uri={result.contact.avatar}
        initials={result.contact.initials}
        color={result.contact.color}
        size={44}
      />
    );
  }

  const iconName =
    result.kind === "conversation"
      ? result.chat.type === "group"
        ? "people"
        : "chatbubble"
      : result.message.type === "image"
        ? "image"
        : result.message.type === "video"
          ? "videocam"
          : result.message.type === "audio"
            ? "mic"
            : "document-text";

  return (
    <View style={[styles.iconCircle, { backgroundColor: colors.muted }]}>
      <Ionicons name={iconName} size={20} color={colors.primary} />
    </View>
  );
}

export default function GlobalSearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { isAuthenticated } = useAuth();
  const {
    chats,
    messages,
    users,
    composeContactsSnapshot,
    getOtherUser,
    startConversationWithUser,
    loadConversationMessages,
  } = useChats();
  const [query, setQuery] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const timer = setTimeout(() => {
      void Promise.all(chats.slice(0, 40).map((chat) => loadConversationMessages(chat.id)));
    }, 350);

    return () => clearTimeout(timer);
  }, [chats, loadConversationMessages, query]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      leaveOverlayScreen();
      return true;
    });
    return () => sub.remove();
  }, []);

  const results = useMemo(
    () =>
      buildGlobalSearchResults({
        query,
        chats,
        messages,
        users,
        contacts: composeContactsSnapshot,
        getOtherUser,
      }),
    [chats, composeContactsSnapshot, getOtherUser, messages, query, users],
  );

  const handlePress = async (result: GlobalSearchResult) => {
    if (result.kind === "contact") {
      if (!result.contact.userId) {
        await Share.share({
          message: "Rejoins-moi sur Gbairai : https://gbairai.app",
          title: `Inviter ${result.contact.name}`,
        });
        return;
      }
      const chatId = await startConversationWithUser(result.contact.userId);
      router.replace(`/chat/${chatId}`);
      return;
    }

    router.replace(`/chat/${result.chat.id}`);
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.headerBg },
          ]}
        >
          <TouchableOpacity onPress={leaveOverlayScreen} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.guestTitle, { color: colors.text }]}>Recherche</Text>
        </View>
        <Text style={[styles.guestMessage, { color: colors.mutedForeground }]}>
          Connectez-vous pour rechercher
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.headerBg },
          ]}
        >
          <TouchableOpacity onPress={leaveOverlayScreen} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="Mot, contact, phrase ou fichier..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.text }]}
              autoFocus
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: bottomPad + 24, flexGrow: 1 }}
          ListEmptyComponent={
            query.trim() ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={42} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun résultat</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Essayez un nom de contact, un mot dans une conversation, ou « photo », « vocal », « vidéo ».
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Recherchez parmi vos contacts et conversations.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => void handlePress(item)}
              activeOpacity={0.7}
            >
              <ResultIcon result={item} />
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {item.kind === "contact"
                    ? item.subtitle
                    : item.kind === "conversation"
                      ? item.subtitle
                      : item.subtitle}
                </Text>
              </View>
              <Text style={[styles.kindLabel, { color: colors.primary }]}>
                {item.kind === "contact" ? "Contact" : item.kind === "conversation" ? "Discussion" : "Message"}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  rowSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  kindLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingTop: 72,
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  guestTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  guestMessage: {
    textAlign: "center",
    marginTop: 80,
    paddingHorizontal: 24,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
