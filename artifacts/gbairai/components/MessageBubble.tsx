import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { GMessage, GUser } from "@/contexts/chats-types";
import { LinkableText } from "@/components/LinkableText";
import { ViewOnceMediaIcon } from "@/components/ViewOnceMediaIcon";
import { VoiceNoteBubble } from "@/components/VoiceNoteBubble";
import { useCachedMediaUrl } from "@/hooks/useCachedMediaUrl";
import { useChatFontScale } from "@/hooks/useChatFontScale";
import { useResolvableMediaUrl } from "@/hooks/useResolvableMediaUrl";
import { useColors } from "@/hooks/useColors";
import {
  getCallMessageLabel,
  getCallMessagePayloadFromContent,
  isCallMessageNegative,
} from "@/lib/call-messages";
import { DELETED_MESSAGE_LABEL } from "@/lib/message-meta";
import { getEmoji3dDisplayUrl, getEmoji3dPayloadFromContent } from "@/lib/emoji-messages";
import {
  getDisplayMediaUrl,
  parseAudioMessagePayload,
  parseImageMessagePayload,
  parseVideoMessagePayload,
} from "@/lib/media";
import {
  isViewOnceOpenedContent,
  parseViewOnceOpenedContent,
  VIEW_ONCE_ALREADY_OPENED_LABEL,
  VIEW_ONCE_SCREENSHOT_LABEL,
} from "@/lib/view-once-media";

interface MessageBubbleProps {
  message: GMessage;
  isMe: boolean;
  showSenderName?: boolean;
  sender?: GUser;
  profileUser?: Pick<GUser, "avatar" | "initials" | "color">;
  isLast?: boolean;
  onLongPress?: () => void;
  onReactionPress?: (emoji: string) => void;
}

