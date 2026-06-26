import { Feather, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { ChatOptionsSheet } from "@/components/ChatOptionsSheet";
import { ConversationFilterChips } from "@/components/ConversationFilterChips";
import { GroupInviteBanner } from "@/components/GroupInviteBanner";
import { NetworkStatusChip } from "@/components/NetworkStatusChip";
import { PasswordPromptModal } from "@/components/PasswordPromptModal";
import { SearchBar } from "@/components/SearchBar";
import { StoryRing } from "@/components/StoryRing";
import { useAuth } from "@/contexts/AuthContext";
import type { GChat, GUser, ComposeContactOption } from "@/contexts/chats-types";
import { useChats } from "@/contexts/chats-context-ref";
import {
  DEFAULT_GROUP_SETTINGS,
  groupAccessModeLabel,
  type GroupAccessMode,
  type GroupSettings,
} from "@/lib/group-settings";
import { useColors } from "@/hooks/useColors";
import {
  isArchivedAccessEnabled,
  isArchivedStripPinned,
  setArchivedStripPinned,
  verifyArchivedAccessPassword,
} from "@/lib/archived-access";
import { openGlobalSearch } from "@/lib/navigation";
import {
  buildFilteredConversationList,
  getConversationFilterCounts,
  type ConversationListFilter,
} from "@/lib/conversation-list-sections";
import { openUserStories, groupStoriesByUser } from "@/lib/story-playback";
import { ChannelListItem } from "@/modules/channels/components/ChannelListItem";
import { useChannels } from "@/modules/channels/context/ChannelsContext";
import type { Channel } from "@/modules/channels/types";

const ARCHIVED_PULL_REVEAL_OFFSET = 36;
const ARCHIVED_SCROLL_HIDE_OFFSET = 10;

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
    isUserBlocked,
    archiveConversation,
    muteConversation,
    deleteConversation,
    isGroupAdmin,
    pendingGroupInvites,
    acceptGroupMemberInvite,
    declineGroupMemberInvite,
    groupInviteActionId,
  } = useChats();
  const { discoverySections } = useChannels();
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<ConversationListFilter>("all");
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [selectedChatForActions, setSelectedChatForActions] = useState<GChat | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showArchivedPassword, setShowArchivedPassword] = useState(false);
  const [archivedAccessEnabled, setArchivedAccessEnabled] = useState(false);
  const [archivedStripPinned, setArchivedStripPinnedState] = useState(false);
  const [archivedStripVisible, setArchivedStripVisible] = useState(false);
  const [archivedContentUnlocked, setArchivedContentUnlocked] = useState(false);
  const archivedStripPinnedRef = useRef(false);
  const pendingPinOnOpenRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSearch, setComposerSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [newGroupSettings, setNewGroupSettings] = useState<GroupSettings>(DEFAULT_GROUP_SETTINGS);
  const [composerContacts, setComposerContacts] = useState<ComposeContactOption[]>([]);
  const [composerLoading, setComposerLoading] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const lastGroupCreateAtRef = useRef(0);
  const getComposeContactsRef = useRef(getComposeContacts);
  getComposeContactsRef.current = getComposeContacts;
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

  const sortedChats = [...chats].sort((a, b) => {
    const la = messages[a.id]?.slice(-1)[0]?.timestamp ?? a.lastMessage?.timestamp ?? "";
    const lb = messages[b.id]?.slice(-1)[0]?.timestamp ?? b.lastMessage?.timestamp ?? "";
    return lb.localeCompare(la);
  });

  const storyUsers = useMemo(
    () =>
      groupStoriesByUser({
        stories,
        users,
        currentUserId,
        isUserBlocked,
      }).map((group) => group.user),
    [stories, users, currentUserId, isUserBlocked],
  );

  const isBlockedDirectChat = (chat: GChat) => {
    if (chat.type !== "direct") return false;
    const other = getOtherUser(chat);
    return other ? isUserBlocked(other.id) : false;
  };

  const activeChats = sortedChats.filter((chat) => !chat.isArchived && !isBlockedDirectChat(chat));
  const archivedChats = sortedChats.filter((chat) => chat.isArchived);

  const filtered = search
    ? activeChats.filter((c) => {
        const other = getOtherUser(c);
        const name = c.type === "group" ? c.name : other?.name ?? "";
        return name?.toLowerCase().includes(search.toLowerCase());
      })
    : activeChats;

  const followedChannels = useMemo(() => {
    const byId = new Map<string, Channel>();
    for (const section of discoverySections) {
      for (const channel of section.channels) {
        if (channel.isFollowing) {
          byId.set(channel.id, channel);
        }
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [discoverySections]);

  const getChatSortAt = useCallback(
    (chat: GChat) =>
      messages[chat.id]?.slice(-1)[0]?.timestamp ?? chat.lastMessage?.timestamp ?? "",
    [messages],
  );

  const getDirectChatName = useCallback(
    (chat: GChat) => getOtherUser(chat)?.name ?? "",
    [getOtherUser],
  );

  const filterCounts = useMemo(
    () =>
      getConversationFilterCounts({
        chats: filtered,
        channels: followedChannels,
        search,
        getDirectChatName,
      }),
    [filtered, followedChannels, search, getDirectChatName],
  );

  const conversationListItems = useMemo(
    () =>
      buildFilteredConversationList({
        chats: filtered,
        channels: followedChannels,
        filter: listFilter,
        search,
        getDirectChatName,
        getChatSortAt,
      }),
    [filtered, followedChannels, listFilter, search, getDirectChatName, getChatSortAt],
  );

  useEffect(() => {
    if (!currentUserId) return;
    void isArchivedAccessEnabled(currentUserId).then(setArchivedAccessEnabled);
    void isArchivedStripPinned(currentUserId).then((pinned) => {
      archivedStripPinnedRef.current = pinned;
      setArchivedStripPinnedState(pinned);
      if (pinned) {
        setArchivedStripVisible(true);
      }
    });
  }, [currentUserId]);

  useEffect(() => {
    if (archivedChats.length > 0) return;
    archivedStripPinnedRef.current = false;
    setArchivedStripPinnedState(false);
    setArchivedStripVisible(false);
    setShowArchived(false);
    if (currentUserId) {
      void setArchivedStripPinned(currentUserId, false);
    }
  }, [archivedChats.length, currentUserId]);

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId) return;
      void isArchivedAccessEnabled(currentUserId).then(setArchivedAccessEnabled);
      void isArchivedStripPinned(currentUserId).then((pinned) => {
        archivedStripPinnedRef.current = pinned;
        setArchivedStripPinnedState(pinned);
        if (pinned) {
          setArchivedStripVisible(true);
        }
      });
    }, [currentUserId]),
  );

  const pinArchivedStrip = useCallback(() => {
    archivedStripPinnedRef.current = true;
    setArchivedStripPinnedState(true);
    setArchivedStripVisible(true);
    if (currentUserId) {
      void setArchivedStripPinned(currentUserId, true);
    }
  }, [currentUserId]);

  const hideTransientArchivedStrip = useCallback(() => {
    setArchivedStripVisible(false);
    setShowArchived(false);
    setArchivedContentUnlocked(false);
    pendingPinOnOpenRef.current = false;
  }, []);

  const revealArchivedStrip = useCallback(
    (expandContent: boolean) => {
      setArchivedStripVisible(true);
      if (!expandContent) return;
      if (archivedAccessEnabled && !archivedContentUnlocked) return;
      setShowArchived(true);
    },
    [archivedAccessEnabled, archivedContentUnlocked],
  );

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (search || archivedChats.length === 0) return;

      const y = event.nativeEvent.contentOffset.y;
      const delta = y - lastScrollYRef.current;
      lastScrollYRef.current = y;

      if (archivedStripPinnedRef.current) {
        return;
      }

      // Tirer vers le bas (overscroll) : afficher la bande archivées.
      if (y <= -ARCHIVED_PULL_REVEAL_OFFSET) {
        revealArchivedStrip(!archivedAccessEnabled);
        return;
      }

      // Android : pas d'overscroll négatif — détecter le geste vers le bas en haut de liste.
      if (Platform.OS === "android" && y <= 0 && delta < -2) {
        revealArchivedStrip(!archivedAccessEnabled);
        return;
      }

      // Remonter la liste : refermer tant que la persistance forte n'est pas active.
      if (archivedStripVisible && y >= ARCHIVED_SCROLL_HIDE_OFFSET && delta > 0) {
        hideTransientArchivedStrip();
      }
    },
    [archivedChats.length, archivedStripVisible, archivedAccessEnabled, hideTransientArchivedStrip, revealArchivedStrip, search],
  );

  const openArchivedAccess = useCallback(() => {
    if (archivedChats.length === 0) return;
    if (archivedAccessEnabled && !archivedContentUnlocked) {
      setShowArchivedPassword(true);
      return;
    }
    setShowArchived(true);
    if (pendingPinOnOpenRef.current) {
      pinArchivedStrip();
      pendingPinOnOpenRef.current = false;
    }
  }, [archivedAccessEnabled, archivedChats.length, archivedContentUnlocked, pinArchivedStrip]);

  const toggleArchivedAccess = () => {
    if (showArchived) {
      setShowArchived(false);
      setArchivedContentUnlocked(false);
      pendingPinOnOpenRef.current = false;
      if (!archivedStripPinnedRef.current) {
        hideTransientArchivedStrip();
      }
      return;
    }
    pendingPinOnOpenRef.current = true;
    openArchivedAccess();
  };

  const getChatActionLabel = (chat: GChat | null) => {
    if (!chat) return "Conversation";
    if (chat.type === "group") return chat.name ?? "Groupe";
    return getOtherUser(chat)?.name ?? "Conversation";
  };

  const handleArchiveChat = (chat: GChat) => {
    void archiveConversation(chat.id, !chat.isArchived).catch((error) => {
      Alert.alert(
        "Action impossible",
        error instanceof Error ? error.message : "Impossible de mettre à jour l'archivage.",
      );
    });
  };

  const handleMuteChat = (chat: GChat) => {
    void muteConversation(chat.id, !chat.isMuted).catch((error) => {
      Alert.alert(
        "Action impossible",
        error instanceof Error ? error.message : "Impossible de mettre à jour le mode silencieux.",
      );
    });
  };

  const handleDeleteChat = (chat: GChat) => {
    const label = getChatActionLabel(chat);
    const isOwnerDeletingGroup =
      chat.type === "group" && isGroupAdmin(chat, currentUser?.id ?? "");
    Alert.alert(
      isOwnerDeletingGroup ? "Supprimer le groupe ?" : "Supprimer la conversation ?",
      isOwnerDeletingGroup
        ? `Le groupe « ${label} » sera supprimé pour tous les membres. Cette action est irréversible.`
        : `La conversation avec ${label} sera retirée de votre liste. Elle pourra réapparaître si un nouveau message arrive.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void deleteConversation(chat.id).catch((error) => {
              Alert.alert(
                "Suppression impossible",
                error instanceof Error ? error.message : "Impossible de supprimer cette conversation.",
              );
            });
          },
        },
      ],
    );
  };

  const renderArchivedChatItem = (item: GChat) => {
    const other = getOtherUser(item);
    const lastMsg = messages[item.id]?.slice(-1)[0] ?? item.lastMessage;
    return (
      <ChatItem
        key={item.id}
        chat={item}
        otherUser={other}
        lastMessage={lastMsg}
        currentUserId={currentUserId}
        users={users}
        onPress={() => router.push(`/chat/${item.id}`)}
        onLongPress={() => setSelectedChatForActions(item)}
      />
    );
  };

  const renderStoriesSection = () => {
    if (search || showArchived) return null;

    return (
      <View style={styles.storiesSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScroll}
          nestedScrollEnabled
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
    );
  };

  const renderArchivedSection = () => {
    const stripVisible = archivedStripPinned || archivedStripVisible;
    const canShowArchivedContent =
      showArchived && (!archivedAccessEnabled || archivedContentUnlocked);

    if (archivedChats.length === 0 || search || !stripVisible) {
      return null;
    }

    return (
      <View style={[styles.archivedSection, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.archivedEntry, { borderBottomColor: colors.border }]}
          onPress={toggleArchivedAccess}
          activeOpacity={0.82}
        >
          <View style={[styles.archivedEntryIcon, { backgroundColor: colors.muted }]}>
            <Ionicons
              name={archivedAccessEnabled && !archivedContentUnlocked ? "lock-closed-outline" : "archive-outline"}
              size={18}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.archivedEntryLabel, { color: colors.text }]}>
            Conversations archivées
          </Text>
          <Text style={[styles.archivedEntryCount, { color: colors.mutedForeground }]}>
            {archivedChats.length}
          </Text>
          <Ionicons
            name={showArchived ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.mutedForeground}
          />
        </TouchableOpacity>
        {archivedAccessEnabled && stripVisible && !archivedContentUnlocked ? (
          <View style={styles.archivedLockedHint}>
            <Text style={[styles.archivedLockedText, { color: colors.mutedForeground }]}>
              Touchez pour saisir le mot de passe et afficher le contenu.
            </Text>
          </View>
        ) : null}
        {canShowArchivedContent ? archivedChats.map(renderArchivedChatItem) : null}
      </View>
    );
  };

  const renderChatRow = (item: GChat) => {
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
      item.type === "group" || !other ? [] : stories.filter((story) => story.userId === other.id);

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
        onLongPress={() => setSelectedChatForActions(item)}
      />
    );
  };

  const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);

  useEffect(() => {
    if (!composerOpen) {
      setComposerContacts(composeContactsSnapshot);
      setComposerSearch("");
      setSelectedUserIds([]);
      setGroupTitle("");
      setNewGroupSettings(DEFAULT_GROUP_SETTINGS);
      return;
    }

    let cancelled = false;

    const loadComposeContacts = async () => {
      setComposerLoading(true);
      try {
        if (composeContactsSnapshot.length > 0) {
          setComposerContacts(composeContactsSnapshot);
        }
        const contacts = await getComposeContactsRef.current();
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
  }, [composerOpen, composeContactsSnapshot]);

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
    if (selectedUserIds.length === 0 || isCreatingConversation) return;

    const isGroup = selectedUserIds.length > 1;
    if (isGroup) {
      const elapsed = Date.now() - lastGroupCreateAtRef.current;
      if (elapsed < 60_000) {
        Alert.alert(
          "Patientez",
          "Vous pouvez créer un nouveau groupe dans une minute pour éviter les doublons.",
        );
        return;
      }
    }

    setIsCreatingConversation(true);
    try {
      const conversationId = isGroup
        ? await startConversationWithUsers(
            selectedUserIds,
            groupTitle.trim() || "Nouveau groupe",
            newGroupSettings,
          )
        : await startConversationWithUser(selectedUserIds[0]!);

      if (isGroup) {
        lastGroupCreateAtRef.current = Date.now();
      }

      setComposerOpen(false);
      setComposerSearch("");
      setSelectedUserIds([]);
      setGroupTitle("");
      setNewGroupSettings(DEFAULT_GROUP_SETTINGS);

      if (isGroup) {
        Alert.alert(
          "Groupe créé",
          "Les invitations ont été envoyées. Les membres doivent accepter pour rejoindre.",
        );
      }

      router.push(`/chat/${conversationId}`);
    } catch (error) {
      Alert.alert(
        isGroup ? "Création impossible" : "Discussion impossible",
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    } finally {
      setIsCreatingConversation(false);
    }
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
          <NetworkStatusChip />
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
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.7}
            onPress={() => setShowHeaderMenu(true)}
          >
            <Feather name="more-vertical" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher..."
        autoFocus={shouldFocusSearch}
      />

      {!search && !showArchived ? (
        <ConversationFilterChips
          activeFilter={listFilter}
          counts={filterCounts}
          onChange={setListFilter}
        />
      ) : null}

      {renderArchivedSection()}

      <GroupInviteBanner
        invites={pendingGroupInvites}
        busyInviteId={groupInviteActionId}
        onAccept={(invite) => {
          void acceptGroupMemberInvite(invite.id)
            .then((conversationId) => {
              router.push(`/chat/${conversationId}`);
            })
            .catch((error) => {
              Alert.alert(
                "Invitation impossible",
                error instanceof Error ? error.message : "Impossible d'accepter cette invitation.",
              );
            });
        }}
        onDecline={(invite) => {
          void declineGroupMemberInvite(invite.id).catch((error) => {
            Alert.alert(
              "Action impossible",
              error instanceof Error ? error.message : "Impossible de refuser cette invitation.",
            );
          });
        }}
      />

      <FlatList
        data={conversationListItems}
        keyExtractor={(row) => `${row.kind}-${row.id}`}
        scrollEnabled
        bounces
        overScrollMode="always"
        onScroll={handleListScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottomPad + 96, flexGrow: 1 }}
        ListHeaderComponent={renderStoriesSection()}
        renderItem={({ item: row }) => {
          if (row.kind === "channel") {
            return (
              <ChannelListItem
                channel={row.channel}
                onPress={() => router.push(`/channel/${row.channel.id}`)}
              />
            );
          }
          return renderChatRow(row.chat);
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

      <ChatOptionsSheet
        visible={showHeaderMenu}
        onClose={() => setShowHeaderMenu(false)}
        title="Options"
        subtitle="Actions sur vos discussions"
        options={[
          {
            key: "search",
            label: "Rechercher",
            icon: "search-outline",
            onPress: () => openGlobalSearch(),
          },
        ]}
      />

      <ChatOptionsSheet
        visible={Boolean(selectedChatForActions)}
        onClose={() => setSelectedChatForActions(null)}
        title={getChatActionLabel(selectedChatForActions)}
        subtitle="Actions sur cette conversation"
        options={
          selectedChatForActions
            ? [
                {
                  key: "archive",
                  label: selectedChatForActions.isArchived ? "Désarchiver" : "Archiver",
                  icon: selectedChatForActions.isArchived ? "archive" : "archive-outline",
                  onPress: () => handleArchiveChat(selectedChatForActions),
                },
                {
                  key: "mute",
                  label: selectedChatForActions.isMuted ? "Réactiver le son" : "Mode silencieux",
                  icon: selectedChatForActions.isMuted
                    ? "notifications-outline"
                    : "notifications-off-outline",
                  onPress: () => handleMuteChat(selectedChatForActions),
                },
                {
                  key: "delete",
                  label: "Supprimer la conversation",
                  icon: "trash-outline",
                  destructive: true,
                  onPress: () => handleDeleteChat(selectedChatForActions),
                },
              ]
            : []
        }
      />

      <PasswordPromptModal
        visible={showArchivedPassword}
        title="Accès aux archivées"
        description="Entrez votre mot de passe pour afficher les conversations archivées."
        icon={require("@/assets/images/archived-password.png")}
        onClose={() => setShowArchivedPassword(false)}
        onSubmit={async (password) => {
          const ok = await verifyArchivedAccessPassword(currentUserId, password);
          if (ok) {
            setArchivedContentUnlocked(true);
            setShowArchived(true);
            if (pendingPinOnOpenRef.current) {
              pinArchivedStrip();
              pendingPinOnOpenRef.current = false;
            }
          }
          return ok;
        }}
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
            <>
              <TextInput
                style={[styles.groupInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder="Nom du groupe"
                placeholderTextColor={colors.mutedForeground}
                value={groupTitle}
                onChangeText={setGroupTitle}
              />
              <View style={[styles.groupSettingsBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.groupSettingsTitle, { color: colors.text }]}>Paramètres du groupe</Text>
                {(["closed", "invite", "open"] as GroupAccessMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={styles.groupSettingsRow}
                    onPress={() => setNewGroupSettings((prev) => ({ ...prev, accessMode: mode }))}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={newGroupSettings.accessMode === mode ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={newGroupSettings.accessMode === mode ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.groupSettingsText, { color: colors.text }]}>
                      {groupAccessModeLabel(mode)}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.groupSettingsRow, styles.groupSettingsToggle]}
                  onPress={() =>
                    setNewGroupSettings((prev) => ({
                      ...prev,
                      membersCanSendMedia: !prev.membersCanSendMedia,
                    }))
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.groupSettingsText, { color: colors.text }]}>
                    Médias autorisés pour les membres
                  </Text>
                  <Ionicons
                    name={newGroupSettings.membersCanSendMedia ? "toggle" : "toggle-outline"}
                    size={24}
                    color={newGroupSettings.membersCanSendMedia ? colors.primary : colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </>
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
            style={[
              styles.createBtn,
              {
                backgroundColor:
                  selectedUserIds.length && !isCreatingConversation ? colors.primary : colors.muted,
              },
            ]}
            onPress={() => {
              void handleCreateConversation();
            }}
            disabled={!selectedUserIds.length || isCreatingConversation}
            activeOpacity={0.85}
          >
            {isCreatingConversation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={[
                  styles.createBtnText,
                  { color: selectedUserIds.length ? "#fff" : colors.mutedForeground },
                ]}
              >
                {selectedUserIds.length > 1 ? "Créer le groupe" : "Démarrer la discussion"}
              </Text>
            )}
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
    paddingVertical: 10,
    gap: 12,
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
  groupSettingsBox: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  groupSettingsTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  groupSettingsRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  groupSettingsToggle: { justifyContent: "space-between" },
  groupSettingsText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
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
  archivedEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  archivedSection: {
    backgroundColor: "transparent",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  archivedEntryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  archivedEntryLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  archivedEntryCount: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginRight: 2,
  },
  archivedLockedHint: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  archivedLockedText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
