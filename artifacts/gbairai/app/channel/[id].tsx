import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "@/contexts/AuthContext";
import { ChannelPostCard } from "@/modules/channels/components/ChannelPostCard";
import { useChannels } from "@/modules/channels/context/ChannelsContext";
import { uploadChannelImage } from "@/modules/channels/lib/upload-image";
import type { Channel, ChannelPost } from "@/modules/channels/types";
import { canPublishOnChannel, isOfficialChannel } from "@/modules/channels/lib/channel-official";
import { getDisplayMediaUrl } from "@/lib/media";
import { useColors } from "@/hooks/useColors";

export default function ChannelDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authToken } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    getChannel,
    getChannelPosts,
    follow,
    unfollow,
    publishPost,
    reactToPost,
    recordView,
    reportChannel,
    refreshFeed,
  } = useChannels();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<{
    uri: string;
    mimeType: string;
    assetId?: string | null;
  } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

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

  const canPublish = channel ? canPublishOnChannel(channel) : false;
  const isOfficial = channel ? isOfficialChannel(channel) : false;

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

  const handleReportChannel = () => {
    if (!channel || reporting) return;
    Alert.alert(
      "Signaler cette chaîne",
      "Voulez-vous envoyer un signalement à l'équipe de modération ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Signaler",
          style: "destructive",
          onPress: () => {
            setReporting(true);
            void reportChannel(channel.id, "Signalement utilisateur depuis la fiche chaîne")
              .then(() => {
                Alert.alert("Signalement envoyé", "Merci. Notre équipe examinera cette chaîne.");
              })
              .catch((error) => {
                Alert.alert(
                  "Signalement impossible",
                  error instanceof Error ? error.message : "Veuillez réessayer plus tard.",
                );
              })
              .finally(() => setReporting(false));
          },
        },
      ],
    );
  };

  const pickAnnouncementImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setPendingImage({
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? "image/jpeg",
        assetId: result.assets[0].assetId,
      });
    }
  };

  const handlePublish = async () => {
    if (!channel) return;
    const text = draft.trim();
    if (!text && !pendingImage) return;

    setPublishing(true);
    try {
      let mediaUrl: string | undefined;
      if (pendingImage && authToken) {
        mediaUrl = await uploadChannelImage(
          authToken,
          pendingImage.uri,
          pendingImage.mimeType,
          "chat-image",
          pendingImage.assetId,
        );
      }

      await publishPost(channel.id, {
        content: text,
        mediaUrl,
        mediaType: mediaUrl ? "image" : "text",
      });
      setDraft("");
      setPendingImage(null);
      const nextPosts = await getChannelPosts(channel.id);
      setPosts(nextPosts);
      await refreshFeed();
    } finally {
      setPublishing(false);
    }
  };

  const canSend = Boolean(draft.trim() || pendingImage);

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
        {(channel.role === "owner" || channel.role === "admin") && !isOfficial ? (
          <TouchableOpacity
            onPress={() => router.push(`/channel/${channel.id}/settings`)}
            style={styles.backBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 120 }}>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoHeader}>
            <Avatar uri={channel.avatarUrl} initials={initials} color="#6D4AFF" size={64} />
            <View style={styles.infoBody}>
              <View style={styles.nameRow}>
                <Text style={[styles.infoName, { color: colors.text }]} numberOfLines={1}>
                  {channel.name}
                </Text>
                {channel.isVerified ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                ) : null}
              </View>
              <Text style={[styles.infoFollowers, { color: colors.mutedForeground }]}>
                {channel.followersCount} abonnés
              </Text>
              {channel.category ? (
                <Text style={[styles.infoCategory, { color: colors.primary }]}>
                  {channel.category}
                </Text>
              ) : null}
            </View>
          </View>
          {channel.description ? (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {channel.description}
            </Text>
          ) : (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              Aucune description pour cette chaîne.
            </Text>
          )}
          {isOfficial ? (
            <View style={[styles.officialBadge, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33` }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={[styles.officialBadgeText, { color: colors.primary }]}>
                Chaîne officielle — exemple en lecture seule
              </Text>
            </View>
          ) : null}
          <View style={styles.infoActions}>
            {canPublish ? (
              <>
                <TouchableOpacity
                  style={[styles.infoAction, styles.infoActionPrimary, { backgroundColor: colors.primary }]}
                  onPress={() => router.push(`/channel/${channel.id}/settings`)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="settings-outline" size={18} color="#fff" />
                  <Text style={[styles.infoActionText, { color: "#fff" }]}>Gérer la chaîne</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.infoAction, { borderColor: colors.border }]}
                  onPress={() => void handleFollow()}
                  disabled={followBusy}
                  activeOpacity={0.82}
                >
                  <Ionicons
                    name={channel.isFollowing ? "notifications" : "notifications-outline"}
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={[styles.infoActionText, { color: colors.text }]}>
                    {channel.isFollowing ? "Notifications actives" : "Suivre et notifier"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.infoAction, { borderColor: colors.border }]}
                  onPress={() => void handleFollow()}
                  disabled={followBusy}
                  activeOpacity={0.82}
                >
                  <Ionicons
                    name={channel.isFollowing ? "notifications" : "notifications-outline"}
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={[styles.infoActionText, { color: colors.text }]}>
                    {channel.isFollowing ? "Notifications actives" : "Suivre et notifier"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.infoAction, { borderColor: colors.border }]}
                  onPress={handleReportChannel}
                  disabled={reporting}
                  activeOpacity={0.82}
                >
                  <Ionicons name="flag-outline" size={18} color={colors.destructive} />
                  <Text style={[styles.infoActionText, { color: colors.destructive }]}>
                    {reporting ? "Envoi..." : "Signaler"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {posts.map((post) => (
          <ChannelPostCard
            key={post.id}
            post={{ ...post, channel }}
            onReact={(emoji) =>
              void reactToPost(post.id, emoji)
                .then(async () => {
                  const nextPosts = await getChannelPosts(channel.id);
                  setPosts(nextPosts);
                })
                .catch((error) => {
                  Alert.alert(
                    "Réaction impossible",
                    error instanceof Error
                      ? error.message
                      : "Suivez cette chaîne pour réagir à ses publications.",
                  );
                })
            }
            onRecordView={() => void recordView(post.id)}
            onOpenMedia={openPostMedia}
          />
        ))}

        {!posts.length ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Aucune publication pour le moment.
          </Text>
        ) : null}
      </ScrollView>

      {canPublish ? (
        <View style={[styles.composeWrap, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          {pendingImage ? (
            <View style={styles.pendingImageWrap}>
              <Image source={{ uri: pendingImage.uri }} style={styles.pendingImage} contentFit="cover" />
              <TouchableOpacity
                style={styles.pendingImageRemove}
                onPress={() => setPendingImage(null)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.composeBar}>
            <TouchableOpacity
              style={[styles.attachBtn, { borderColor: colors.border }]}
              onPress={() => void pickAnnouncementImage()}
              disabled={publishing}
              activeOpacity={0.8}
            >
              <Ionicons name="image-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Publier une annonce..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.composeInput, { color: colors.text, backgroundColor: colors.background }]}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: publishing || !canSend ? 0.7 : 1 }]}
              onPress={() => void handlePublish()}
              disabled={publishing || !canSend}
              activeOpacity={0.85}
            >
              {publishing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
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
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  infoName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    flexShrink: 1,
  },
  infoFollowers: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  infoCategory: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  infoActions: {
    flexDirection: "row",
    gap: 10,
  },
  infoAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
  },
  infoActionPrimary: {
    borderWidth: 0,
  },
  infoActionText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  officialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  officialBadgeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
  empty: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  composeWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  composeBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
  },
  attachBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingImageWrap: {
    marginHorizontal: 12,
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
  },
  pendingImage: {
    width: "100%",
    height: "100%",
  },
  pendingImageRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
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
