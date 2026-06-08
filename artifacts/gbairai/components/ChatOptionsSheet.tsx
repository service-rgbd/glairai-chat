import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export interface ChatOptionItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ChatOptionsSheetProps {
  visible: boolean;
  title?: string;
  options: ChatOptionItem[];
  onClose: () => void;
}

export function ChatOptionsSheet({ visible, title, options, onClose }: ChatOptionsSheetProps) {
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          {title ? (
            <Text style={[styles.title, { color: colors.mutedForeground }]}>{title}</Text>
          ) : null}
          {options.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={styles.actionRow}
              onPress={() => {
                onClose();
                option.onPress();
              }}
              activeOpacity={0.82}
            >
              <Ionicons
                name={option.icon}
                size={22}
                color={option.destructive ? colors.destructive : colors.primary}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: option.destructive ? colors.destructive : colors.text },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
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
