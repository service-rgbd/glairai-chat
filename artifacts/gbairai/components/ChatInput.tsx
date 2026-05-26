import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface ChatInputProps {
  onSend: (text: string) => void;
  bottomInset?: number;
}

export function ChatInput({ onSend, bottomInset = 0 }: ChatInputProps) {
  const colors = useColors();
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed);
    setText("");
  };

  return (
    <View style={[styles.container, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: bottomInset + 8 }]}>
      <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
        <Feather name="paperclip" size={22} color={colors.mutedForeground} />
      </TouchableOpacity>
      <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
      </View>
      {text.trim().length > 0 ? (
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={handleSend} activeOpacity={0.85}>
          <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} activeOpacity={0.85}>
          <Feather name="mic" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  iconBtn: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    minHeight: 42,
    maxHeight: 120,
    justifyContent: "center",
  },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
});
