import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { GStory, GUser } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

import { Avatar } from "./Avatar";

interface StoryRingProps {
  user: GUser;
  stories: GStory[];
  isMe?: boolean;
  onPress: () => void;
  size?: number;
}

export function StoryRing({ user, stories, isMe = false, onPress, size = 62 }: StoryRingProps) {
  const colors = useColors();
  const hasUnseen = stories.some((s) => !s.viewerIds.includes("me"));
  const hasStory = stories.length > 0;
  const ringSize = size + 6;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      {isMe ? (
        <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.border, borderWidth: 1.5 }]}>
          <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={size} />
          <View style={[styles.addBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.addIcon}>+</Text>
          </View>
        </View>
      ) : hasStory ? (
        <LinearGradient
          colors={hasUnseen ? ["#6D4AFF", "#00D4A4"] : [colors.muted, colors.muted]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, padding: 2.5 }]}
        >
          <View style={[styles.innerRing, { borderRadius: (ringSize - 5) / 2, backgroundColor: colors.background }]}>
            <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={size} />
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.border, borderWidth: 1.5 }]}>
          <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={size} />
        </View>
      )}
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {isMe ? "Mon statut" : user.name.split(" ")[0]}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: 76,
    gap: 6,
  },
  ring: {
    justifyContent: "center",
    alignItems: "center",
  },
  innerRing: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  addIcon: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  name: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    width: 70,
  },
});
