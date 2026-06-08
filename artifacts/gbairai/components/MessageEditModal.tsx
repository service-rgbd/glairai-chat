import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface MessageEditModalProps {
  visible: boolean;
  initialContent: string;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
}

export function MessageEditModal({
  visible,
  initialContent,
  isSaving = false,
  onClose,
  onSave,
}: MessageEditModalProps) {
  const colors = useColors();
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (visible) {
      setContent(initialContent);
    }
  }, [visible, initialContent]);

  const trimmed = content.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialContent.trim() && !isSaving;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={isSaving} activeOpacity={0.75}>
            <Text style={[styles.headerAction, { color: colors.mutedForeground }]}>Annuler</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Modifier le message</Text>
          <TouchableOpacity
            onPress={() => onSave(trimmed)}
            disabled={!canSave}
            activeOpacity={0.75}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.headerAction,
                  { color: canSave ? colors.primary : colors.mutedForeground },
                ]}
              >
                Enregistrer
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            maxLength={2000}
            placeholder="Votre message..."
            placeholderTextColor={colors.mutedForeground}
            editable={!isSaving}
          />
          <View style={styles.hintRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Vous pouvez modifier un message pendant 15 minutes après l&apos;envoi.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  headerAction: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    minWidth: 84,
    textAlign: "center",
  },
  body: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  input: {
    minHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    textAlignVertical: "top",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
