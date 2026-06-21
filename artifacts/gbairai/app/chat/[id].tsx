import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeKeyboardAvoidingView as KeyboardAvoidingView } from "@/components/SafeKeyboardAvoidingView";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { AnimatedIncomingMessage } from "@/components/AnimatedIncomingMessage";
import { GroupCallMemberPicker } from "@/components/GroupCallMemberPicker";
import { ChatInput } from "@/components/ChatInput";
import { ChatOptionsSheet } from "@/components/ChatOptionsSheet";
import { ChatWallpaper } from "@/components/ChatWallpaper";
import { ConversationSearchModal } from "@/components/ConversationSearchModal";
import { MessageActionsModal } from "@/components/MessageActionsModal";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageEditModal } from "@/components/MessageEditModal";
import { MessageReactionPicker } from "@/components/MessageReactionPicker";
import { SwipeableMessageRow } from "@/components/SwipeableMessageRow";
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
import { assertCanStartCall } from "@/lib/call-session-client";
import {
  getDeleteMessageTitle,
  getMessageActionAvailability,
} from "@/lib/message-actions";
import { buildMessageReplyRef, type MessageReplyRef } from "@/lib/message-reply";

const HEADER_BODY_HEIGHT = 62;

export default function ChatScreen() {
  const { id, recordVoice } = useLocalSearchParams<{ id: string; recordVoice?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { wallpaperId } = useChatWallpaper();
  const { currentUser } = useAuth();
  const {
    chats,
    messages,
    users,
    sendMessage,
    reactToMessage,
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
    blockUser,
    unblockUser,
    archiveConversation,
    isUserBlocked,
  } = useChats();
  const listRef = useRef<FlatList<GMessage>>(null);
  const displayedMessageIdsRef = useRef<Set<string>>(new Set());
  const chatMessagesInitializedRef = useRef(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [incomingAnimatedIds, setIncomingAnimatedIds] = useState<Set<string>>(() => new Set());
  const currentUserId = currentUser?.id ?? "me";
  const [selectedMessage, setSelectedMessage] = useState<GMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<GMessage | null>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showConversationSearch, setShowConversationSearch] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [groupCallPickerOpen, setGroupCallPickerOpen] = useState(false);
  const [pendingGroupCallType, setPendingGroupCallType] = useState<"audio" | "video">("audio");
  const [replyingTo, setReplyingTo] = useState<MessageReplyRef | null>(null);
  const [reactionPickerMessage, setReactionPickerMessage] = useState<GMessage | null>(null);

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
  const isBlockedContact = !isGroup && otherUser ? isUserBlocked(otherUser.id) : false;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const INPUT_DOCK_HEIGHT = 76;
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputBottomInset = keyboardOpen ? 0 : bottomPad;
  const listBottomPadding = keyboardOpen
    ? keyboardHeight + INPUT_DOCK_HEIGHT + 10
    : bottomPad + INPUT_DOCK_HEIGHT;
  const topFadeHeight = topPad + HEADER_BODY_HEIGHT + 28;

  useEffect(() => {
    if (!id) return;
    chatMessagesInitializedRef.current = false;
    displayedMessageIdsRef.current.clear();
    setIncomingAnimatedIds(new Set());
    setHistoryReady(false);

    void loadConversationMessages(id).finally(() => {
      setHistoryReady(true);
    });
    joinConversationRealtime(id);
    return () => {
      leaveConversationRealtime(id);
    };
  }, [id]);

  useEffect(() => {
    if (!historyReady) return;

    const newIncomingMessages = chatMessages.filter(
      (message) =>
        message.senderId !== currentUserId && !displayedMessageIdsRef.current.has(message.id),
    );

    for (const message of chatMessages) {
      displayedMessageIdsRef.current.add(message.id);
    }

    if (!chatMessagesInitializedRef.current) {
      chatMessagesInitializedRef.current = true;
      return;
    }

    if (!newIncomingMessages.length) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIncomingAnimatedIds((prev) => {
      const next = new Set(prev);
      for (const message of newIncomingMessages) {
        next.add(message.id);
      }
      return next;
    });
  }, [chatMessages, currentUserId, historyReady]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardOpen(true);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardOpen(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!keyboardOpen || chatMessages.length === 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [keyboardOpen, keyboardHeight, chatMessages.length]);

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
    sendMessage(id, text, replyingTo ? { replyTo: replyingTo } : undefined);
    setReplyingTo(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getMessageSenderName = (message: GMessage) => {
    if (message.senderId === currentUserId) {
      return currentUser?.name ?? "Vous";
    }
    return users[message.senderId]?.name ?? "Contact";
  };

  const startReplyToMessage = (message: GMessage) => {
    if (message.isDeleted) return;
    setReplyingTo(buildMessageReplyRef(message, getMessageSenderName(message)));
  };

  const handleMessageReaction = (message: GMessage, emoji: string) => {
    if (!id || message.isDeleted) return;
    void reactToMessage(id, message.id, emoji).catch((error) => {
      Alert.alert(
        "Réaction impossible",
        error instanceof Error ? error.message : "Impossible d'ajouter cette réaction.",
      );
    });
  };

  const groupMembers = isGroup
    ? (chat?.participantIds ?? [])
        .filter((memberId) => memberId !== currentUserId)
        .map((memberId) => users[memberId])
        .filter((member): member is NonNullable<typeof member> => Boolean(member))
    : [];
  const canSendGroupMedia = !isBlockedContact;

  const launchCall = (type: "audio" | "video", calleeUserIds?: string[]) => {
    if (!id || isBlockedContact) return;
    try {
      assertCanStartCall(id);
    } catch {
      Alert.alert("Occupé", "Terminez l'appel en cours avant d'en lancer un autre.");
      return;
    }
    const logUserId = otherUser?.id ?? calleeUserIds?.[0] ?? groupMembers[0]?.id;
    if (!logUserId) return;
    const callId = startOutgoingCall({
      userId: logUserId,
      conversationId: id,
      type,
    });
    router.push({
      pathname: "/call/[conversationId]",
      params: {
        conversationId: id,
        type,
        callId,
        ...(calleeUserIds?.length ? { calleeUserIds: calleeUserIds.join(",") } : {}),
      },
    });
  };

  const openCall = (type: "audio" | "video") => {
    if (!id || isBlockedContact) return;
    if (isGroup) {
      if (!groupMembers.length) {
        Alert.alert("Appel impossible", "Aucun autre membre dans ce groupe.");
        return;
      }
      setPendingGroupCallType(type);
      setGroupCallPickerOpen(true);
      return;
    }
    if (!otherUser) return;
    launchCall(type);
  };

  const handleSelectSearchMessage = (message: GMessage) => {
    const reversedMessages = [...chatMessages].reverse();
    const index = reversedMessages.findIndex((item) => item.id === message.id);
    if (index < 0) {
      return;
    }
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    });
  };

  const chatMenuOptions = [
    {
      key: "search",
      label: "Rechercher",
      icon: "search-outline" as const,
      onPress: () => setShowConversationSearch(true),
    },
    {
      key: "media",
      label: "Médias partagés",
      icon: "images-outline" as const,
      onPress: () => {
        if (!id) return;
        router.push(`/chat-media/${id}`);
      },
    },
    {
      key: "archive",
      label: chat?.isArchived ? "Désarchiver" : "Archiver",
      icon: "archive-outline" as const,
      onPress: () => {
        if (!id) return;
        void archiveConversation(id, !chat?.isArchived)
          .then(() => {
            if (!chat?.isArchived) {
              router.back();
            }
          })
          .catch((error) => {
            Alert.alert(
              "Action impossible",
              error instanceof Error ? error.message : "Impossible d'archiver cette conversation.",
            );
          });
      },
    },
    ...(isGroup && id
      ? [
          {
            key: "group-info",
            label: "Infos du groupe",
            icon: "people-outline" as const,
            onPress: () => router.push(`/group/${id}`),
          },
        ]
      : []),
    ...(!isGroup && otherUser
      ? [
          {
            key: "report",
            label: "Signaler",
            icon: "flag-outline" as const,
            onPress: () => {
              Alert.alert(
                "Signalement envoyé",
                "Merci. Notre équipe examinera ce signalement.",
              );
            },
          },
          {
            key: "block",
            label: isBlockedContact ? "Débloquer" : `Bloquer ${otherUser.name.split(" ")[0]}`,
            icon: "ban-outline" as const,
            destructive: !isBlockedContact,
            onPress: () => {
              if (isBlockedContact) {
                Alert.alert(
                  "Débloquer",
                  `Autoriser à nouveau ${otherUser.name} ?`,
                  [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Débloquer",
                      onPress: () => {
                        void unblockUser(otherUser.id).catch(() => undefined);
                      },
                    },
                  ],
                );
                return;
              }
              Alert.alert(
                "Bloquer",
                `${otherUser.name} ne pourra plus vous contacter et ses statuts seront masqués.`,
                [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Bloquer",
                    style: "destructive",
                    onPress: () => {
                      void blockUser(otherUser.id)
                        .then(() => router.back())
                        .catch((error) => {
                          Alert.alert(
                            "Action impossible",
                            error instanceof Error ? error.message : "Impossible de bloquer cet utilisateur.",
                          );
                        });
                    },
                  },
                ],
              );
            },
          },
        ]
      : []),
  ];

  const selectedMessageActions = selectedMessage
    ? getMessageActionAvailability(selectedMessage, currentUserId)
    : { canEdit: false, canDelete: false, isWithinWindow: false };

  const handleMessageLongPress = (message: GMessage) => {
    if (message.isDeleted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReactionPickerMessage(message);
  };

  const openMessageActionsFromPicker = () => {
    if (!reactionPickerMessage) return;
    const availability = getMessageActionAvailability(reactionPickerMessage, currentUserId);
    if (!availability.canEdit && !availability.canDelete) {
      if (reactionPickerMessage.senderId === currentUserId && !availability.isWithinWindow) {
        Alert.alert(
          "Action impossible",
          "Vous ne pouvez modifier ou supprimer un message que dans les 15 minutes suivant l'envoi.",
        );
      }
      return;
    }
    setSelectedMessage(reactionPickerMessage);
    setReactionPickerMessage(null);
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
        <AnimatedIncomingMessage animate={!isMe && incomingAnimatedIds.has(item.id)}>
          <SwipeableMessageRow
            enabled={!item.isDeleted && !isBlockedContact}
            onReply={() => startReplyToMessage(item)}
          >
            <MessageBubble
              message={item}
              isMe={isMe}
              showSenderName={isGroup && !isMe}
              sender={sender}
              profileUser={profileUser}
              isLast={isLast}
              onLongPress={() => handleMessageLongPress(item)}
              onReactionPress={(emoji) => handleMessageReaction(item, emoji)}
            />
          </SwipeableMessageRow>
        </AnimatedIncomingMessage>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ChatWallpaper wallpaperId={wallpaperId} />

      <View style={styles.screenContent}>
        <FlatList
          ref={listRef}
          data={[...chatMessages].reverse()}
          keyExtractor={(m) => m.id}
          inverted
          renderItem={renderMessage}
          style={styles.messageListFullBleed}
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: topFadeHeight, paddingTop: listBottomPadding, backgroundColor: "transparent" },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!!chatMessages.length}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
                Dites bonjour à {displayName}!
              </Text>
            </View>
          }
        />

        <View style={[styles.floatingHeader, { paddingTop: topPad + 8 }]}>
        <View style={styles.headerLeftCluster}>
          <View style={[styles.backPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backPillBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            {(chat?.unreadCount ?? 0) > 0 ? (
              <View style={styles.backBadge}>
                <Text style={styles.backBadgeText}>
                  {chat!.unreadCount > 99 ? "99+" : chat!.unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.headerAvatarRing, { borderColor: avatarColor, backgroundColor: colors.card }]}
            onPress={() => {
              if (isGroup && id) {
                router.push(`/group/${id}`);
                return;
              }
              if (otherUser) {
                router.push(`/profile/${otherUser.id}`);
              }
            }}
            activeOpacity={0.82}
          >
            <Avatar uri={avatarUri} initials={initials} color={avatarColor} size={36} showOnline={!isGroup} isOnline={isOnline} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.headerCenterPill, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {
            if (isGroup && id) {
              router.push(`/group/${id}`);
              return;
            }
            if (otherUser) {
              router.push(`/profile/${otherUser.id}`);
            }
          }}
          activeOpacity={0.82}
        >
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
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
            numberOfLines={1}
          >
            {groupTypingLabel ?? (isOtherUserTyping ? "en train d'écrire..." : statusText)}
          </Text>
        </TouchableOpacity>

        <View style={styles.headerRightCluster}>
          {!isBlockedContact ? (
            <>
              <TouchableOpacity
                style={[styles.headerCircleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => openCall("audio")}
              >
                <Ionicons name="call-outline" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerCircleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                activeOpacity={0.7}
                onPress={() => openCall("video")}
              >
                <Ionicons name="videocam-outline" size={18} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity
            style={[styles.headerCircleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => setShowChatOptions(true)}
          >
            <Feather name="more-vertical" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        </View>

        <KeyboardAvoidingView style={styles.inputDock} behavior="padding" keyboardVerticalOffset={0}>
          {isBlockedContact ? (
            <View style={[styles.blockedBanner, { backgroundColor: colors.muted }]}>
              <Text style={[styles.blockedBannerText, { color: colors.mutedForeground }]}>
                Vous avez bloqué {otherUser?.name?.split(" ")[0] ?? "cet utilisateur"}. Vous ne recevrez plus ses messages.
              </Text>
            </View>
          ) : null}
          {!isBlockedContact ? (
          <ChatInput
            conversationId={id}
            allowMedia={canSendGroupMedia}
            autoStartVoiceRecording={recordVoice === "1"}
            replyTo={replyingTo}
            onClearReply={() => setReplyingTo(null)}
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
            bottomInset={inputBottomInset}
          />
          ) : null}
        </KeyboardAvoidingView>
      </View>

      <MessageReactionPicker
        visible={Boolean(reactionPickerMessage)}
        message={reactionPickerMessage}
        onClose={() => setReactionPickerMessage(null)}
        onSelectEmoji={(emoji) => {
          if (!reactionPickerMessage) return;
          handleMessageReaction(reactionPickerMessage, emoji);
        }}
        onReply={() => {
          if (!reactionPickerMessage) return;
          startReplyToMessage(reactionPickerMessage);
        }}
        onMoreOptions={
          reactionPickerMessage &&
          (getMessageActionAvailability(reactionPickerMessage, currentUserId).canEdit ||
            getMessageActionAvailability(reactionPickerMessage, currentUserId).canDelete)
            ? openMessageActionsFromPicker
            : undefined
        }
      />

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

      <ChatOptionsSheet
        visible={showChatOptions}
        onClose={() => setShowChatOptions(false)}
        title={displayName}
        subtitle="Gérer cette conversation"
        options={chatMenuOptions}
      />

      <ConversationSearchModal
        visible={showConversationSearch}
        conversationTitle={displayName}
        messages={chatMessages}
        onClose={() => setShowConversationSearch(false)}
        onSelectMessage={handleSelectSearchMessage}
      />

      <GroupCallMemberPicker
        visible={groupCallPickerOpen}
        callType={pendingGroupCallType}
        members={groupMembers}
        onClose={() => setGroupCallPickerOpen(false)}
        onConfirm={(selectedUserIds) => {
          setGroupCallPickerOpen(false);
          launchCall(pendingGroupCallType, selectedUserIds);
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
  root: { flex: 1, overflow: "hidden", backgroundColor: "transparent" },
  screenContent: {
    flex: 1,
    zIndex: 1,
  },
  messageListFullBleed: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
    zIndex: 3,
  },
  inputDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
  headerLeftCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  backPillBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginRight: 4,
  },
  backBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  headerCenterPill: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  headerStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
    textAlign: "center",
  },
  headerRightCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerAvatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  messageList: {
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
  blockedBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  blockedBannerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 18,
  },
});
