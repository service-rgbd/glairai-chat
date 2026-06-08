import { Feather, Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { UploadProgressBanner } from "@/components/UploadProgressBanner";
import { EmojiPickerSheet } from "@/components/EmojiPickerSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  createAudioUploadTarget,
  createMediaUploadTarget,
  generateVideoThumbnailUri,
  getDisplayMediaUrl,
  uploadAudioToSignedUrl,
  uploadChatVideoWithThumbnail,
  uploadFileToSignedUrl,
} from "@/lib/media";
import { runWithUploadStatus, type UploadStatus } from "@/lib/upload-status";
import { getEmoji3dPayloadFromContent, type Emoji3dMessagePayload } from "@/lib/emoji-messages";
import { getChatEmoji3dImageUrl } from "@/lib/story-reactions";

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendEmoji3d?: (payload: Emoji3dMessagePayload) => void;
  onSendAudio?: (payload: { url: string; key: string; durationSeconds: number; mimeType: string }) => void;
  onSendImage?: (payload: { url: string; key: string; mimeType: string; width?: number; height?: number }) => void;
  onSendVideo?: (payload: {
    url: string;
    key: string;
    mimeType: string;
    durationSeconds?: number;
    thumbnailKey?: string;
    thumbnailUrl?: string;
  }) => void;
  onTypingChange?: (isTyping: boolean) => void;
  bottomInset?: number;
  conversationId?: string;
  autoStartVoiceRecording?: boolean;
}

