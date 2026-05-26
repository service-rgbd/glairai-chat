import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { GStory, GUser, formatTimestamp, useChats } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

export default function StatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const { stories, users, addStoryView } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const myStories = stories.filter((s) => s.userId === "me");
  const othersStories = Object.values(users).map((u) => ({
    user: u,
    stories: stories.filter((s) => s.userId === u.id),
  })).filter((g) => g.stories.length > 0);

  const meUser: GUser = {
    id: "me",
    name: currentUser?.name ?? "Moi",
    phone: currentUser?.phone ?? "",
    avatar: currentUser?.avatar ?? null,
    bio: currentUser?.bio ?? "",
    status: "En ligne",
    lastSeen: null,
    initials: (currentUser?.name ?? "M").slice(0, 2).toUpperCase(),
    color: "#6D4AFF",
  };

  const recentUpdates = othersStories.filter((g) => g.stories.some((s) => !s.viewerIds.includes("me")));
  const viewedUpdates = othersStories.filter((g) => g.stories.every((s) => s.viewerIds.includes("me")));

  const openStory = (story: GStory) => {
    addStoryView(story.id);
    router.push(`/story/${story.id}`);
  };

  const StoryItem = ({ user, storyList }: { user: GUser; storyList: GStory[] }) => {
    const latest = storyList[storyList.length - 1];
    const allSeen = storyList.every((s) => s.viewerIds.includes("me"));
    return (
      <TouchableOpacity style={[styles.storyItem, { borderBottomColor: colors.border }]} onPress={() => openStory(latest)} activeOpacity={0.7}>
        <View style={[styles.storyRingWrap, { borderColor: allSeen ? colors.muted : colors.primary, borderWidth: 2 }]}>
          <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={50} />
        </View>
        <View style={styles.storyInfo}>
          <Text style={[styles.storyName, { color: colors.text }]}>{user.name}</Text>
          <Text style={[styles.storyTime, { color: colors.mutedForeground }]}>{formatTimestamp(latest.createdAt)}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Statuts</Text>
        <Feather name="search" size={22} color={colors.text} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 80 }}>
        <TouchableOpacity style={[styles.myStatus, { borderBottomColor: colors.border }]} activeOpacity={0.7}>
          <View style={{ position: "relative" }}>
            <Avatar uri={meUser.avatar} initials={meUser.initials} color={meUser.color} size={54} />
            <View style={[styles.addDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.addPlus}>+</Text>
            </View>
          </View>
          <View style={styles.myStatusText}>
            <Text style={[styles.myStatusName, { color: colors.text }]}>Mon statut</Text>
            <Text style={[styles.myStatusSub, { color: colors.mutedForeground }]}>
              {myStories.length > 0 ? `${myStories.length} mise${myStories.length > 1 ? "s" : ""} à jour récente${myStories.length > 1 ? "s" : ""}` : "Appuyer pour ajouter un statut"}
            </Text>
          </View>
          <Feather name="camera" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>

        {recentUpdates.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Mises à jour récentes</Text>
            {recentUpdates.map((g) => <StoryItem key={g.user.id} user={g.user} storyList={g.stories} />)}
          </>
        )}

        {viewedUpdates.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Vues</Text>
            {viewedUpdates.map((g) => <StoryItem key={g.user.id} user={g.user} storyList={g.stories} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  myStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addPlus: { color: "#fff", fontSize: 14, fontWeight: "700" },
  myStatusText: { flex: 1 },
  myStatusName: { fontSize: 15.5, fontFamily: "Inter_600SemiBold" },
  myStatusSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  storyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  storyRingWrap: {
    borderRadius: 29,
    padding: 2,
  },
  storyInfo: { flex: 1 },
  storyName: { fontSize: 15.5, fontFamily: "Inter_500Medium" },
  storyTime: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
});
