import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { StoryMediaComposer } from "@/components/StoryMediaComposer";
import { StoryMediaPickerModal } from "@/components/StoryMediaPickerModal";
import { StoryTextComposer } from "@/components/StoryTextComposer";
import { useAuth } from "@/contexts/AuthContext";
import type { GStory, GUser, StoryComposerDraft } from "@/contexts/chats-types";
import { formatTimestamp } from "@/lib/format-timestamp";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { openGlobalSearch } from "@/lib/navigation";
import { generateVideoThumbnailUri, getDisplayMediaUrl, parseStoryMediaPayload } from "@/lib/media";
import { openUserStories, groupStoriesByUser } from "@/lib/story-playback";
import type { UploadStatus } from "@/lib/upload-status";

export default function StatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const { currentUser } = useAuth();
  const { stories, users, createStory, isUserBlocked } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const currentUserId = currentUser?.id ?? "me";
  const [composerOpen, setComposerOpen] = useState(false);
  const [textComposerOpen, setTextComposerOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<UploadStatus | null>(null);
  const [draft, setDraft] = useState<StoryComposerDraft>({
    type: "text",
    text: "",
    mediaUri: null,
    mimeType: null,
    backgroundColor: "#F4435D",
  });

  useEffect(() => {
    if (compose === "1") {
      setMediaPickerOpen(true);
    }
  }, [compose]);

  const myStories = stories.filter((s) => s.userId === currentUserId);
  const othersStories = useMemo(
    () =>
      groupStoriesByUser({
        stories,
        users,
        currentUserId,
        isUserBlocked,
      }),
    [stories, users, currentUserId, isUserBlocked],
  );

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

  const recentUpdates = othersStories.filter((g) => g.stories.some((s) => !s.viewerIds.includes(currentUserId)));
  const viewedUpdates = othersStories.filter((g) => g.stories.every((s) => s.viewerIds.includes(currentUserId)));

  const openStoryForUser = (targetUserId: string, storyList: GStory[]) => {
    if (!storyList.length) {
      setMediaPickerOpen(true);
      return;
    }
    openUserStories({
      stories,
      users,
      targetUserId,
      currentUserId,
      includeQueue: targetUserId !== currentUserId,
    });
  };

  const applySelectedMedia = async (payload: {
    uri: string;
    mediaType: "image" | "video";
    mimeType: string | null;
    assetId?: string | null;
  }) => {
    if (payload.mediaType === "video") {
      try {
        const previewThumbnailUri = await generateVideoThumbnailUri(payload.uri);
        setDraft({
          type: "video",
          text: "",
          mediaUri: payload.uri,
          mimeType: payload.mimeType ?? "video/mp4",
          mediaAssetId: payload.assetId,
          backgroundColor: "#0F172A",
          previewThumbnailUri,
        });
      } catch {
        setDraft({
          type: "video",
          text: "",
          mediaUri: payload.uri,
          mimeType: payload.mimeType ?? "video/mp4",
          mediaAssetId: payload.assetId,
          backgroundColor: "#0F172A",
          previewThumbnailUri: null,
        });
      }
    } else {
      setDraft({
        type: "image",
        text: "",
        mediaUri: payload.uri,
        mimeType: payload.mimeType ?? "image/jpeg",
        mediaAssetId: payload.assetId,
        backgroundColor: "#0F172A",
        previewThumbnailUri: null,
      });
    }
    setMediaPickerOpen(false);
    setComposerOpen(true);
  };

  const openTextComposer = () => {
    resetDraft();
    setMediaPickerOpen(false);
    setTextComposerOpen(true);
  };

  const openMediaPickerForType = (type: "image" | "video") => {
    setTextComposerOpen(false);
    setComposerOpen(false);
    setDraft((current) => ({
      ...current,
      type,
      text: "",
      mediaUri: null,
      mimeType: null,
      previewThumbnailUri: null,
    }));
    setMediaPickerOpen(true);
  };

  const handleVoiceStatus = () => {
    Alert.alert("Statut vocal", "Cette fonctionnalité arrive bientôt.");
  };

  const resetDraft = () => {
    setDraft({
      type: "text",
      text: "",
      mediaUri: null,
      mimeType: null,
      backgroundColor: "#F4435D",
      previewThumbnailUri: null,
    });
  };

  const canPublish =
    !isPublishing && draft.type !== "text" && Boolean(draft.mediaUri);

  const publishStory = async () => {
    if (!canPublish) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPublishing(true);
    try {
      await createStory(draft, setPublishStatus);
      resetDraft();
      setComposerOpen(false);
    } finally {
      setIsPublishing(false);
      setPublishStatus(null);
    }
  };

  const publishTextStory = async (payload: { text: string; backgroundColor: string }) => {
    if (isPublishing) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPublishing(true);
    try {
      await createStory(
        {
          type: "text",
          text: payload.text,
          mediaUri: null,
          mimeType: null,
          backgroundColor: payload.backgroundColor,
        },
        setPublishStatus,
      );
      resetDraft();
      setTextComposerOpen(false);
    } finally {
      setIsPublishing(false);
      setPublishStatus(null);
    }
  };

  const closeTextComposer = () => {
    setTextComposerOpen(false);
    resetDraft();
  };

  const closeComposer = () => {
    setComposerOpen(false);
    resetDraft();
  };

  const StoryCard = ({
    user,
    storyList,
    isMe = false,
  }: {
    user: GUser;
    storyList: GStory[];
    isMe?: boolean;
  }) => {
    const latest = storyList[storyList.length - 1];
    const allSeen = storyList.length > 0 && storyList.every((s) => s.viewerIds.includes(currentUserId));
    const mediaPayload = latest?.type !== "text" && latest ? parseStoryMediaPayload(latest.content) : null;
    const mediaUrl = mediaPayload ? getDisplayMediaUrl(mediaPayload.key, mediaPayload.url) : null;
    const storyThumbnailUrl = mediaPayload?.thumbnailUrl
      ? getDisplayMediaUrl("", mediaPayload.thumbnailUrl)
      : null;

    return (
      <TouchableOpacity
        style={[
          styles.storyCard,
          {
            backgroundColor: latest?.backgroundColor ?? colors.card,
            borderColor: allSeen ? colors.border : colors.primary,
          },
        ]}
        onPress={() => {
          if (latest) {
            openStoryForUser(user.id, storyList);
            return;
          }
          setMediaPickerOpen(true);
        }}
        activeOpacity={0.82}
      >
        {latest?.type === "image" && mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        ) : latest?.type === "video" ? (
          storyThumbnailUrl ? (
            <Image source={{ uri: storyThumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <View style={styles.storyVideoBg}>
              <Ionicons name="play-circle" size={44} color="#fff" />
            </View>
          )
        ) : null}
        <View style={styles.storyCardOverlay} />
        <View style={styles.storyCardTop}>
          <View style={[styles.storyAvatarWrap, { borderColor: allSeen ? "rgba(255,255,255,0.55)" : "#fff" }]}>
            <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={34} />
          </View>
          {isMe ? (
            <View style={[styles.storyAddMini, { backgroundColor: colors.primary }]}>
              <Text style={styles.storyAddMiniText}>+</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.storyCardBottom}>
          <Text style={styles.storyCardName} numberOfLines={1}>
            {isMe ? "Mon statut" : user.name}
          </Text>
          <Text style={styles.storyCardTime} numberOfLines={2}>
            {latest
              ? `${formatTimestamp(latest.createdAt)}${storyList.length > 1 ? ` • ${storyList.length} stories` : ""}`
              : "Ajouter une story"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Statuts</Text>
        <TouchableOpacity
          onPress={openGlobalSearch}
          activeOpacity={0.7}
          accessibilityLabel="Rechercher"
        >
          <Feather name="search" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 96 }}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Vos stories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storyCardsRow}
        >
          <StoryCard user={meUser} storyList={myStories} isMe />
        </ScrollView>

        {recentUpdates.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Mises à jour récentes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storyCardsRow}
            >
              {recentUpdates.map((g) => (
                <StoryCard key={g.user.id} user={g.user} storyList={g.stories} />
              ))}
            </ScrollView>
          </>
        )}

        {viewedUpdates.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Vues</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storyCardsRow}
            >
              {viewedUpdates.map((g) => (
                <StoryCard key={g.user.id} user={g.user} storyList={g.stories} />
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad + 78 }]}
        activeOpacity={0.85}
        onPress={() => setMediaPickerOpen(true)}
        accessibilityLabel="Créer un statut"
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <StoryMediaPickerModal
        visible={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelectText={openTextComposer}
        onSelectAsset={(payload) => {
          void applySelectedMedia(payload);
        }}
      />

      <StoryTextComposer
        visible={textComposerOpen}
        isPublishing={isPublishing}
        initialBackgroundColor={draft.backgroundColor}
        onClose={closeTextComposer}
        onPublish={publishTextStory}
        onSelectPhoto={() => openMediaPickerForType("image")}
        onSelectVideo={() => openMediaPickerForType("video")}
        onSelectVoice={handleVoiceStatus}
      />

      <StoryMediaComposer
        visible={composerOpen && Boolean(draft.mediaUri) && draft.type !== "text"}
        type={draft.type === "video" ? "video" : "image"}
        mediaUri={draft.mediaUri ?? ""}
        previewThumbnailUri={draft.previewThumbnailUri}
        caption={draft.text}
        isPublishing={isPublishing}
        publishStatus={publishStatus}
        onClose={closeComposer}
        onCaptionChange={(value) => setDraft((current) => ({ ...current, text: value }))}
        onPublish={() => void publishStory()}
      />
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
    paddingBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  storyCardsRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  storyCard: {
    width: 142,
    height: 218,
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    padding: 12,
    justifyContent: "space-between",
  },
  storyVideoBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  storyCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  storyCardTop: {
    position: "relative",
    alignSelf: "flex-start",
  },
  storyAvatarWrap: {
    borderWidth: 2,
    borderRadius: 22,
    padding: 2,
  },
  storyAddMini: {
    position: "absolute",
    right: -5,
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  storyAddMiniText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  storyCardBottom: {
    gap: 4,
  },
  storyCardName: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyCardTime: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 16,
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