export function ChatInput({
  onSend,
  onSendEmoji3d,
  onSendAudio,
  onSendImage,
  onSendVideo,
  onTypingChange,
  bottomInset = 0,
  conversationId,
  autoStartVoiceRecording = false,
}: ChatInputProps) {
  const colors = useColors();
  const { authToken } = useAuth();
  const [text, setText] = useState("");
  const [isSendingText, setIsSendingText] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [pendingAudio, setPendingAudio] = useState<{
    uri: string;
    durationSeconds: number;
    mimeType: string;
  } | null>(null);
  const [pendingImage, setPendingImage] = useState<{
    uri: string;
    mimeType: string;
    width?: number;
    height?: number;
  } | null>(null);
  const [pendingVideo, setPendingVideo] = useState<{
    uri: string;
    mimeType: string;
    thumbnailUri: string;
    durationSeconds?: number;
  } | null>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const autoRecordStartedRef = useRef(false);

  const isUploading = uploadStatus !== null;

  const uploadPendingImage = async (image: NonNullable<typeof pendingImage>) => {
    if (!authToken || !conversationId) {
      throw new Error("Discussion indisponible pour l'envoi de la photo");
    }

    await runWithUploadStatus("de la photo", setUploadStatus, async (setPhase) => {
      setPhase("preparing");
      const target = await createMediaUploadTarget(authToken, {
        category: "chat-image",
        mimeType: image.mimeType,
        conversationId,
      });
      setPhase("uploading");
      await uploadFileToSignedUrl(target.uploadUrl, image.uri, image.mimeType);
      setPhase("finalizing");
      onSendImage?.({
        url: getDisplayMediaUrl(target.key, target.publicUrl),
        key: target.key,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
      });
    });
  };

  const uploadPendingVideo = async (video: NonNullable<typeof pendingVideo>) => {
    if (!authToken || !conversationId) {
      throw new Error("Discussion indisponible pour l'envoi de la vidéo");
    }

    const uploaded = await runWithUploadStatus("de la vidéo", setUploadStatus, async (setPhase) =>
      uploadChatVideoWithThumbnail(authToken, {
        videoUri: video.uri,
        videoMimeType: video.mimeType,
        conversationId,
        onPhase: setPhase,
      }),
    );

    onSendVideo?.({
      url: uploaded.url,
      key: uploaded.key,
      mimeType: uploaded.mimeType,
      durationSeconds: video.durationSeconds,
      thumbnailKey: uploaded.thumbnailKey,
      thumbnailUrl: uploaded.thumbnailUrl,
    });
  };

  const pickAttachment = async () => {
    if (!authToken || !conversationId) {
      setAudioError("Discussion indisponible pour l'envoi du média");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAudioError("Permission photothèque refusée");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;

    const isVideo = asset.type === "video";
    const mimeType = asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg");

    if (!isVideo) {
      setPendingImage({
        uri: asset.uri,
        mimeType,
        width: asset.width,
        height: asset.height,
      });
      return;
    }

    setAudioError(null);
    setIsPreparingPreview(true);
    try {
      const thumbnailUri = await generateVideoThumbnailUri(asset.uri);
      setPendingVideo({
        uri: asset.uri,
        mimeType,
        thumbnailUri,
        durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : undefined,
      });
    } catch (error) {
      setAudioError(
        error instanceof Error ? error.message : "Impossible de préparer l'aperçu vidéo",
      );
    } finally {
      setIsPreparingPreview(false);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSendingText) return;

    const emojiPayload = getEmoji3dPayloadFromContent(trimmed);
    if (emojiPayload && onSendEmoji3d && trimmed === emojiPayload.emoji) {
      setIsSendingText(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSendEmoji3d(emojiPayload);
      setText("");
      onTypingChange?.(false);
      setTimeout(() => setIsSendingText(false), 400);
      return;
    }

    setIsSendingText(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed);
    setText("");
    onTypingChange?.(false);
    setTimeout(() => setIsSendingText(false), 400);
  };

  const uploadRecordedAudio = async (recorded: {
    uri: string;
    durationSeconds: number;
    mimeType: string;
  }) => {
    if (!onSendAudio) return;
    if (!authToken) {
      throw new Error("Session audio indisponible");
    }

    await runWithUploadStatus("du vocal", setUploadStatus, async (setPhase) => {
      setPhase("preparing");
      const target = await createAudioUploadTarget(authToken, recorded.mimeType);
      setPhase("uploading");
      await uploadAudioToSignedUrl(target.uploadUrl, recorded.uri, recorded.mimeType);
      setPhase("finalizing");
      onSendAudio({
        url: getDisplayMediaUrl(target.key, target.publicUrl),
        key: target.key,
        durationSeconds: recorded.durationSeconds,
        mimeType: recorded.mimeType,
      });
    });
  };

  const toggleRecording = async () => {
    if (!onSendAudio) return;

    if (recorderState.isRecording) {
      try {
        setAudioError(null);
        await recorder.stop();
        const uri = recorder.uri;
        const durationSeconds = Math.max(1, recorder.currentTime || 0);

        if (!uri) {
          throw new Error("Enregistrement audio introuvable");
        }

        const mimeType = "audio/mp4";
        const recordedAudio = { uri, durationSeconds, mimeType };
        await uploadRecordedAudio(recordedAudio);
        setPendingAudio(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        const uri = recorder.uri;
        const durationSeconds = Math.max(1, recorder.currentTime || 0);
        if (uri) {
          setPendingAudio({ uri, durationSeconds, mimeType: "audio/mp4" });
        }
        setAudioError(
          error instanceof Error ? error.message : "Upload audio impossible pour le moment",
        );
      }
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setAudioError("Permission microphone refusée");
      return;
    }

    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    if (!autoStartVoiceRecording || autoRecordStartedRef.current || !onSendAudio) {
      return;
    }
    autoRecordStartedRef.current = true;
    const timer = setTimeout(() => {
      void (async () => {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setAudioError("Permission microphone refusée");
          return;
        }
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      })();
    }, 450);
    return () => clearTimeout(timer);
  }, [autoStartVoiceRecording, onSendAudio, recorder]);

  const recordingSeconds = Math.floor(recorderState.durationMillis / 1000);
  const recordingProgress = Math.min(recordingSeconds / 60, 1);

  return (
    <>
      <View style={[styles.container, { paddingBottom: bottomInset + 10 }]}>
        {uploadStatus ? (
          <View style={styles.uploadBannerWrap}>
            <UploadProgressBanner status={uploadStatus} />
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.circleBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => {
              void pickAttachment();
            }}
            disabled={isUploading || isPreparingPreview}
          >
            {isPreparingPreview ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Feather name="paperclip" size={20} color={colors.text} />
            )}
          </TouchableOpacity>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recorderState.isRecording ? (
              <View style={styles.recordingBlock}>
                <View style={styles.recordingRow}>
                  <View style={[styles.recordingDot, { backgroundColor: colors.destructive }]} />
                  <Text style={[styles.recordingText, { color: colors.text }]}>
                    Enregistrement... {recordingSeconds}s
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.destructive, width: `${recordingProgress * 100}%` },
                    ]}
                  />
                </View>
              </View>
            ) : (
            <View style={styles.idleBlock}>
              <View style={styles.textRow}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Message"
                  placeholderTextColor={colors.mutedForeground}
                  value={text}
                  onChangeText={(value) => {
                    setText(value);
                    onTypingChange?.(value.trim().length > 0);
                  }}
                  multiline
                  maxLength={2000}
                  returnKeyType="default"
                  editable={!isUploading}
                />
                <TouchableOpacity
                  style={styles.emojiBtn}
                  onPress={() => setEmojiPickerOpen(true)}
                  disabled={isUploading}
                  activeOpacity={0.75}
                >
                  <Ionicons name="happy-outline" size={22} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
                {isPreparingPreview ? (
                  <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
                    Préparation de l'aperçu vidéo...
                  </Text>
                ) : null}
                {audioError ? (
                  <View style={styles.retryRow}>
                    <Text style={[styles.helperText, { color: colors.destructive, flex: 1 }]}>
                      {audioError}
                    </Text>
                    {pendingAudio ? (
                      <TouchableOpacity
                        onPress={() => {
                          if (!pendingAudio) return;
                          setAudioError(null);
                          void uploadRecordedAudio(pendingAudio)
                            .then(() => {
                              setPendingAudio(null);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            })
                            .catch((error) => {
                              setAudioError(
                                error instanceof Error
                                  ? error.message
                                  : "Nouvel échec de l'envoi audio",
                              );
                            });
                        }}
                        activeOpacity={0.8}
                        disabled={isUploading}
                      >
                        <Text style={[styles.retryText, { color: colors.primary }]}>Réessayer</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )}
          </View>
          {text.trim().length > 0 ? (
            <TouchableOpacity
              style={[
                styles.circleBtn,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: isSendingText ? 0.7 : 1 },
              ]}
              onPress={handleSend}
              activeOpacity={0.85}
              disabled={isSendingText || isUploading}
            >
              <Ionicons name="send" size={18} color={colors.primary} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.circleBtn,
                recorderState.isRecording && styles.circleBtnRecording,
                {
                  backgroundColor: colors.card,
                  borderColor: recorderState.isRecording ? colors.destructive : colors.border,
                  opacity: isUploading ? 0.7 : 1,
                },
              ]}
              activeOpacity={0.85}
              onPress={() => {
                void toggleRecording();
              }}
              disabled={isUploading}
            >
              <Feather
                name={recorderState.isRecording ? "stop-circle" : "mic"}
                size={20}
                color={recorderState.isRecording ? colors.destructive : colors.text}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={Boolean(pendingImage)}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (!isUploading) setPendingImage(null);
        }}
      >
        <View style={[styles.previewRoot, { backgroundColor: colors.background }]}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              style={styles.previewIconBtn}
              onPress={() => setPendingImage(null)}
              disabled={isUploading}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.previewTitle, { color: colors.text }]}>Aperçu photo</Text>
            <View style={styles.previewIconBtn} />
          </View>

          {pendingImage ? (
            <Image
              source={{ uri: pendingImage.uri }}
              style={styles.previewImage}
              contentFit="contain"
            />
          ) : null}

          {uploadStatus ? (
            <View style={styles.previewUploadWrap}>
              <UploadProgressBanner status={uploadStatus} />
            </View>
          ) : null}

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.previewSecondaryBtn, { borderColor: colors.border }]}
              onPress={() => setPendingImage(null)}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              <Text style={[styles.previewSecondaryText, { color: colors.text }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewSendBtn, { backgroundColor: colors.primary, opacity: isUploading ? 0.75 : 1 }]}
              disabled={!pendingImage || isUploading}
              onPress={() => {
                if (!pendingImage) return;
                setAudioError(null);
                void uploadPendingImage(pendingImage)
                  .then(() => {
                    setPendingImage(null);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  })
                  .catch((error) => {
                    setAudioError(
                      error instanceof Error ? error.message : "Impossible d'envoyer la photo",
                    );
                  });
              }}
              activeOpacity={0.85}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.previewSendText}>Envoyer</Text>
                  <Ionicons name="send" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(pendingVideo)}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (!isUploading) setPendingVideo(null);
        }}
      >
        <View style={[styles.previewRoot, { backgroundColor: colors.background }]}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              style={styles.previewIconBtn}
              onPress={() => setPendingVideo(null)}
              disabled={isUploading}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.previewTitle, { color: colors.text }]}>Aperçu vidéo</Text>
            <View style={styles.previewIconBtn} />
          </View>

          {pendingVideo ? (
            <View style={styles.videoPreviewWrap}>
              <Image
                source={{ uri: pendingVideo.thumbnailUri }}
                style={styles.previewImage}
                contentFit="contain"
              />
              <View style={styles.videoPreviewOverlay}>
                <Ionicons name="play-circle" size={64} color="#fff" />
                {pendingVideo.durationSeconds ? (
                  <Text style={styles.videoPreviewDuration}>
                    {Math.floor(pendingVideo.durationSeconds / 60)}:
                    {(pendingVideo.durationSeconds % 60).toString().padStart(2, "0")}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {uploadStatus ? (
            <View style={styles.previewUploadWrap}>
              <UploadProgressBanner status={uploadStatus} />
            </View>
          ) : null}

          <View style={styles.previewActions}>
            <TouchableOpacity
              style={[styles.previewSecondaryBtn, { borderColor: colors.border }]}
              onPress={() => setPendingVideo(null)}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              <Text style={[styles.previewSecondaryText, { color: colors.text }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewSendBtn, { backgroundColor: colors.primary, opacity: isUploading ? 0.75 : 1 }]}
              disabled={!pendingVideo || isUploading}
              onPress={() => {
                if (!pendingVideo) return;
                setAudioError(null);
                void uploadPendingVideo(pendingVideo)
                  .then(() => {
                    setPendingVideo(null);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  })
                  .catch((error) => {
                    setAudioError(
                      error instanceof Error ? error.message : "Impossible d'envoyer la vidéo",
                    );
                  });
              }}
              activeOpacity={0.85}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.previewSendText}>Envoyer</Text>
                  <Ionicons name="send" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <EmojiPickerSheet
        visible={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        onSelect={(emoji) => {
          const payload: Emoji3dMessagePayload = {
            kind: "emoji3d",
            id: emoji.id,
            emoji: emoji.emoji,
            imageUrl: getChatEmoji3dImageUrl(emoji),
            fluentName: emoji.fluentName,
            assetPath: emoji.assetPath,
            label: emoji.label,
          };
          if (onSendEmoji3d) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSendEmoji3d(payload);
            setEmojiPickerOpen(false);
            return;
          }
          setText((current) => `${current}${emoji.emoji}`);
          onTypingChange?.(true);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingTop: 6,
    gap: 8,
    backgroundColor: "transparent",
  },
  uploadBannerWrap: {
    width: "100%",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  circleBtnRecording: {},
  inputWrap: {
    flex: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    maxHeight: 100,
    paddingVertical: 0,
  },
  recordingRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingBlock: {
    gap: 8,
  },
  idleBlock: {
    gap: 4,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  emojiBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recordingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  helperText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  retryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  retryText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  previewRoot: {
    flex: 1,
  },
  previewHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 18 : 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewIconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  previewTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  previewImage: {
    flex: 1,
    width: "100%",
  },
  videoPreviewWrap: {
    flex: 1,
    position: "relative",
  },
  videoPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    gap: 8,
  },
  videoPreviewDuration: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  previewUploadWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
  },
  previewSecondaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  previewSecondaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  previewSendBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  previewSendText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
