import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { GMessage, GUser } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

interface MessageBubbleProps {
  message: GMessage;
  isMe: boolean;
  showSenderName?: boolean;
  sender?: GUser;
  isLast?: boolean;
}

export function MessageBubble({ message, isMe, showSenderName, sender, isLast }: MessageBubbleProps) {
  const colors = useColors();

  const time = new Date(message.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const StatusIcon = () => {
    if (!isMe) return null;
    const color = message.status === "read" ? colors.accent : "rgba(255,255,255,0.7)";
    if (message.status === "read" || message.status === "delivered") {
      return <Ionicons name="checkmark-done" size={13} color={color} />;
    }
    return <Ionicons name="checkmark" size={13} color={color} />;
  };

  return (
    <View style={[styles.wrapper, isMe ? styles.wrapperMe : styles.wrapperOther]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isMe ? colors.chatBubbleSent : colors.chatBubbleReceived,
            borderBottomRightRadius: isMe && isLast ? 4 : 18,
            borderBottomLeftRadius: !isMe && isLast ? 4 : 18,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isMe ? 0 : 0.06,
            shadowRadius: 4,
            elevation: isMe ? 0 : 1,
          },
        ]}
      >
        {showSenderName && sender && (
          <Text style={[styles.senderName, { color: sender.color }]}>{sender.name}</Text>
        )}
        <Text style={[styles.text, { color: isMe ? colors.chatBubbleSentText : colors.chatBubbleReceivedText }]}>
          {message.content}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: isMe ? "rgba(255,255,255,0.65)" : colors.mutedForeground }]}>{time}</Text>
          <StatusIcon />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  wrapperMe: {
    alignItems: "flex-end",
  },
  wrapperOther: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 7,
    gap: 2,
  },
  senderName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  text: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
