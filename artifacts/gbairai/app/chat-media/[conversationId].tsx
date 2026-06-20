import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChats } from "@/contexts/chats-context-ref";
import { collectConversationMedia } from "@/lib/conversation-media";
import { useColors } from "@/hooks/useColors";

const NUM_COLUMNS = 3;
const GAP = 3;

export default function ConversationMediaScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { chats, messages, loadConversationMessages } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const chat = chats.find((item) => item.id === conversationId);
  const chatMessages = conversationId ? (messages[conversationId] ?? []) : [];
  const mediaItems = useMemo(() => collectConversationMedia(chatMessages), [chatMessages]);

  useEffect(() => {
    if (!conversationId) return;
    void loadConversationMessages(conversationId);
  }, [conversationId, loadConversationMessages]);

  const title = chat?.type === "group" ? (chat.name ?? "Groupe") : "Médias partagés";

  const openItem = (index: number) => {
    const item = mediaItems[index];
    if (!item || !conversationId) return;
    router.push({
      pathname: "/media-viewer",
      params: {
        chatId: conversationId,
        type: item.type,
        url: item.url,
        key: item.key,
        mimeType: item.mimeType,
        width: item.width ? String(item.width) : "",
        height: item.height ? String(item.height) : "",
        durationSeconds: item.durationSeconds ? String(item.durationSeconds) : "",
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {mediaItems.length} média{mediaItems.length > 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {chatMessages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : mediaItems.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="images-outline" size={42} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Aucune photo ou vidéo dans cette conversation.
          </Text>
        </View>
      ) : (
        <FlatList
          data={mediaItems}
          keyExtractor={(item) => item.messageId}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.cell}
              activeOpacity={0.85}
              onPress={() => openItem(index)}
            >
              <Image
                source={{ uri: item.type === "video" ? item.thumbnailUrl ?? item.url : item.url }}
                style={styles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              {item.type === "video" ? (
                <View style={styles.videoBadge}>
                  <Ionicons name="play" size={16} color="#fff" />
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  grid: {
    padding: GAP,
    paddingBottom: 24,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#1E293B",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
