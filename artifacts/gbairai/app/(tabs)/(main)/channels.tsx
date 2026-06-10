import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { useChannels } from "@/modules/channels/context/ChannelsContext";
import type { Channel } from "@/modules/channels/types";
import { useColors } from "@/hooks/useColors";

export default function ChannelsListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    discoverySections,
    feedPosts,
    isLoadingDiscovery,
    isLoadingFeed,
    refreshDiscovery,
    refreshFeed,
    searchChannels,
    follow,
    unfollow,
    reactToPost,
    recordView,
  } = useChannels();

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
    setRefreshing(true);
    try {
      await Promise.all([refreshDiscovery(), refreshFeed()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Chaînes</Text>
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
                    />
                  ))
                )}
              </View>
            ) : null}

            {isLoadingDiscovery ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              discoverySections.map((section) => (
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
});
