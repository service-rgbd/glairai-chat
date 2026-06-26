import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChannelListItem } from "@/modules/channels/components/ChannelListItem";
import { ChannelPostCard } from "@/modules/channels/components/ChannelPostCard";
import { ChannelSearchBar } from "@/modules/channels/components/ChannelSearchBar";
import { NetworkStatusChip } from "@/components/NetworkStatusChip";
import { useNetworkStatus } from "@/contexts/NetworkStatusContext";
import { useChannels } from "@/modules/channels/context/ChannelsContext";
import type { Channel, ChannelPost } from "@/modules/channels/types";
import { useAuth } from "@/contexts/AuthContext";
import { getDisplayMediaUrl } from "@/lib/media";
import { useColors } from "@/hooks/useColors";

export default function ChannelsListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser } = useAuth();
  const {
    discoverySections,
    feedPosts,
    isLoadingDiscovery,
    isLoadingFeed,
    discoveryError,
    refreshDiscovery,
    refreshFeed,
    searchChannels,
    follow,
    unfollow,
    reactToPost,
    recordView,
  } = useChannels();
  const { isOffline, notifyOfflineAction } = useNetworkStatus();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Channel[]>([]);
  const [searching, setSearching] = useState(false);
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      void searchChannels(query)
        .then(setSearchResults)
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [search, searchChannels]);

  const showFeed = useMemo(() => !search.trim() && feedPosts.length > 0, [feedPosts.length, search]);

  const ownedChannels = useMemo(() => {
    const mineSection = discoverySections.find((section) => section.title === "Mes chaînes");
    if (mineSection?.channels.length) {
      return mineSection.channels;
    }

    const byId = new Map<string, Channel>();
    for (const section of discoverySections) {
      for (const channel of section.channels) {
        if (channel.role === "owner" || channel.ownerId === currentUser?.id) {
          byId.set(channel.id, channel);
        }
      }
    }
    return Array.from(byId.values()).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }, [currentUser?.id, discoverySections]);

  const browseSections = useMemo(
    () => discoverySections.filter((section) => section.title !== "Mes chaînes"),
    [discoverySections],
  );

  useFocusEffect(
    useCallback(() => {
      if (discoveryError || (!isLoadingDiscovery && discoverySections.length === 0)) {
        void refreshDiscovery();
        void refreshFeed();
      }
    }, [
      discoveryError,
      discoverySections.length,
      isLoadingDiscovery,
      refreshDiscovery,
      refreshFeed,
    ]),
  );

  const handleFollowToggle = async (channel: Channel) => {
    setFollowBusyId(channel.id);
    try {
      if (channel.isFollowing) {
        await unfollow(channel.id);
      } else {
        await follow(channel.id);
      }
      await refreshDiscovery();
    } finally {
      setFollowBusyId(null);
    }
  };

  const onRefresh = async () => {
    if (isOffline) {
      notifyOfflineAction();
      return;
    }
    setRefreshing(true);
    try {
      await Promise.all([refreshDiscovery(), refreshFeed()]);
    } finally {
      setRefreshing(false);
    }
  };

  const openPostMedia = (post: ChannelPost) => {
    if (!post.mediaUrl || post.mediaType === "text") return;
    const url = getDisplayMediaUrl("", post.mediaUrl);
    const params = new URLSearchParams({
      type: post.mediaType,
      url,
      mimeType: post.mediaType === "image" ? "image/jpeg" : "video/mp4",
    });
    router.push(`/media-viewer?${params.toString()}`);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: colors.text }]}>Chaînes</Text>
          <NetworkStatusChip />
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/channel/create")}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ChannelSearchBar value={search} onChangeText={setSearch} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        {search.trim() ? (
          <View>
            {searching ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              searchResults.map((channel) => (
                <ChannelListItem
                  key={channel.id}
                  channel={channel}
                  onPress={() => router.push(`/channel/${channel.id}`)}
                  onFollowPress={() => void handleFollowToggle(channel)}
                  followLoading={followBusyId === channel.id}
                />
              ))
            )}
          </View>
        ) : (
          <>
            {ownedChannels.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Ma chaîne</Text>
                </View>
                {ownedChannels.map((channel) => (
                  <TouchableOpacity
                    key={`owned-${channel.id}`}
                    style={[styles.ownedCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push(`/channel/${channel.id}`)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.ownedCardBody}>
                      <Text style={[styles.ownedCardTitle, { color: colors.text }]} numberOfLines={1}>
                        {channel.name}
                      </Text>
                      <Text style={[styles.ownedCardHint, { color: colors.mutedForeground }]}>
                        {channel.followersCount} abonné{channel.followersCount > 1 ? "s" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.ownedManageBtn, { borderColor: colors.border }]}
                      onPress={() => router.push(`/channel/${channel.id}/settings`)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="settings-outline" size={18} color={colors.primary} />
                      <Text style={[styles.ownedManageText, { color: colors.primary }]}>Gérer</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {showFeed ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Votre fil</Text>
                </View>
                {isLoadingFeed ? (
                  <ActivityIndicator style={styles.loader} color={colors.primary} />
                ) : (
                  feedPosts.map((post) => (
                    <ChannelPostCard
                      key={post.id}
                      post={post}
                      onReact={(emoji) => void reactToPost(post.id, emoji).then(() => refreshFeed())}
                      onRecordView={() => void recordView(post.id)}
                      onOpenMedia={openPostMedia}
                    />
                  ))
                )}
              </View>
            ) : null}

            {discoveryError ? (
              <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="cloud-offline-outline" size={22} color={colors.destructive} />
                <View style={styles.errorCopy}>
                  <Text style={[styles.errorTitle, { color: colors.text }]}>Impossible de charger les chaînes</Text>
                  <Text style={[styles.errorHint, { color: colors.mutedForeground }]}>
                    Vérifiez votre connexion puis réessayez.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.errorBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (isOffline) {
                      notifyOfflineAction();
                      return;
                    }
                    void onRefresh();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.errorBtnText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {isLoadingDiscovery && !discoverySections.length ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              browseSections.map((section) => (
                <View key={section.title} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                    <TouchableOpacity activeOpacity={0.75}>
                      <Text style={[styles.seeAll, { color: colors.primary }]}>Voir tout</Text>
                    </TouchableOpacity>
                  </View>
                  {section.channels.map((channel) => (
                    <ChannelListItem
                      key={`${section.title}-${channel.id}`}
                      channel={channel}
                      onPress={() => router.push(`/channel/${channel.id}`)}
                      onFollowPress={() => void handleFollowToggle(channel)}
                      followLoading={followBusyId === channel.id}
                    />
                  ))}
                </View>
              ))
            )}

            {!search.trim() && !isLoadingDiscovery && !discoveryError && !browseSections.length ? (
              <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
                Aucune chaîne à explorer pour le moment. Créez la vôtre ou revenez plus tard.
              </Text>
            ) : null}

            {!search.trim() ? (
              <TouchableOpacity
                style={[styles.createCta, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/channel/create")}
                activeOpacity={0.85}
              >
                <Ionicons name="megaphone-outline" size={22} color={colors.primary} />
                <View style={styles.createCtaText}>
                  <Text style={[styles.createCtaTitle, { color: colors.text }]}>
                    Vous avez une activité ou une marque ?
                  </Text>
                  <Text style={[styles.createCtaHint, { color: colors.mutedForeground }]}>
                    Créez votre chaîne — elle apparaîtra ici une fois publiée.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  loader: {
    marginVertical: 24,
  },
  createCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  createCtaText: {
    flex: 1,
    gap: 4,
  },
  createCtaTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  createCtaHint: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  ownedCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ownedCardBody: {
    flex: 1,
    minWidth: 0,
  },
  ownedCardTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  ownedCardHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  ownedManageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ownedManageText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  errorCopy: {
    flex: 1,
    gap: 2,
  },
  errorTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  errorHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  errorBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  emptyHint: {
    textAlign: "center",
    marginHorizontal: 24,
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
});
