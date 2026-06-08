import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { StoryReactionBurst } from "@/components/StoryReactionBurst";
import { StoryReplyBar } from "@/components/StoryReplyBar";
import { useAuth } from "@/contexts/AuthContext";
import type { GStory, GUser } from "@/contexts/chats-types";
import { formatTimestamp } from "@/lib/format-timestamp";
import { useChats } from "@/contexts/chats-context-ref";
import { getDisplayMediaUrl, parseStoryMediaPayload } from "@/lib/media";
import {
  decodeStoryQueue,
  getNextStoryNavigation,
  getPreviousStoryNavigation,
  replaceStoryViewer,
  sortStoriesChronologically,
} from "@/lib/story-playback";
import { STORY_QUICK_REACTIONS } from "@/lib/story-reactions";

const STORY_DURATION_MS = 5000;

export default function StoryScreen() {
  const { id, userId: userIdParam, queue: queueParam } = useLocalSearchParams<{
    id: string;
    userId?: string;
    queue?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const { stories, users, addStoryView, deleteStory, replyToStory } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const currentUserId = currentUser?.id ?? "me";

  const storySnapshotRef = useRef<{ story: GStory; user: GUser } | null>(null);
  const liveStory = stories.find((story) => story.id === id);
  const ownerUserId = liveStory?.userId ?? userIdParam ?? storySnapshotRef.current?.story.userId;
  const liveUser = ownerUserId ? users[ownerUserId] : undefined;

  if (liveStory && liveUser) {
    storySnapshotRef.current = { story: liveStory, user: liveUser };
  }

  const story = liveStory ?? storySnapshotRef.current?.story;
  const user = liveUser ?? storySnapshotRef.current?.user;
  const viewerQueue = useMemo(() => decodeStoryQueue(queueParam), [queueParam]);
  const userStories = useMemo(() => {
    if (!ownerUserId) return [];
    return sortStoriesChronologically(stories.filter((item) => item.userId === ownerUserId));
  }, [ownerUserId, stories]);
  const currentStoryIndex = story ? userStories.findIndex((item) => item.id === story.id) : -1;

  const mediaPayload =
    story && story.type !== "text" ? parseStoryMediaPayload(story.content) : null;
  const resolvedMediaUrl = mediaPayload ? getDisplayMediaUrl(mediaPayload.key, mediaPayload.url) : null;
  const isVideoStory = story?.type === "video" && Boolean(resolvedMediaUrl);

  const player = useVideoPlayer(isVideoStory ? resolvedMediaUrl! : "", (instance) => {
    instance.loop = false;
  });

  const progress = useRef(new Animated.Value(0)).current;
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const isMyStory = Boolean(story && story.userId === currentUserId);
  const isDeletingRef = useRef(false);
  const hasAdvancedRef = useRef(false);
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [reactionBurst, setReactionBurst] = useState<string | null>(null);

  const storyViewers = useMemo(() => {
    if (!story || !isMyStory) return [];
    return story.viewerIds
      .filter((viewerId) => viewerId !== currentUserId)
      .map((viewerId) => users[viewerId])
      .filter((viewer): viewer is GUser => Boolean(viewer));
  }, [currentUserId, isMyStory, story, users]);

  const pauseStory = () => {
    progressAnimationRef.current?.stop();
    if (isVideoStory) {
      player.pause();
    }
  };

  const resumeStory = () => {
    if (!story || isReplyFocused) return;
    if (story.type === "video" && resolvedMediaUrl) {
      player.play();
      return;
    }
    progressAnimationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS,
      useNativeDriver: false,
    });
    progressAnimationRef.current.start(({ finished }) => {
      if (finished) {
        advanceStory();
      }
    });
  };

  const advanceStory = () => {
    if (hasAdvancedRef.current || !story || !ownerUserId) return;
    hasAdvancedRef.current = true;

    const next = getNextStoryNavigation({
      stories,
      users,
      currentUserId,
      userId: ownerUserId,
      storyId: story.id,
      queue: viewerQueue.length ? viewerQueue : [ownerUserId],
    });

    if (next) {
      replaceStoryViewer(next);
      return;
    }

    router.back();
  };

  const goToPreviousStory = () => {
    if (!story || !ownerUserId) return;
    pauseStory();
    hasAdvancedRef.current = true;

    const previous = getPreviousStoryNavigation({
      stories,
      currentUserId,
      userId: ownerUserId,
      storyId: story.id,
      queue: viewerQueue.length ? viewerQueue : [ownerUserId],
    });

    if (previous) {
      replaceStoryViewer(previous);
      return;
    }

    router.back();
  };

  const goToNextStory = () => {
    pauseStory();
    advanceStory();
  };

  useEffect(() => {
    if (!story) return;
    hasAdvancedRef.current = false;
    addStoryView(story.id);
    progress.setValue(0);

    if (story.type === "video" && resolvedMediaUrl) {
      void player.replaceAsync(resolvedMediaUrl).then(() => {
        player.play();
      });
      return;
    }

    progressAnimationRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION_MS,
      useNativeDriver: false,
    });
    progressAnimationRef.current.start(({ finished }) => {
      if (finished) {
        advanceStory();
      }
    });

    return () => {
      progressAnimationRef.current?.stop();
    };
  }, [id, story?.type, resolvedMediaUrl]);

  useEffect(() => {
    if (isReplyFocused) {
      pauseStory();
    } else {
      resumeStory();
    }
  }, [isReplyFocused]);

  useEffect(() => {
    if (!isVideoStory || isReplyFocused) return;

    const interval = setInterval(() => {
      const duration = player.duration;
      const currentTime = player.currentTime;

      if (duration > 0) {
        progress.setValue(Math.min(currentTime / duration, 1));
      }

      if (duration > 0 && currentTime >= duration - 0.15) {
        advanceStory();
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isVideoStory, isReplyFocused, player, progress]);

  if (!story || !user) {
    if (isDeletingRef.current) {
      return <View style={[styles.root, { backgroundColor: "#000" }]} />;
    }
    return (
      <View style={[styles.root, { backgroundColor: "#000", justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "#fff" }}>Statut introuvable</Text>
      </View>
    );
  }

  const confirmDeleteStory = () => {
    Alert.alert(
      "Supprimer ce statut ?",
      "Votre story sera supprimée immédiatement.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            isDeletingRef.current = true;
            router.back();
            void deleteStory(story.id).catch((error) => {
              Alert.alert(
                "Suppression impossible",
                error instanceof Error
                  ? error.message
                  : "Impossible de supprimer ce statut.",
              );
            });
          },
        },
      ],
    );
  };

  const handleReaction = async (emoji: string) => {
    const reaction = STORY_QUICK_REACTIONS.find((item) => item.emoji === emoji);
    if (reaction) {
      setReactionBurst(reaction.fluentName);
    }
    await replyToStory(story.id, { emoji });
  };

  return (
    <View style={[styles.root, { backgroundColor: story.backgroundColor || "#000" }]}>
      <View style={StyleSheet.absoluteFill}>
        {story.type === "text" ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: story.backgroundColor || "#0F172A" }]} />
        ) : story.type === "image" && resolvedMediaUrl ? (
          <Image source={{ uri: resolvedMediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : story.type === "video" && resolvedMediaUrl ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            fullscreenOptions={{ enabled: false }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111827" }]} />
        )}
      </View>

      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.65)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {story.type === "text" ? (
        <View style={styles.textStoryOverlay} pointerEvents="none">
          <Text style={styles.storyContent}>{story.content}</Text>
        </View>
      ) : mediaPayload?.caption ? (
        <View style={[styles.captionOverlay, { bottom: bottomPad + (isMyStory ? 120 : 190) }]} pointerEvents="none">
          <Text style={styles.mediaCaption}>{mediaPayload.caption}</Text>
        </View>
      ) : null}

      {reactionBurst ? (
        <StoryReactionBurst
          fluentName={reactionBurst}
          onDone={() => setReactionBurst(null)}
        />
      ) : null}

      <Pressable style={styles.tapZoneLeft} onPress={goToPreviousStory} />
      <Pressable style={styles.tapZoneRight} onPress={goToNextStory} />

      <View style={[styles.progressBar, { top: topPad + 8, left: 12, right: 12 }]}>
        <View style={styles.progressRow}>
          {userStories.map((item, index) => (
            <View key={item.id} style={styles.progressSegmentTrack}>
              {index < currentStoryIndex ? (
                <View style={[styles.progressSegmentFill, styles.progressSegmentComplete]} />
              ) : index === currentStoryIndex ? (
                <Animated.View
                  style={[
                    styles.progressSegmentFill,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.topBar, { paddingTop: topPad + 30 }]}>
        <Avatar uri={user.avatar} initials={user.initials} color={user.color} size={42} />
        <View style={styles.storyMeta}>
          <Text style={styles.storyUser}>{user.name}</Text>
          <Text style={styles.storyTime}>
            {formatTimestamp(story.createdAt)}
            {userStories.length > 1 ? ` • ${currentStoryIndex + 1}/${userStories.length}` : ""}
          </Text>
        </View>
        {isMyStory ? (
          <TouchableOpacity onPress={confirmDeleteStory} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={23} color="#fff" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomArea}>
        {isMyStory ? (
          <View style={[styles.footer, { paddingBottom: bottomPad + 8 }]}>
            <Text style={styles.viewCount}>
              {storyViewers.length} vue{storyViewers.length !== 1 ? "s" : ""}
            </Text>
            {storyViewers.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.viewersRow}
              >
                {storyViewers.map((viewer) => (
                  <View key={viewer.id} style={styles.viewerChip}>
                    <Avatar uri={viewer.avatar} initials={viewer.initials} color={viewer.color} size={34} />
                    <Text style={styles.viewerName} numberOfLines={1}>
                      {viewer.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.viewHint}>Les personnes qui regardent votre statut apparaîtront ici.</Text>
            )}
          </View>
        ) : (
          <StoryReplyBar
            ownerName={user.name.split(" ")[0] ?? user.name}
            bottomInset={bottomPad}
            onFocusChange={setIsReplyFocused}
            onSendText={(text) => replyToStory(story.id, { text })}
            onSendReaction={handleReaction}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  tapZoneLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "34%",
    zIndex: 5,
  },
  tapZoneRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "34%",
    zIndex: 5,
  },
  progressBar: {
    position: "absolute",
    zIndex: 10,
    left: 12,
    right: 12,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
  },
  progressSegmentTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  progressSegmentFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  progressSegmentComplete: {
    width: "100%",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 12,
  },
  storyMeta: { flex: 1 },
  storyUser: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  storyTime: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  textStoryOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    zIndex: 2,
  },
  storyContent: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 42,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  captionOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    zIndex: 8,
  },
  mediaCaption: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 24,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 12,
  },
  footer: {
    paddingHorizontal: 20,
    alignItems: "flex-start",
    gap: 10,
  },
  viewCount: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  viewHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  viewersRow: {
    gap: 12,
    paddingRight: 12,
  },
  viewerChip: {
    alignItems: "center",
    width: 72,
    gap: 6,
  },
  viewerName: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
