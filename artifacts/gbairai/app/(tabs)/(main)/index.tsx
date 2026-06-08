import { Feather, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ChatItem } from "@/components/ChatItem";
import { SearchBar } from "@/components/SearchBar";
import { StoryRing } from "@/components/StoryRing";
import { useAuth } from "@/contexts/AuthContext";
import type { GUser, ComposeContactOption } from "@/contexts/chats-types";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { openUserStories } from "@/lib/story-playback";

export default function ChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const {
    chats,
    messages,
    users,
    stories,
    getOtherUser,
    startConversationWithUser,
    startConversationWithUsers,
    composeContactsSnapshot,
    getComposeContacts,
    isLoadingChats,
    typingByConversation,
  } = useChats();
  const [search, setSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSearch, setComposerSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [composerContacts, setComposerContacts] = useState<ComposeContactOption[]>([]);
  const [composerLoading, setComposerLoading] = useState(false);
  const { focusSearch } = useLocalSearchParams<{ focusSearch?: string }>();
  const shouldFocusSearch = focusSearch === "1";

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const currentUserId = currentUser?.id ?? "me";

  const meUser: GUser = {
    id: currentUserId,
    name: currentUser?.name ?? "Moi",
    phone: currentUser?.phone ?? "",
    avatar: currentUser?.avatar ?? null,
    bio: currentUser?.bio ?? "",
    status: "En ligne",
    lastSeen: null,
    initials: (currentUser?.name ?? "M").slice(0, 2).toUpperCase(),
    color: "#6D4AFF",
  };

  const myStories = stories.filter((s) => s.userId === currentUserId);

  const storyUsers = Object.values(users).filter((u) =>
    stories.some((s) => s.userId === u.id),
  );

  const sortedChats = [...chats].sort((a, b) => {
    const la = messages[a.id]?.slice(-1)[0]?.timestamp ?? a.lastMessage?.timestamp ?? "";
    const lb = messages[b.id]?.slice(-1)[0]?.timestamp ?? b.lastMessage?.timestamp ?? "";
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

  useEffect(() => {
    if (!composerOpen) {
      setComposerContacts(composeContactsSnapshot);
      setComposerSearch("");
      setSelectedUserIds([]);
      setGroupTitle("");
      return;
    }

    let cancelled = false;

    const loadComposeContacts = async () => {
      setComposerLoading(true);
      try {
        if (composeContactsSnapshot.length > 0) {
          setComposerContacts(composeContactsSnapshot);
        }
        const contacts = await getComposeContacts();
        if (!cancelled) {
          setComposerContacts(contacts);
        }
      } finally {
        if (!cancelled) {
          setComposerLoading(false);
        }
      }
    };

    void loadComposeContacts();
    return () => {
      cancelled = true;
    };
  }, [composerOpen, getComposeContacts]);

  const selectableUsers = useMemo(
    () =>
      composerContacts.filter((user) =>
        `${user.name} ${user.phone}`.toLowerCase().includes(composerSearch.toLowerCase()),
      ),
    [composerContacts, composerSearch],
  );

  const toggleSelectedUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((value) => value !== userId)
        : [...prev, userId],
    );
  };

  const handleCreateConversation = async () => {
    if (selectedUserIds.length === 0) return;
    const conversationId =
      selectedUserIds.length === 1
        ? await startConversationWithUser(selectedUserIds[0]!)
        : await startConversationWithUsers(
            selectedUserIds,
            groupTitle.trim() || "Nouveau groupe",
          );

    setComposerOpen(false);
    setComposerSearch("");
    setSelectedUserIds([]);
    setGroupTitle("");
    router.push(`/chat/${conversationId}`);
  };

  const handleInviteContact = async (item: ComposeContactOption) => {
    await Share.share({
      message: `Rejoins-moi sur Gbairai: https://gbairai.app/download`,
    });
  };

  const handleOpenStatusComposer = () => {
    router.push({ pathname: "/(tabs)/(main)/status", params: { compose: "1" } });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.headerLogo}
            contentFit="cover"
          />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Gbairai
            {totalUnread > 0 && (
              <Text style={{ color: colors.primary }}> {totalUnread}</Text>
            )}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={handleOpenStatusComposer}
            accessibilityLabel="Créer un statut"
          >
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
        scrollEnabled={!!filtered.length || isLoadingChats}
        contentContainerStyle={{ paddingBottom: bottomPad + 96, flexGrow: 1 }}
        ListHeaderComponent={
          <>
            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher..."
              autoFocus={shouldFocusSearch}
            />

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
                    currentUserId={currentUserId}
                    isMe
                    onPress={() => {
                      if (myStories.length > 0) {
                        openUserStories({
                          stories,
                          users,
                          targetUserId: currentUserId,
                          currentUserId,
                          includeQueue: false,
                        });
                        return;
                      }
                      handleOpenStatusComposer();
                    }}
                  />
                  {storyUsers.map((u) => (
                    <StoryRing
                      key={u.id}
                      user={u}
                      stories={stories.filter((s) => s.userId === u.id)}
                      currentUserId={currentUserId}
                      onPress={() => {
                        openUserStories({
                          stories,
                          users,
                          targetUserId: u.id,
                          currentUserId,
                        });
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
          const lastMsg = messages[item.id]?.slice(-1)[0] ?? item.lastMessage;
          const typingUserIds = (typingByConversation[item.id] ?? []).filter(
            (userId) => userId !== currentUserId,
          );
          const typingLabel = typingUserIds.length
            ? item.type === "group"
              ? `${users[typingUserIds[0]!]?.name?.split(" ")[0] ?? "Quelqu'un"} écrit...`
              : "en train d'écrire..."
            : null;
          const contactStories =
            item.type === "group" || !other
              ? []
              : stories.filter((story) => story.userId === other.id);
          return (
            <ChatItem
              chat={item}
              otherUser={other}
              lastMessage={lastMsg}
              currentUserId={currentUserId}
              users={users}
              typingLabel={typingLabel}
              userStories={contactStories}
              onStoryPress={
                contactStories.length > 0 && other
                  ? () => {
                      openUserStories({
                        stories,
                        users,
                        targetUserId: other.id,
                        currentUserId,
                      });
                    }
                  : undefined
              }
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
        style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad + 78 }]}
        activeOpacity={0.85}
        onPress={() => setComposerOpen(true)}
      >
        <Ionicons name="create-outline" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={composerOpen} animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background, paddingTop: topPad + 12 }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBlock}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nouvelle discussion</Text>
              <Text style={[styles.modalHint, { color: colors.mutedForeground }]}>
                1 contact = discussion · 2+ contacts = groupe
              </Text>
            </View>
            <View style={styles.modalHeaderActions}>
              <TouchableOpacity
                onPress={() => {
                  setComposerOpen(false);
                  router.push("/group/join");
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalSecondaryAction, { color: colors.primary }]}>
                  Rejoindre
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setComposerOpen(false)} activeOpacity={0.7}>
                <Text style={[styles.modalAction, { color: colors.primary }]}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>

          <SearchBar value={composerSearch} onChangeText={setComposerSearch} placeholder="Rechercher un contact..." />

          {selectedUserIds.length > 1 ? (
            <TextInput
              style={[styles.groupInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder="Nom du groupe ou canal"
              placeholderTextColor={colors.mutedForeground}
              value={groupTitle}
              onChangeText={setGroupTitle}
            />
          ) : null}

          <FlatList
            data={selectableUsers}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              composerLoading ? (
                <View style={styles.composerState}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={[styles.composerStateText, { color: colors.mutedForeground }]}>
                    Chargement des contacts du téléphone...
                  </Text>
                </View>
              ) : (
                <View style={styles.composerState}>
                  <Ionicons name="people-outline" size={30} color={colors.mutedForeground} />
                  <Text style={[styles.composerStateText, { color: colors.mutedForeground }]}>
                    Aucun contact du téléphone disponible pour le moment.
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const selected = item.userId ? selectedUserIds.includes(item.userId) : false;
              return (
                <TouchableOpacity
                  style={[styles.contactRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (!item.userId) return;
                    toggleSelectedUser(item.userId);
                  }}
                  activeOpacity={0.7}
                  disabled={!item.userId}
                >
                  <Avatar uri={item.avatar} initials={item.initials} color={item.color} size={46} />
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.contactSub, { color: colors.mutedForeground }]}>
                      {item.phone}
                    </Text>
                    <View style={styles.contactMetaRow}>
                      {item.isRegistered ? (
                        <>
                          <View style={[styles.greenIndicator, { backgroundColor: "#16A34A" }]} />
                          <Text style={[styles.contactStatusRegistered, { color: colors.primary }]}>
                            Inscrit sur Gbairai
                          </Text>
                        </>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            void handleInviteContact(item);
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.contactStatusInvite, { color: colors.primary }]}>
                            Inviter à télécharger Gbairai
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {item.userId ? (
                    <View
                      style={[
                        styles.checkBadge,
                        {
                          backgroundColor: selected ? colors.primary : "transparent",
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {selected ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: selectedUserIds.length ? colors.primary : colors.muted }]}
            onPress={handleCreateConversation}
            disabled={!selectedUserIds.length}
            activeOpacity={0.85}
          >
            <Text style={[styles.createBtnText, { color: selectedUserIds.length ? "#fff" : colors.mutedForeground }]}>
              {selectedUserIds.length > 1 ? "Créer le groupe" : "Démarrer la discussion"}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerTitle: {
    fontSize: 26,
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
  modalRoot: { flex: 1, gap: 14 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  modalTitleBlock: { flex: 1, gap: 4, paddingRight: 12 },
  modalHint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modalHeaderActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  modalSecondaryAction: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalAction: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  inlineAddRow: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupInput: {
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  composerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 10,
  },
  composerStateText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15.5, fontFamily: "Inter_500Medium" },
  contactSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  contactMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  greenIndicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  contactStatusRegistered: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  contactStatusUnregistered: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
  },
  contactStatusInvite: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  createBtn: {
    margin: 16,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
