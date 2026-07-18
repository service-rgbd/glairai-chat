import { Ionicons } from "@expo/vector-icons";
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import React, { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import type { GUser } from "@/contexts/chats-types";
import { useCachedMediaUrl } from "@/hooks/useCachedMediaUrl";
import { useColors } from "@/hooks/useColors";
import { resolveAudioMessageUrl, type AudioMessagePayload } from "@/lib/media";

const WAVEFORM_BARS = [
  0.28, 0.62, 0.44, 0.86, 0.52, 0.74, 0.38, 0.68, 0.56, 0.42, 0.78, 0.48, 0.66, 0.34, 0.58,
  0.72, 0.46, 0.64,
];

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

interface VoiceNoteBubbleProps {
  messageId: string;
  audioPayload: AudioMessagePayload;
  isMe: boolean;
  time: string;
  profileUser?: Pick<GUser, "avatar" | "initials" | "color">;
  renderStatusIcon: () => React.ReactNode;
}

export function VoiceNoteBubble({
  messageId,
  audioPayload,
  isMe,
  time,
  profileUser,
  renderStatusIcon,
}: VoiceNoteBubbleProps) {
  const colors = useColors();
  const remoteAudioUrl = useMemo(
    () => resolveAudioMessageUrl(audioPayload),
    [audioPayload],
  );
  const playbackUrl = useCachedMediaUrl(remoteAudioUrl);
  const player = useAudioPlayer(playbackUrl, {
    updateInterval: 80,
    downloadFirst: Boolean(playbackUrl?.startsWith("http")),
  });
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!playbackUrl) return;
    player.replace(playbackUrl);
  }, [player, playbackUrl]);

  const totalDuration = useMemo(() => {
    if (playerStatus.duration && playerStatus.duration > 0) {
      return playerStatus.duration;
    }
    return audioPayload.durationSeconds > 0 ? audioPayload.durationSeconds : 0;
  }, [audioPayload.durationSeconds, playerStatus.duration]);

  const currentTime = Math.max(0, playerStatus.currentTime || 0);
  const playbackProgress =
    totalDuration > 0 ? Math.min(currentTime / totalDuration, 1) : 0;
  const audioDisplaySeconds = player.playing ? currentTime : totalDuration || audioPayload.durationSeconds;
  const playbackUnavailable = !playbackUrl;
  const isLoading = Boolean(remoteAudioUrl && !playbackUrl);

  const togglePlayback = () => {
    if (playbackUnavailable) return;

    void (async () => {
      try {
        await setIsAudioActiveAsync(true);
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: "mixWithOthers",
        });

        if (player.playing) {
          player.pause();
          return;
        }

        if (
          playerStatus.duration > 0 &&
          playerStatus.currentTime >= playerStatus.duration - 0.05
        ) {
          await player.seekTo(0);
        }

        player.play();
      } catch {
        // Ignorer si la session audio est indisponible.
      }
    })();
  };

  return (
    <View style={styles.voiceNote}>
      <Pressable
        style={styles.voicePlayBtn}
        onPress={togglePlayback}
        disabled={playbackUnavailable}
        hitSlop={8}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isMe ? colors.chatBubbleSentText : colors.primary}
          />
        ) : (
          <Ionicons
            name={player.playing ? "pause" : "play"}
            size={22}
            color={
              playbackUnavailable
                ? colors.mutedForeground
                : isMe
                  ? colors.chatBubbleSentText
                  : colors.mutedForeground
            }
          />
        )}
      </Pressable>

      <View style={styles.voiceWaveWrap}>
        <View style={styles.waveformRow}>
          {WAVEFORM_BARS.map((value, index) => {
            const barEnd = (index + 1) / WAVEFORM_BARS.length;
            const isPlayed = barEnd <= playbackProgress;
            return (
              <View
                key={`${messageId}-bar-${index}`}
                style={[
                  styles.waveformBar,
                  {
                    height: 6 + value * 16,
                    backgroundColor: isPlayed
                      ? isMe
                        ? colors.chatBubbleSentText
                        : colors.primary
                      : isMe
                        ? "rgba(255,255,255,0.35)"
                        : colors.border,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.voiceMetaRow}>
          <Text
            style={[
              styles.voiceDuration,
              { color: isMe ? "rgba(255,255,255,0.78)" : colors.mutedForeground },
            ]}
          >
            {playbackUnavailable ? "Audio indisponible" : formatDuration(audioDisplaySeconds)}
          </Text>
          <View style={styles.voiceTimeRow}>
            <Text
              style={[
                styles.voiceTime,
                { color: isMe ? "rgba(255,255,255,0.72)" : colors.mutedForeground },
              ]}
            >
              {time}
            </Text>
            {renderStatusIcon()}
          </View>
        </View>
      </View>

      {profileUser ? (
        <View style={styles.voiceAvatarWrap}>
          <Avatar
            uri={profileUser.avatar}
            initials={profileUser.initials}
            color={profileUser.color}
            size={36}
          />
          <View
            style={[
              styles.voiceMicBadge,
              { backgroundColor: isMe ? colors.chatBubbleSent : colors.background },
            ]}
          >
            <Ionicons name="mic" size={10} color={colors.primary} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  voiceNote: {
    minWidth: 240,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  voicePlayBtn: {
    width: 28,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  voiceWaveWrap: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  waveformRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 28,
  },
  waveformBar: {
    width: 3,
    borderRadius: 999,
  },
  voiceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  voiceDuration: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  voiceTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  voiceTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  voiceAvatarWrap: {
    position: "relative",
    marginTop: 2,
  },
  voiceMicBadge: {
    position: "absolute",
    left: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
});
