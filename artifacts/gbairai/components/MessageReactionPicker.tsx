import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { GMessage } from "@/contexts/chats-types";
import { useColors } from "@/hooks/useColors";
import { CHAT_QUICK_REACTIONS } from "@/lib/message-reactions";

type Props = {
  visible: boolean;
  message: GMessage | null;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onReply?: () => void;
  onMoreOptions?: () => void;
};

export function MessageReactionPicker({
  visible,
  message,
  onClose,
  onSelectEmoji,
  onReply,
  onMoreOptions,
}: Props) {
  const colors = useColors();
  if (!message) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.centerWrap} pointerEvents="box-none">
          <Pressable
            style={[styles.reactionBar, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            {CHAT_QUICK_REACTIONS.map((emoji) => {
              const active = Array.isArray(message.reactions)
                ? message.reactions.some(
                    (reaction) => reaction.emoji === emoji && reaction.reactedByMe,
                  )
                : false;
              return (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiBtn,
                    active ? { backgroundColor: `${colors.primary}22` } : null,
                  ]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectEmoji(emoji);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </Pressable>

          <View style={[styles.actionsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {onReply ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  onReply();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-undo-outline" size={18} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.text }]}>Répondre</Text>
              </TouchableOpacity>
            ) : null}
            {onMoreOptions ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  onMoreOptions();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.primary} />
                <Text style={[styles.actionText, { color: colors.text }]}>Plus</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  centerWrap: {
    alignItems: "center",
    gap: 10,
  },
  reactionBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 360,
  },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 28,
  },
  actionsRow: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
