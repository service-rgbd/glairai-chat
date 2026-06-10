import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ChannelPostCard } from "@/modules/channels/components/ChannelPostCard";
import { useChannels } from "@/modules/channels/context/ChannelsContext";
import type { Channel, ChannelPost } from "@/modules/channels/types";
import { useColors } from "@/hooks/useColors";

export default function ChannelDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getChannel,
    getChannelPosts,
    follow,
    unfollow,
    publishPost,
    reactToPost,
    recordView,
    refreshFeed,
  } = useChannels();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [channelResult, postsResult] = await Promise.all([getChannel(id), getChannelPosts(id)]);
      setChannel(channelResult);
      setPosts(postsResult);
    } finally {
      setLoading(false);
    }
  }, [getChannel, getChannelPosts, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canPublish = channel?.role === "owner" || channel?.role === "admin";

  const handleFollow = async () => {
    if (!channel) return;
    setFollowBusy(true);
    try {
      const result = channel.isFollowing ? await unfollow(channel.id) : await follow(channel.id);
      setChannel(result.channel);
    } finally {
      setFollowBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!channel || !draft.trim()) return;
    setPublishing(true);
    try {
      await publishPost(channel.id, { content: draft.trim(), mediaType: "text" });
      setDraft("");
      const nextPosts = await getChannelPosts(channel.id);
      setPosts(nextPosts);
      await refreshFeed();
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !channel) {
    return (
      <View style={[styles.loaderRoot, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const initials = channel.name.slice(0, 2).toUpperCase();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Avatar uri={channel.avatarUrl} initials={initials} color="#6D4AFF" size={36} />
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text style={[styles.channelName, { color: colors.text }]} numberOfLines={1}>
                {channel.name}
              </Text>
              {channel.isVerified ? (
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              ) : null}
            </View>
            <Text style={[styles.followers, { color: colors.mutedForeground }]}>
              {channel.followersCount} abonnés
            </Text>
          </View>
        </View>
        {(channel.role === "owner" || channel.role === "admin") && (
          <TouchableOpacity
            onPress={() => router.push(`/channel/${channel.id}/settings`)}
            style={styles.backBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 120 }}>
        {channel.description ? (
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {channel.description}
          </Text>
        ) : null}

        {posts.map((post) => (
          <ChannelPostCard
            key={post.id}
            post={{ ...post, channel }}
            onReact={(emoji) =>
              void reactToPost(post.id, emoji).then(async () => {
                const nextPosts = await getChannelPosts(channel.id);
                setPosts(nextPosts);
              })
            }
            onRecordView={() => void recordView(post.id)}
          />
        ))}

        {!posts.length ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Aucune publication pour le moment.
          </Text>
        ) : null}
      </ScrollView>

      {canPublish ? (
        <View style={[styles.composeBar, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Publier sur la chaîne..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.composeInput, { color: colors.text, backgroundColor: colors.background }]}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: publishing ? 0.7 : 1 }]}
            onPress={() => void handlePublish()}
            disabled={publishing || !draft.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.followBar, { paddingBottom: bottomPad + 12, backgroundColor: colors.background }]}>
          <Text style={[styles.privacy, { color: colors.mutedForeground }]}>
            Pour cette chaîne, la confidentialité de votre profil et de votre numéro est renforcée.
          </Text>
          <TouchableOpacity
            style={[styles.followCta, { opacity: followBusy ? 0.7 : 1 }]}
            onPress={() => void handleFollow()}
            disabled={followBusy}
            activeOpacity={0.85}
          >
            <Text style={styles.followCtaText}>
              {channel.isFollowing ? "Ne plus suivre" : "Suivre la chaîne"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loaderRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  channelName: { fontSize: 16, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  followers: { fontSize: 12, fontFamily: "Inter_400Regular" },
  description: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  composeBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composeInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  followBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    gap: 10,
  },
  privacy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  followCta: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  followCtaText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
  },
});
