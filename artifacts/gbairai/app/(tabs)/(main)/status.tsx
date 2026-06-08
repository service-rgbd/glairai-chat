import { Feather, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  Modal,
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
import { UploadProgressBanner } from "@/components/UploadProgressBanner";
import { useAuth } from "@/contexts/AuthContext";
import type { GStory, GUser, StoryComposerDraft } from "@/contexts/chats-types";
import { formatTimestamp } from "@/lib/format-timestamp";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { openGlobalSearch } from "@/lib/navigation";
import { generateVideoThumbnailUri, getDisplayMediaUrl, parseStoryMediaPayload } from "@/lib/media";
import { openUserStories } from "@/lib/story-playback";
import type { UploadStatus } from "@/lib/upload-status";

export default function StatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const { currentUser } = useAuth();
  const { stories, users, createStory } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const currentUserId = currentUser?.id ?? "me";
  const [composerOpen, setComposerOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<UploadStatus | null>(null);
  const [draft, setDraft] = useState<StoryComposerDraft>({
    type: "text",
    text: "",
    mediaUri: null,
    mimeType: null,
    backgroundColor: "#6D4AFF",
  });

  useEffect(() => {
    if (compose === "1") {
      setComposerOpen(true);
    }
  }, [compose]);

  const myStories = stories.filter((s) => s.userId === currentUserId);
  const othersStories = Object.values(users)
    .filter((u) => u.id !== currentUserId)
    .map((u) => ({
      user: u,
      stories: stories.filter((s) => s.userId === u.id),
    }))
    .filter((g) => g.stories.length > 0);

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
      setComposerOpen(true);
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

  const pickStoryMedia = async (mediaType: "image" | "video") => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === "image" ? ["images"] : ["videos"],
      allowsEditing: mediaType === "image",
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset?.uri) return;

    if (mediaType === "video") {
      try {
        const previewThumbnailUri = await generateVideoThumbnailUri(asset.uri);
        setDraft((current) => ({
          ...current,
          type: mediaType,
          mediaUri: asset.uri,
          mimeType: asset.mimeType ?? "video/mp4",
          backgroundColor: "#0F172A",
          previewThumbnailUri,
        }));
      } catch {
        setDraft((current) => ({
          ...current,
          type: mediaType,
          mediaUri: asset.uri,
          mimeType: asset.mimeType ?? "video/mp4",
          backgroundColor: "#0F172A",
          previewThumbnailUri: null,
        }));
      }
      return;
    }

    setDraft((current) => ({
      ...current,
      type: mediaType,
      mediaUri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
      backgroundColor: "#0F172A",
      previewThumbnailUri: null,
    }));
  };

  const resetDraft = () => {
    setDraft({
      type: "text",
      text: "",
      mediaUri: null,
      mimeType: null,
      backgroundColor: "#6D4AFF",
      previewThumbnailUri: null,
    });
  };

  const canPublish =
    !isPublishing &&
    ((draft.type === "text" && draft.text.trim().length > 0) ||
      (draft.type !== "text" && Boolean(draft.mediaUri)));

  const publishStory = async () => {
    if (!canPublish) return;
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
          setComposerOpen(true);
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
        onPress={() => setComposerOpen(true)}
        accessibilityLabel="Créer un statut"
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal visible={composerOpen} animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background, paddingTop: topPad + 12 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Créer un statut</Text>
            <TouchableOpacity
              onPress={() => {
                setComposerOpen(false);
                resetDraft();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalAction, { color: colors.primary }]}>Fermer</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mediaButtons}>
            <TouchableOpacity
              style={[styles.typeChip, { backgroundColor: draft.type === "text" ? colors.primary : colors.card, borderColor: draft.type === "text" ? colors.primary : colors.border }]}
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  type: "text",
                  mediaUri: null,
                  mimeType: null,
                  backgroundColor: "#6D4AFF",
                  previewThumbnailUri: null,
                }))
              }
              activeOpacity={0.8}
            >
              <Feather name="type" size={17} color={draft.type === "text" ? "#fff" : colors.primary} />
              <Text style={[styles.typeChipText, { color: draft.type === "text" ? "#fff" : colors.text }]}>Texte</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeChip, { backgroundColor: draft.type === "image" ? colors.primary : colors.card, borderColor: draft.type === "image" ? colors.primary : colors.border }]}
              onPress={() => {
                void pickStoryMedia("image");
              }}
              activeOpacity={0.8}
            >
              <Feather name="image" size={18} color={draft.type === "image" ? "#fff" : colors.primary} />
              <Text style={[styles.typeChipText, { color: draft.type === "image" ? "#fff" : colors.text }]}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeChip, { backgroundColor: draft.type === "video" ? colors.primary : colors.card, borderColor: draft.type === "video" ? colors.primary : colors.border }]}
              onPress={() => {
                void pickStoryMedia("video");
              }}
              activeOpacity={0.8}
            >
              <Feather name="video" size={18} color={draft.type === "video" ? "#fff" : colors.primary} />
              <Text style={[styles.typeChipText, { color: draft.type === "video" ? "#fff" : colors.text }]}>Vidéo</Text>
            </TouchableOpacity>
          </View>

          {draft.mediaUri ? (
            <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {draft.type === "image" ? (
                <Image source={{ uri: draft.mediaUri }} style={styles.previewMedia} contentFit="cover" />
              ) : (
                <View style={styles.videoPreview}>
                  {draft.previewThumbnailUri ? (
                    <Image source={{ uri: draft.previewThumbnailUri }} style={styles.previewMedia} contentFit="cover" />
                  ) : (
                    <View style={[styles.videoPreviewFallback, { backgroundColor: colors.background }]}>
                      <Ionicons name="videocam" size={42} color={colors.mutedForeground} />
                    </View>
                  )}
                  <View style={styles.videoPreviewOverlay}>
                    <Ionicons name="play-circle" size={52} color="#fff" />
                    <Text style={styles.videoPreviewOverlayText}>Aperçu vidéo</Text>
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={[styles.removeMediaBtn, { backgroundColor: colors.background }]}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    type: "text",
                    mediaUri: null,
                    mimeType: null,
                    backgroundColor: "#6D4AFF",
                    previewThumbnailUri: null,
                  }))
                }
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          ) : null}

          <TextInput
            style={[styles.statusInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder={
              draft.type === "text"
                ? "Que voulez-vous partager ?"
                : "Ajouter une légende (optionnel)"
            }
            placeholderTextColor={colors.mutedForeground}
            multiline
            value={draft.text}
            onChangeText={(value) => setDraft((current) => ({ ...current, text: value }))}
          />

          {publishStatus ? <UploadProgressBanner status={publishStatus} /> : null}

          <TouchableOpacity
            style={[styles.publishBtn, { backgroundColor: canPublish ? colors.primary : colors.muted }]}
            onPress={() => {
              void publishStory();
            }}
            disabled={!canPublish}
            activeOpacity={0.85}
          >
            <Text style={[styles.publishBtnText, { color: canPublish ? "#fff" : colors.mutedForeground }]}>
              {isPublishing ? "Publication..." : "Publier le statut"}
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
  modalRoot: { flex: 1, paddingHorizontal: 20, gap: 16 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  modalAction: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  statusInput: {
    minHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  publishBtn: {
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  publishBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  mediaButtons: {
    flexDirection: "row",
    gap: 12,
  },
  typeChip: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  typeChipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  previewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 10,
    position: "relative",
  },
  previewMedia: {
    width: "100%",
    height: 240,
    borderRadius: 14,
  },
  videoPreview: {
    width: "100%",
    height: 240,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  videoPreviewFallback: {
    width: "100%",
    height: 240,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  videoPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    gap: 8,
  },
  videoPreviewOverlayText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  removeMediaBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
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
