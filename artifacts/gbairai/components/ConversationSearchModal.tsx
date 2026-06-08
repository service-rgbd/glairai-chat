import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/components/SearchBar";
import type { GMessage } from "@/contexts/chats-types";
import { useColors } from "@/hooks/useColors";
import {
  searchConversationMessages,
  type ConversationSearchFilter,
} from "@/lib/conversation-search";

const FILTERS: Array<{ id: ConversationSearchFilter; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "text", label: "Texte" },
  { id: "image", label: "Photos" },
  { id: "video", label: "Vidéos" },
  { id: "audio", label: "Vocaux" },
];

interface ConversationSearchModalProps {
  visible: boolean;
  conversationTitle: string;
  messages: GMessage[];
  onClose: () => void;
  onSelectMessage: (message: GMessage) => void;
}

export function ConversationSearchModal({
  visible,
  conversationTitle,
  messages,
  onClose,
  onSelectMessage,
}: ConversationSearchModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConversationSearchFilter>("all");

  const results = useMemo(
    () => searchConversationMessages(messages, query, filter),
    [filter, messages, query],
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: topPad + 8,
              borderBottomColor: colors.border,
              backgroundColor: colors.headerBg,
            },
          ]}
        >
          <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              Rechercher
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {conversationTitle}
            </Text>
          </View>
        </View>

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Mot, photo, vidéo, vocal..."
        />

        <View style={styles.filtersRow}>
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                  },
                ]}
                onPress={() => setFilter(item.id)}
                activeOpacity={0.82}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? "#fff" : colors.text },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.message.id}
          contentContainerStyle={{ paddingBottom: bottomPad + 24, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.resultRow, { borderBottomColor: colors.border }]}
              onPress={() => {
                onSelectMessage(item.message);
                onClose();
              }}
              activeOpacity={0.82}
            >
              <View style={[styles.resultIcon, { backgroundColor: colors.muted }]}>
                <Ionicons
                  name={
                    item.message.type === "image"
                      ? "image-outline"
                      : item.message.type === "video"
                        ? "videocam-outline"
                        : item.message.type === "audio"
                          ? "mic-outline"
                          : "document-text-outline"
                  }
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.resultText}>
                <Text style={[styles.resultTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.resultSubtitle, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {item.subtitle}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={42} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {query.trim()
                  ? "Aucun résultat dans cette conversation"
                  : "Recherchez un mot ou filtrez les médias"}
              </Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 1 },
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  resultText: { flex: 1, minWidth: 0, gap: 2 },
  resultTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  resultSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
});
