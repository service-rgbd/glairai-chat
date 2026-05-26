import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ChatItem } from "@/components/ChatItem";
import { SearchBar } from "@/components/SearchBar";
import { StoryRing } from "@/components/StoryRing";
import { useAuth } from "@/contexts/AuthContext";
import { GUser, useChats } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

export default function ChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const { chats, messages, users, stories, getOtherUser } = useChats();
  const [search, setSearch] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

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

  const myStories = stories.filter((s) => s.userId === "me");

  const storyUsers = Object.values(users).filter((u) =>
    stories.some((s) => s.userId === u.id),
  );

  const sortedChats = [...chats].sort((a, b) => {
    const la = messages[a.id]?.slice(-1)[0]?.timestamp ?? "";
    const lb = messages[b.id]?.slice(-1)[0]?.timestamp ?? "";
    return lb.localeCompare(la);
  });

  const filtered = search
    ? sortedChats.filter((c) => {
        const other = getOtherUser(c);
        const name = c.type === "group" ? c.name : other?.name ?? "";
        return name?.toLowerCase().includes(search.toLowerCase());
      })
    : sortedChats;

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Gbairai
          {totalUnread > 0 && (
            <Text style={{ color: colors.primary }}> {totalUnread}</Text>
          )}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Feather name="more-vertical" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        scrollEnabled={!!filtered.length}
        contentContainerStyle={{ paddingBottom: bottomPad + 80, flexGrow: 1 }}
        ListHeaderComponent={
          <>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Rechercher..." />

            {!search && (
              <View style={styles.storiesSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.storiesScroll}
                >
                  <StoryRing
                    user={meUser}
                    stories={myStories}
                    isMe
                    onPress={() => {}}
                  />
                  {storyUsers.map((u) => (
                    <StoryRing
                      key={u.id}
                      user={u}
                      stories={stories.filter((s) => s.userId === u.id)}
                      onPress={() => {
                        const first = stories.find((s) => s.userId === u.id);
                        if (first) router.push(`/story/${first.id}`);
                      }}
                    />
                  ))}
                </ScrollView>
                <View style={[styles.storiesDivider, { backgroundColor: colors.border }]} />
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          const other = getOtherUser(item);
          const lastMsg = messages[item.id]?.slice(-1)[0];
          return (
            <ChatItem
              chat={item}
              otherUser={other}
              lastMessage={lastMsg}
              currentUserId="me"
              onPress={() => router.push(`/chat/${item.id}`)}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune discussion</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {search ? "Aucun résultat trouvé" : "Commencez une nouvelle conversation"}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad + 80 }]}
        activeOpacity={0.85}
      >
        <Ionicons name="create-outline" size={26} color="#fff" />
      </TouchableOpacity>
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
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  headerActions: { flexDirection: "row", gap: 4 },
  headerBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  storiesSection: { marginTop: 4 },
  storiesScroll: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  storiesDivider: { height: StyleSheet.hairlineWidth },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6D4AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
