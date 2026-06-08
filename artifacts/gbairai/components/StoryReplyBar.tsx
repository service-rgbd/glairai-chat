import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { fluentEmoji3dUrl, STORY_QUICK_REACTIONS } from "@/lib/story-reactions";

interface StoryReplyBarProps {
  ownerName: string;
  bottomInset?: number;
  disabled?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onSendText: (text: string) => Promise<void>;
  onSendReaction: (emoji: string) => Promise<void>;
}

export function StoryReplyBar({
  ownerName,
  bottomInset = 0,
  disabled = false,
  onFocusChange,
  onSendText,
  onSendReaction,
}: StoryReplyBarProps) {
  const colors = useColors();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);

  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || disabled) return;
    setIsSending(true);
    try {
      await onSendText(trimmed);
      setText("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setIsSending(false);
    }
  };

  const handleReaction = async (reactionId: string, emoji: string) => {
    if (isSending || disabled || reactingId) return;
    setReactingId(reactionId);
    try {
      await onSendReaction(emoji);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } finally {
      setReactingId(null);
    }
  };

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 10 }]}>
      <View style={styles.reactionsRow}>
        {STORY_QUICK_REACTIONS.map((reaction) => (
          <TouchableOpacity
            key={reaction.id}
            style={styles.reactionBtn}
            onPress={() => {
              void handleReaction(reaction.id, reaction.emoji);
            }}
            disabled={disabled || isSending || Boolean(reactingId)}
            activeOpacity={0.82}
          >
            {reactingId === reaction.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Image
                source={{ uri: fluentEmoji3dUrl(reaction.fluentName) }}
                style={styles.reactionImage}
                contentFit="contain"
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.inputRow, { backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.18)" }]}>
        <TextInput
          style={[styles.input, { color: "#fff" }]}
          placeholder={`Répondre à ${ownerName}...`}
          placeholderTextColor="rgba(255,255,255,0.62)"
          value={text}
          onChangeText={setText}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          editable={!disabled && !isSending}
          returnKeyType="send"
          onSubmitEditing={() => {
            void handleSendText();
          }}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: text.trim() && !isSending ? 1 : 0.45 }]}
          onPress={() => {
            void handleSendText();
          }}
          disabled={!text.trim() || isSending || disabled}
          activeOpacity={0.85}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Votre réponse sera envoyée en message privé à {ownerName}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingHorizontal: 14,
  },
  reactionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  reactionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  reactionImage: {
    width: 34,
    height: 34,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 52,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingVertical: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
