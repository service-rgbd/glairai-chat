import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface PasswordPromptModalProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<boolean> | boolean;
}

export function PasswordPromptModal({
  visible,
  title,
  description,
  confirmLabel = "Valider",
  onClose,
  onSubmit,
}: PasswordPromptModalProps) {
  const colors = useColors();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPassword("");
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const ok = await onSubmit(password);
      if (!ok) {
        setError("Mot de passe incorrect");
        setSubmitting(false);
        return;
      }
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Mot de passe incorrect");
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {description}
            </Text>
          ) : null}
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoFocus
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          />
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onClose} activeOpacity={0.82}>
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={() => void handleSubmit()}
              disabled={submitting || !password.trim()}
              activeOpacity={0.82}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  error: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmBtn: {
    minWidth: 96,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  confirmText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