export function MessageBubble({
  message,
  isMe,
  showSenderName,
  sender,
  profileUser,
  isLast,
  onLongPress,
  onReactionPress,
}: MessageBubbleProps) {
  const colors = useColors();
  const { messageFontSize, metaFontSize } = useChatFontScale();
  const isDeletedMessage = Boolean(message.isDeleted);
  const audioPayload =
    !isDeletedMessage && message.type === "audio" ? parseAudioMessagePayload(message.content) : null;
  const imagePayload =
    !isDeletedMessage && message.type === "image" ? parseImageMessagePayload(message.content) : null;
  const videoPayload =
    !isDeletedMessage && message.type === "video" ? parseVideoMessagePayload(message.content) : null;
  const emoji3dPayload =
    !isDeletedMessage && message.type === "text" ? getEmoji3dPayloadFromContent(message.content) : null;
  const callPayload =
    !isDeletedMessage && message.type === "text" && !emoji3dPayload
      ? getCallMessagePayloadFromContent(message.content)
      : null;
  const resolvedImageUrl = useResolvableMediaUrl(imagePayload?.key, imagePayload?.url);
  const resolvedVideoUrl = videoPayload ? getDisplayMediaUrl(videoPayload.key, videoPayload.url) : null;
  const resolvedVideoThumbnailUrl = useResolvableMediaUrl(
    videoPayload?.thumbnailKey,
    videoPayload?.thumbnailUrl,
  );
  const isViewOnceOpened = isViewOnceOpenedContent(message.content);
  const viewOnceOpenedPayload = isViewOnceOpened ? parseViewOnceOpenedContent(message.content) : null;
  const isViewOnceImage = Boolean(imagePayload?.viewOnce);
  const isViewOnceVideo = Boolean(videoPayload?.viewOnce);
  const isViewOnceMedia = isViewOnceImage || isViewOnceVideo;
  const isViewOnceCompact = isViewOnceMedia || isViewOnceOpened;
  const viewOnceMediaKind: "image" | "video" =
    imagePayload || viewOnceOpenedPayload?.mediaType === "image" || message.type === "image"
      ? "image"
      : "video";
  const viewOnceLabel = isViewOnceOpened
    ? VIEW_ONCE_ALREADY_OPENED_LABEL
    : viewOnceMediaKind === "video"
      ? "Vidéo"
      : "Photo";
  const viewOnceScreenshotted = viewOnceOpenedPayload?.screenshotted === true;
  const cachedImageUrl = useCachedMediaUrl(resolvedImageUrl);
  const cachedVideoThumbnailUrl = useCachedMediaUrl(resolvedVideoThumbnailUrl);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [resolvedImageUrl]);

  const time = new Date(message.timestamp).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isMediaMessage = Boolean(
    (imagePayload && !isViewOnceImage) || (videoPayload && !isViewOnceVideo),
  );
  const isAudioMessage = Boolean(audioPayload);
  const hideDefaultMeta = (isMediaMessage && !isViewOnceCompact) || isAudioMessage || isViewOnceCompact;
  const replyAccentColor = isMe ? "rgba(255,255,255,0.92)" : colors.primary;
  const visibleReactions = Array.isArray(message.reactions)
    ? message.reactions.filter((reaction) => reaction.count > 0)
    : [];

  const renderReplyQuote = () => {
    if (!message.replyTo || isDeletedMessage) return null;
    return (
      <View
        style={[
          styles.replyQuote,
          {
            borderLeftColor: replyAccentColor,
            backgroundColor: isMe ? "rgba(255,255,255,0.12)" : colors.background,
          },
        ]}
      >
        <Text style={[styles.replySender, { color: replyAccentColor }]} numberOfLines={1}>
          {message.replyTo.senderName}
        </Text>
        <Text
          style={[
            styles.replyPreview,
            { color: isMe ? "rgba(255,255,255,0.82)" : colors.mutedForeground },
          ]}
          numberOfLines={2}
        >
          {message.replyTo.preview}
        </Text>
      </View>
    );
  };

  const renderReactions = () => {
    if (!visibleReactions.length) return null;
    return (
      <View style={[styles.reactionsRow, isMe ? styles.reactionsRowMe : styles.reactionsRowOther]}>
        {visibleReactions.map((reaction) => (
          <TouchableOpacity
            key={reaction.emoji}
            style={[
              styles.reactionPill,
              {
                backgroundColor: colors.card,
                borderColor: reaction.reactedByMe ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onReactionPress?.(reaction.emoji)}
            activeOpacity={0.8}
            disabled={!onReactionPress}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            {reaction.count > 1 ? (
              <Text style={[styles.reactionCount, { color: colors.mutedForeground }]}>
                {reaction.count}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const StatusIcon = ({ light = false }: { light?: boolean }) => {
    if (!isMe || callPayload) return null;
    if (message.status === "sending") {
      return (
        <Ionicons
          name="time-outline"
          size={12}
          color={light ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.72)"}
        />
      );
    }
    if (message.status === "failed") {
      return <Ionicons name="alert-circle" size={12} color="#FCA5A5" />;
    }
    const readColor = light ? "#fff" : colors.accent;
    const defaultColor = light ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)";
    if (message.status === "read" || message.status === "delivered") {
      return (
        <Ionicons
          name="checkmark-done"
          size={12}
          color={message.status === "read" ? readColor : light ? "rgba(255,255,255,0.92)" : defaultColor}
        />
      );
    }
    return <Ionicons name="checkmark" size={12} color={light ? "rgba(255,255,255,0.92)" : defaultColor} />;
  };

  const getSendingLabel = () => {
    if (message.status === "failed") {
      if (message.type === "image") return "Échec de l'envoi de la photo";
      if (message.type === "video") return "Échec de l'envoi de la vidéo";
      if (message.type === "audio") return "Échec de l'envoi du vocal";
      return "Échec de l'envoi";
    }
    if (message.status !== "sending") return null;
    if (message.type === "image") return "Envoi de photo...";
    if (message.type === "video") return "Envoi de vidéo...";
    if (message.type === "audio") return "Envoi du vocal...";
    return "Envoi...";
  };

  const openMediaViewer = (type: "image" | "video", consumeOnClose = false) => {
    const payload = type === "image" ? imagePayload : videoPayload;
    const url = type === "image" ? resolvedImageUrl : resolvedVideoUrl;
    if (!payload || !url) return;
    router.push({
      pathname: "/media-viewer",
      params: {
        chatId: message.chatId,
        messageId: message.id,
        viewOnce: isViewOnceMedia ? "1" : "",
        consumeOnClose: consumeOnClose ? "1" : "",
        type,
        url,
        key: payload.key,
        mimeType: payload.mimeType,
        width: type === "image" && imagePayload?.width ? String(imagePayload.width) : "",
        height: type === "image" && imagePayload?.height ? String(imagePayload.height) : "",
        durationSeconds:
          type === "video" && videoPayload?.durationSeconds
            ? String(videoPayload.durationSeconds)
            : "",
      },
    });
  };

  const renderViewOnceCompact = (options: { opened: boolean; consumeOnClose: boolean }) => {
    const iconColor = isMe ? "rgba(255,255,255,0.92)" : colors.chatBubbleReceivedText;
    const labelColor = isMe ? "rgba(255,255,255,0.95)" : colors.chatBubbleReceivedText;
    const sublabelColor = isMe ? "rgba(255,255,255,0.72)" : colors.mutedForeground;
    const timeColor = isMe ? "rgba(255,255,255,0.65)" : colors.mutedForeground;
    const mediaType = viewOnceMediaKind;
    const canOpen = !options.opened && (mediaType === "image" ? Boolean(resolvedImageUrl) : Boolean(resolvedVideoUrl));

    const content = (
      <View style={styles.viewOnceRow}>
        <ViewOnceMediaIcon color={iconColor} opened={options.opened} />
        <View style={styles.viewOnceTextCol}>
          <Text style={[styles.viewOnceRowLabel, { color: labelColor }]} numberOfLines={1}>
            {viewOnceLabel}
          </Text>
          {viewOnceScreenshotted && isMe ? (
            <Text style={[styles.viewOnceSubLabel, { color: sublabelColor }]} numberOfLines={1}>
              {VIEW_ONCE_SCREENSHOT_LABEL}
            </Text>
          ) : null}
        </View>
        <View style={styles.viewOnceRowMeta}>
          <Text style={[styles.viewOnceRowTime, { color: timeColor }]}>{time}</Text>
          <StatusIcon light={isMe} />
        </View>
      </View>
    );

    if (options.opened || !canOpen) {
      return content;
    }

    return (
      <TouchableOpacity
        onPress={() => openMediaViewer(mediaType, options.consumeOnClose)}
        onLongPress={onLongPress}
        delayLongPress={280}
        activeOpacity={0.82}
      >
        {content}
      </TouchableOpacity>
    );
  };

  const renderMediaOverlay = () => (
    <View style={styles.mediaOverlay}>
      <Text style={styles.mediaOverlayTime}>{time}</Text>
      <StatusIcon light />
    </View>
  );

  return (
    <View style={[styles.wrapper, isMe ? styles.wrapperMe : styles.wrapperOther]}>
      {(() => {
        const bubbleStyles = [
          styles.bubble,
          isMediaMessage && !isViewOnceCompact && styles.mediaBubble,
          isAudioMessage && styles.audioBubble,
          {
            backgroundColor: isMe ? colors.chatBubbleSent : colors.chatBubbleReceived,
            borderBottomRightRadius: isMe && isLast ? 4 : 18,
            borderBottomLeftRadius: !isMe && isLast ? 4 : 18,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isMe ? 0 : 0.06,
            shadowRadius: 4,
            elevation: isMe ? 0 : 1,
          },
        ];
        const bubbleBody = (
          <>
        {showSenderName && sender && (
          <Text style={[styles.senderName, { color: sender.color }]}>{sender.name}</Text>
        )}
        {renderReplyQuote()}
        {isDeletedMessage ? (
          <Text
            style={[
              styles.deletedText,
              {
                color: isMe ? "rgba(255,255,255,0.72)" : colors.mutedForeground,
                fontSize: messageFontSize,
              },
            ]}
          >
            {DELETED_MESSAGE_LABEL}
          </Text>
        ) : audioPayload ? (
          <VoiceNoteBubble
            messageId={message.id}
            audioPayload={audioPayload}
            isMe={isMe}
            time={time}
            profileUser={profileUser}
            renderStatusIcon={() => <StatusIcon />}
          />
        ) : isViewOnceCompact ? (
          renderViewOnceCompact({
            opened: isViewOnceOpened,
            consumeOnClose: !isMe && !isViewOnceOpened,
          })
        ) : imagePayload ? (
          <TouchableOpacity
            style={styles.mediaWrap}
            onPress={() => openMediaViewer("image")}
            onLongPress={onLongPress}
            delayLongPress={280}
            activeOpacity={0.86}
            disabled={!resolvedImageUrl}
          >
            {resolvedImageUrl && !imageLoadFailed ? (
              <Image
                source={{ uri: cachedImageUrl ?? resolvedImageUrl }}
                style={styles.imageMedia}
                contentFit="cover"
                cachePolicy="memory-disk"
                onError={() => setImageLoadFailed(true)}
              />
            ) : (
              <View
                style={[
                  styles.imageMedia,
                  styles.imageMediaFallback,
                  { backgroundColor: isMe ? "rgba(255,255,255,0.12)" : colors.background },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={36}
                  color={isMe ? "rgba(255,255,255,0.85)" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.imageFallbackText,
                    { color: isMe ? "rgba(255,255,255,0.85)" : colors.mutedForeground },
                  ]}
                >
                  Photo indisponible
                </Text>
              </View>
            )}
            {renderMediaOverlay()}
          </TouchableOpacity>
        ) : videoPayload ? (
          <TouchableOpacity
            style={styles.mediaWrap}
            onPress={() => openMediaViewer("video")}
            onLongPress={onLongPress}
            delayLongPress={280}
            activeOpacity={0.86}
          >
            <View style={styles.videoThumbWrap}>
              {cachedVideoThumbnailUrl ? (
                <Image
                  source={{ uri: cachedVideoThumbnailUrl }}
                  style={styles.videoMedia}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={[
                    styles.videoMedia,
                    styles.videoMediaFallback,
                    { backgroundColor: isMe ? "rgba(255,255,255,0.12)" : colors.background },
                  ]}
                >
                  <Ionicons
                    name="videocam"
                    size={36}
                    color={isMe ? "rgba(255,255,255,0.85)" : colors.mutedForeground}
                  />
                </View>
              )}
              <View style={styles.videoPlayOverlay}>
                <Ionicons name="play-circle" size={46} color="#fff" />
              </View>
              {renderMediaOverlay()}
            </View>
          </TouchableOpacity>
        ) : callPayload ? (
          <View style={styles.callRow}>
            <View
              style={[
                styles.callIcon,
                {
                  backgroundColor: isMe ? "rgba(255,255,255,0.16)" : colors.background,
                },
              ]}
            >
              <Ionicons
                name={
                  callPayload.callType === "video"
                    ? "videocam"
                    : callPayload.outcome === "completed"
                      ? "call"
                      : "call-outline"
                }
                size={18}
                color={
                  isCallMessageNegative(callPayload, isMe)
                    ? "#EF4444"
                    : isMe
                      ? "#fff"
                      : colors.primary
                }
              />
            </View>
            <Text
              style={[
                styles.callLabel,
                {
                  color: isCallMessageNegative(callPayload, isMe)
                    ? "#EF4444"
                    : isMe
                      ? colors.chatBubbleSentText
                      : colors.chatBubbleReceivedText,
                  fontSize: messageFontSize,
                },
              ]}
            >
              {getCallMessageLabel(callPayload, isMe)}
            </Text>
          </View>
        ) : emoji3dPayload ? (
          <View style={styles.emoji3dWrap}>
            <Image
              source={{ uri: getEmoji3dDisplayUrl(emoji3dPayload) }}
              style={styles.emoji3dImage}
              contentFit="contain"
            />
          </View>
        ) : (
          <LinkableText
            style={[
              styles.text,
              {
                color: isMe ? colors.chatBubbleSentText : colors.chatBubbleReceivedText,
                fontSize: messageFontSize,
              },
            ]}
            linkStyle={{
              color: isMe ? "#fff" : colors.primary,
            }}
          >
            {message.content}
          </LinkableText>
        )}
        {getSendingLabel() ? (
          <Text
            style={[
              styles.sendingLabel,
              {
                color:
                  message.status === "failed"
                    ? "#FCA5A5"
                    : isMe
                      ? "rgba(255,255,255,0.72)"
                      : colors.mutedForeground,
              },
            ]}
          >
            {getSendingLabel()}
          </Text>
        ) : null}
        {!hideDefaultMeta ? (
          <View style={styles.meta}>
            {message.editedAt ? (
              <Text
                style={[
                  styles.editedLabel,
                  {
                    color: isMe ? "rgba(255,255,255,0.65)" : colors.mutedForeground,
                    fontSize: metaFontSize,
                  },
                ]}
              >
                modifié
              </Text>
            ) : null}
            <Text
              style={[
                styles.time,
                {
                  color: isMe ? "rgba(255,255,255,0.65)" : colors.mutedForeground,
                  fontSize: metaFontSize,
                },
              ]}
            >
              {time}
            </Text>
            <StatusIcon />
          </View>
        ) : null}
          </>
        );

        if (isAudioMessage) {
          return (
            <Pressable style={bubbleStyles} onLongPress={onLongPress} delayLongPress={280}>
              {bubbleBody}
            </Pressable>
          );
        }

        return (
          <TouchableOpacity
            style={bubbleStyles}
            onLongPress={onLongPress}
            activeOpacity={onLongPress ? 0.82 : 1}
          >
            {bubbleBody}
          </TouchableOpacity>
        );
      })()}
      {renderReactions()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  wrapperMe: {
    alignItems: "flex-end",
  },
  wrapperOther: {
    alignItems: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 7,
    gap: 2,
  },
  mediaBubble: {
    paddingHorizontal: 3,
    paddingTop: 3,
    paddingBottom: 3,
  },
  audioBubble: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  senderName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  replyQuote: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
    gap: 2,
  },
  replySender: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  replyPreview: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: -2,
    marginBottom: 2,
    maxWidth: "78%",
  },
  reactionsRowMe: {
    justifyContent: "flex-end",
  },
  reactionsRowOther: {
    justifyContent: "flex-start",
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  text: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
  },
  deletedText: {
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    lineHeight: 24,
  },
  editedLabel: {
    fontFamily: "Inter_400Regular",
  },
  mediaWrap: {
    position: "relative",
  },
  mediaOverlay: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.52)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediaOverlayTime: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  emoji3dWrap: {
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji3dImage: {
    width: 72,
    height: 72,
  },
  imageMedia: {
    width: 240,
    minHeight: 180,
    maxHeight: 320,
    aspectRatio: 0.78,
    borderRadius: 14,
  },
  imageMediaFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imageFallbackText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  viewOnceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 156,
    paddingVertical: 2,
  },
  viewOnceRowLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  viewOnceTextCol: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  viewOnceSubLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  viewOnceRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  viewOnceRowTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  videoThumbWrap: {
    width: 240,
    minHeight: 180,
    maxHeight: 320,
    aspectRatio: 0.78,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  videoMedia: {
    width: "100%",
    height: "100%",
  },
  videoMediaFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  sendingLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 160,
  },
  callIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  callLabel: {
    flexShrink: 1,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  time: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
