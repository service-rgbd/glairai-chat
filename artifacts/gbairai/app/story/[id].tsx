import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { GStory, GUser, formatTimestamp, useChats } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

const STORY_DURATION = 5000;

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { stories, users, addStoryView } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const story = stories.find((s) => s.id === id);
  const user: GUser | undefined = story ? users[story.userId] : undefined;

  const progress = useRef(new Animated.Value(0)).current;
  const [timeLeft, setTimeLeft] = useState(STORY_DURATION / 1000);

  useEffect(() => {
    if (!story) return;
    addStoryView(story.id);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) router.back();
    });
    const t = setInterval(() => setTimeLeft((c) => Math.max(0, c - 1)), 1000);
    return () => { clearInterval(t); progress.stopAnimation(); };
  }, [id]);

  if (!story || !user) {
    return (
      <View style={[styles.root, { backgroundColor: "#000", justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "#fff" }}>Statut introuvable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: story.backgroundColor || "#0F172A" }]}>
      <View style={[styles.progressBar, { top: topPad + 8, left: 12, right: 12 }]}>
        <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: "#fff",
                width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              },
            ]}
          />
        </View>
      </View>

      <View style={[styles.topBar, { paddingTop: topPad + 30 }]}>
        <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={42} />
        <View style={styles.storyMeta}>
          <Text style={styles.storyUser}>{user.name}</Text>
          <Text style={styles.storyTime}>{formatTimestamp(story.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentArea}>
        <Text style={styles.storyContent}>{story.content}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomPad + 16 }]}>
        <Text style={styles.viewCount}>
          {story.viewerIds.length} vue{story.viewerIds.length !== 1 ? "s" : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressBar: {
    position: "absolute",
    zIndex: 10,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 5,
  },
  storyMeta: { flex: 1 },
  storyUser: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  storyTime: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  contentArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  storyContent: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 38,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  footer: {
    paddingHorizontal: 20,
    alignItems: "center",
  },
  viewCount: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
