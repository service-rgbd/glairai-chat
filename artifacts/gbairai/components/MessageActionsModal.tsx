import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { GMessage } from "@/contexts/chats-types";
import { useColors } from "@/hooks/useColors";
import { getDeleteMessageLabel } from "@/lib/message-actions";

interface MessageActionsModalProps {
  visible: boolean;
  message: GMessage | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MessageActionsModal({
  visible,
  message,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: MessageActionsModalProps) {
  const colors = useColors();

  if (!message) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { color: colors.mutedForeground }]}>Options du message</Text>

          {canEdit ? (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={onEdit}
              activeOpacity={0.82}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.text }]}>Modifier</Text>
            </TouchableOpacity>
          ) : null}

          {canDelete ? (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={onDelete}
              activeOpacity={0.82}
            >
              <Ionicons name="trash-outline" size={22} color={colors.destructive} />
              <Text style={[styles.actionText, { color: colors.destructive }]}>
                {getDeleteMessageLabel(message.type)}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.82}>
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  actionText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});
