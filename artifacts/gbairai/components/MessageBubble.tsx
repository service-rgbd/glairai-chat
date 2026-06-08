import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { GMessage, GUser } from "@/contexts/chats-types";
import { VoiceNoteBubble } from "@/components/VoiceNoteBubble";
import { useCachedMediaUrl } from "@/hooks/useCachedMediaUrl";
import { useChatFontScale } from "@/hooks/useChatFontScale";
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

interface MessageBubbleProps {
  message: GMessage;
  isMe: boolean;
  showSenderName?: boolean;
  sender?: GUser;
  profileUser?: Pick<GUser, "avatar" | "initials" | "color">;
  isLast?: boolean;
  onLongPress?: () => void;
}

export function MessageBubble({
  message,
  isMe,
  showSenderName,
  sender,
  profileUser,
  isLast,
  onLongPress,
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
  const resolvedImageUrl = imagePayload ? getDisplayMediaUrl(imagePayload.key, imagePayload.url) : null;
  const resolvedVideoUrl = videoPayload ? getDisplayMediaUrl(videoPayload.key, videoPayload.url) : null;
  const resolvedVideoThumbnailUrl =
    videoPayload && (videoPayload.thumbnailKey || videoPayload.thumbnailUrl)
      ? getDisplayMediaUrl(videoPayload.thumbnailKey ?? "", videoPayload.thumbnailUrl)
      : null;
  const cachedImageUrl = useCachedMediaUrl(resolvedImageUrl);
  const cachedVideoThumbnailUrl = useCachedMediaUrl(resolvedVideoThumbnailUrl);

  const time = new Date(message.timestamp).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isMediaMessage = Boolean(imagePayload || videoPayload);
  const isAudioMessage = Boolean(audioPayload);
  const hideDefaultMeta = isMediaMessage || isAudioMessage;

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

  const openMediaViewer = (type: "image" | "video") => {
    const payload = type === "image" ? imagePayload : videoPayload;
    const url = type === "image" ? resolvedImageUrl : resolvedVideoUrl;
    if (!payload || !url) return;
    router.push({
      pathname: "/media-viewer",
      params: {
        chatId: message.chatId,
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

  const renderMediaOverlay = () => (
    <View style={styles.mediaOverlay}>
      <Text style={styles.mediaOverlayTime}>{time}</Text>
      <StatusIcon light />
    </View>
  );

  return (
    <View style={[styles.wrapper, isMe ? styles.wrapperMe : styles.wrapperOther]}>
      <TouchableOpacity
        style={[
          styles.bubble,
          isMediaMessage && styles.mediaBubble,
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
        ]}
        onLongPress={onLongPress}
        activeOpacity={onLongPress ? 0.82 : 1}
      >
        {showSenderName && sender && (
          <Text style={[styles.senderName, { color: sender.color }]}>{sender.name}</Text>
        )}
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
        ) : imagePayload ? (
          <TouchableOpacity
            style={styles.mediaWrap}
            onPress={() => openMediaViewer("image")}
            activeOpacity={0.86}
          >
            <Image
              source={{ uri: cachedImageUrl ?? "" }}
              style={styles.imageMedia}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            {renderMediaOverlay()}
          </TouchableOpacity>
        ) : videoPayload ? (
          <TouchableOpacity
            style={styles.mediaWrap}
            onPress={() => openMediaViewer("video")}
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
          <Text
            style={[
              styles.text,
              {
                color: isMe ? colors.chatBubbleSentText : colors.chatBubbleReceivedText,
                fontSize: messageFontSize,
              },
            ]}
          >
            {message.content}
          </Text>
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
      </TouchableOpacity>
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
