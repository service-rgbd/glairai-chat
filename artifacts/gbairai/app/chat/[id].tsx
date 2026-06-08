import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeKeyboardAvoidingView as KeyboardAvoidingView } from "@/components/SafeKeyboardAvoidingView";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ChatInput } from "@/components/ChatInput";
import { ChatWallpaper } from "@/components/ChatWallpaper";
import { MessageActionsModal } from "@/components/MessageActionsModal";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageEditModal } from "@/components/MessageEditModal";
import { useAuth } from "@/contexts/AuthContext";
import type { GMessage } from "@/contexts/chats-types";
import { formatHistorySectionLabel, formatTimestamp, getHistoryDateKey } from "@/lib/format-timestamp";
import { useChats } from "@/contexts/chats-context-ref";
import { useChatWallpaper } from "@/hooks/useChatWallpaper";
import { useColors } from "@/hooks/useColors";
import {
  getGroupDisplayColor,
  getGroupDisplayInitials,
  getGroupMemberCountLabel,
} from "@/lib/group-utils";
import {
  getDeleteMessageTitle,
  getMessageActionAvailability,
} from "@/lib/message-actions";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { wallpaperId } = useChatWallpaper();
  const { currentUser } = useAuth();
  const {
    chats,
    messages,
    users,
    sendMessage,
    sendEmoji3dMessage,
    sendAudioMessage,
    sendImageMessage,
    sendVideoMessage,
    deleteMessage,
    editMessage,
    setTypingState,
    typingByConversation,
    markChatAsRead,
    getOtherUser,
    startOutgoingCall,
    loadConversationMessages,
    joinConversationRealtime,
    leaveConversationRealtime,
  } = useChats();
  const listRef = useRef<FlatList<GMessage>>(null);
  const currentUserId = currentUser?.id ?? "me";
  const [selectedMessage, setSelectedMessage] = useState<GMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<GMessage | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const chat = chats.find((c) => c.id === id);
  const chatMessages = messages[id ?? ""] ?? [];
  const otherUser = chat ? getOtherUser(chat) : undefined;
  const isGroup = chat?.type === "group";
  const displayName = isGroup ? (chat?.name ?? "Groupe") : (otherUser?.name ?? "");
  const isOnline = !isGroup && otherUser?.lastSeen === null;
  const typingUsers = id ? typingByConversation[id] ?? [] : [];
  const isOtherUserTyping = !isGroup && otherUser ? typingUsers.includes(otherUser.id) : false;
  const groupTypingLabel =
    isGroup && typingUsers.length
      ? `${users[typingUsers[0]!]?.name?.split(" ")[0] ?? "Quelqu'un"} écrit...`
      : null;
  const statusText = isGroup
    ? groupTypingLabel ?? getGroupMemberCountLabel(chat?.participantIds.length ?? 0)
    : isOnline
      ? "En ligne"
      : otherUser?.lastSeen
        ? `Vu ${formatTimestamp(otherUser.lastSeen)}`
        : "Hors ligne";
  const initials = isGroup
    ? getGroupDisplayInitials(chat!, users, currentUserId)
    : (otherUser?.initials ?? "??");
  const avatarColor = isGroup ? getGroupDisplayColor(chat?.id ?? "") : (otherUser?.color ?? colors.primary);
  const avatarUri = isGroup ? (chat?.avatarUrl ?? null) : (otherUser?.avatar ?? null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    if (!id) return;
    void loadConversationMessages(id);
    joinConversationRealtime(id);
    return () => {
      leaveConversationRealtime(id);
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if ((messages[id] ?? []).length === 0) return;
    markChatAsRead(id);
  }, [id, messages[id ?? ""]?.length]);

  const handleSendEmoji3d = (payload: import("@/lib/emoji-messages").Emoji3dMessagePayload) => {
    if (!id) return;
    sendEmoji3dMessage(id, payload);
  };

  const handleSend = (text: string) => {
    if (!id) return;
    sendMessage(id, text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openCall = (type: "audio" | "video") => {
    if (!id || !otherUser || isGroup) return;
    const callId = startOutgoingCall({
      userId: otherUser.id,
      conversationId: id,
      type,
    });
    router.push({
      pathname: "/call/[conversationId]",
      params: { conversationId: id, type, callId },
    });
  };

  const selectedMessageActions = selectedMessage
    ? getMessageActionAvailability(selectedMessage, currentUserId)
    : { canEdit: false, canDelete: false, isWithinWindow: false };

  const handleMessageLongPress = (message: GMessage) => {
    const availability = getMessageActionAvailability(message, currentUserId);
    if (!availability.canEdit && !availability.canDelete) {
      if (message.senderId === currentUserId && !availability.isWithinWindow) {
        Alert.alert(
          "Action impossible",
          "Vous ne pouvez modifier ou supprimer un message que dans les 15 minutes suivant l'envoi.",
        );
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
    setShowActionsModal(true);
  };

  const handleDeleteMessage = (message: GMessage) => {
    if (!id) return;

    Alert.alert(
      getDeleteMessageTitle(message.type),
      "Ce contenu sera supprimé de la conversation.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void deleteMessage(id, message.id)
              .then(() => {
                setSelectedMessage(null);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              })
              .catch((error) => {
                Alert.alert(
                  "Suppression impossible",
                  error instanceof Error
                    ? error.message
                    : "Impossible de supprimer ce message.",
                );
              });
          },
        },
      ],
    );
  };

  const handleSaveEdit = (content: string) => {
    if (!id || !editingMessage) return;
    setIsSavingEdit(true);
    void editMessage(id, editingMessage.id, content)
      .then(() => {
        setShowEditModal(false);
        setEditingMessage(null);
        setSelectedMessage(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((error) => {
        Alert.alert(
          "Modification impossible",
          error instanceof Error ? error.message : "Impossible de modifier ce message.",
        );
      })
      .finally(() => {
        setIsSavingEdit(false);
      });
  };

  const closeMessageActions = () => {
    setShowActionsModal(false);
    setSelectedMessage(null);
  };

  const renderMessage = ({ item, index }: { item: GMessage; index: number }) => {
    const isMe = item.senderId === currentUserId;
    const isLast = index === 0;
    const sender = !isMe ? users[item.senderId] : undefined;
    const availability = getMessageActionAvailability(item, currentUserId);
    const reversedMessages = [...chatMessages].reverse();
    const showDateSeparator =
      index === reversedMessages.length - 1 ||
      (index > 0 && getHistoryDateKey(item.timestamp) !== getHistoryDateKey(reversedMessages[index - 1]!.timestamp));
    const profileUser = isMe
      ? currentUser
        ? {
            avatar: currentUser.avatarUrl,
            initials: currentUser.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            color: colors.primary,
          }
        : undefined
      : sender ?? (otherUser
          ? { avatar: otherUser.avatar, initials: otherUser.initials, color: otherUser.color }
          : undefined);

    return (
      <View>
        {showDateSeparator ? (
          <View style={styles.dateSeparatorWrap}>
            <View style={[styles.dateSeparator, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.dateSeparatorText, { color: colors.mutedForeground }]}>
                {formatHistorySectionLabel(item.timestamp)}
              </Text>
            </View>
          </View>
        ) : null}
        <MessageBubble
          message={item}
          isMe={isMe}
          showSenderName={isGroup && !isMe}
          sender={sender}
          profileUser={profileUser}
          isLast={isLast}
          onLongPress={
            availability.canEdit || availability.canDelete
              ? () => handleMessageLongPress(item)
              : undefined
          }
        />
      </View>
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
          onPress={() => {
            if (isGroup && id) {
              router.push(`/group/${id}`);
              return;
            }
            if (otherUser) {
              router.push(`/profile/${otherUser.id}`);
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.headerAvatarWrap}>
            <Avatar uri={avatarUri} initials={initials} color={avatarColor} size={40} showOnline={!isGroup} isOnline={isOnline} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            <Text
              style={[
                styles.headerStatus,
                {
                  color:
                    groupTypingLabel || isOtherUserTyping
                      ? colors.primary
                      : isOnline
                        ? colors.online
                        : colors.mutedForeground,
                },
              ]}
            >
              {groupTypingLabel ?? (isOtherUserTyping ? "en train d'écrire..." : statusText)}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {!isGroup ? (
            <>
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => openCall("audio")}>
                <Ionicons name="call-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => openCall("video")}>
                <Ionicons name="videocam-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (isGroup && id) {
                router.push(`/group/${id}`);
              }
            }}
          >
            <Feather name="more-vertical" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <View style={styles.messagesPane}>
          <ChatWallpaper wallpaperId={wallpaperId} />
          <FlatList
            ref={listRef}
            data={[...chatMessages].reverse()}
            keyExtractor={(m) => m.id}
            inverted
            renderItem={renderMessage}
            style={styles.messageListView}
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
        </View>
        <ChatInput
          conversationId={id}
          onSend={handleSend}
          onSendEmoji3d={handleSendEmoji3d}
          onSendAudio={(payload) => {
            if (!id) return;
            sendAudioMessage(id, payload);
          }}
          onSendImage={(payload) => {
            if (!id) return;
            sendImageMessage(id, payload);
          }}
          onSendVideo={(payload) => {
            if (!id) return;
            sendVideoMessage(id, payload);
          }}
          onTypingChange={(isTyping) => {
            if (!id) return;
            setTypingState(id, isTyping);
          }}
          bottomInset={bottomPad}
        />
      </KeyboardAvoidingView>

      <MessageActionsModal
        visible={showActionsModal}
        message={selectedMessage}
        canEdit={selectedMessageActions.canEdit}
        canDelete={selectedMessageActions.canDelete}
        onClose={closeMessageActions}
        onEdit={() => {
          if (!selectedMessage) return;
          setEditingMessage(selectedMessage);
          setShowActionsModal(false);
          setShowEditModal(true);
        }}
        onDelete={() => {
          if (!selectedMessage) return;
          const message = selectedMessage;
          setShowActionsModal(false);
          setSelectedMessage(null);
          handleDeleteMessage(message);
        }}
      />

      <MessageEditModal
        visible={showEditModal}
        initialContent={editingMessage?.content ?? ""}
        isSaving={isSavingEdit}
        onClose={() => {
          if (isSavingEdit) return;
          setShowEditModal(false);
          setEditingMessage(null);
        }}
        onSave={handleSaveEdit}
      />
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
    minWidth: 0,
  },
  headerAvatarWrap: {
    flexShrink: 0,
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  headerStatus: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 1 },
  headerActions: { flexDirection: "row", gap: 2 },
  actionBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  messagesPane: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  messageListView: {
    backgroundColor: "transparent",
  },
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
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  dateSeparatorWrap: {
    alignItems: "center",
    marginVertical: 10,
  },
  dateSeparator: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
