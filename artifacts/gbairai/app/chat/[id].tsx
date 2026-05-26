import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { GMessage, useChats } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { chats, messages, users, sendMessage, markChatAsRead, getOtherUser } = useChats();
  const listRef = useRef<FlatList<GMessage>>(null);

  const chat = chats.find((c) => c.id === id);
  const chatMessages = messages[id ?? ""] ?? [];
  const otherUser = chat ? getOtherUser(chat) : undefined;
  const isGroup = chat?.type === "group";
  const displayName = isGroup ? (chat?.name ?? "Groupe") : (otherUser?.name ?? "");
  const isOnline = otherUser?.lastSeen === null;
  const initials = isGroup ? "GR" : (otherUser?.initials ?? "??");
  const avatarColor = otherUser?.color ?? colors.primary;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (id) markChatAsRead(id);
  }, [id]);

  const handleSend = (text: string) => {
    if (!id) return;
    sendMessage(id, text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderMessage = ({ item, index }: { item: GMessage; index: number }) => {
    const isMe = item.senderId === "me";
    const isLast = index === 0;
    const sender = !isMe ? users[item.senderId] : undefined;
    return (
      <MessageBubble
        message={item}
        isMe={isMe}
        showSenderName={isGroup && !isMe}
        sender={sender}
        isLast={isLast}
      />
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerUser}
          onPress={() => otherUser && router.push(`/profile/${otherUser.id}`)}
          activeOpacity={0.8}
        >
          <Avatar uri={otherUser?.avatar} initials={initials} color={avatarColor} size={40} showOnline={!isGroup} isOnline={isOnline} />
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.headerStatus, { color: isOnline ? colors.online : colors.mutedForeground }]}>
              {isOnline ? "En ligne" : "Vu récemment"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="call-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="videocam-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Feather name="more-vertical" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={[...chatMessages].reverse()}
          keyExtractor={(m) => m.id}
          inverted
          renderItem={renderMessage}
          contentContainerStyle={[styles.messageList, { paddingBottom: 12 }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!!chatMessages.length}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
                Dites bonjour à {displayName}!
              </Text>
            </View>
          }
        />
        <ChatInput onSend={handleSend} bottomInset={bottomPad} />
      </KeyboardAvoidingView>
    </View>
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
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerUser: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerStatus: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 1 },
  headerActions: { flexDirection: "row", gap: 2 },
  actionBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  messageList: {
    paddingTop: 12,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    transform: [{ scaleY: -1 }],
    alignItems: "center",
    paddingTop: 60,
  },
  emptyChatText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
