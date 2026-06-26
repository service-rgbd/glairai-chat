import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafeKeyboardAvoidingView as KeyboardAvoidingView } from "@/components/SafeKeyboardAvoidingView";
import { MediaUploadOverlay } from "@/components/MediaUploadOverlay";
import type { UploadStatus } from "@/lib/upload-status";

interface StoryMediaComposerProps {
  visible: boolean;
  type: "image" | "video";
  mediaUri: string;
  previewThumbnailUri?: string | null;
  caption: string;
  isPublishing?: boolean;
  publishStatus?: UploadStatus | null;
  onClose: () => void;
  onCaptionChange: (value: string) => void;
  onPublish: () => void;
}

export function StoryMediaComposer({
  visible,
  type,
  mediaUri,
  previewThumbnailUri,
  caption,
  isPublishing = false,
  publishStatus = null,
  onClose,
  onCaptionChange,
  onPublish,
}: StoryMediaComposerProps) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const canPublish = Boolean(mediaUri) && !isPublishing;
  const previewUri = type === "video" ? previewThumbnailUri ?? mediaUri : mediaUri;
  const captionBottomPadding = keyboardHeight > 0 ? keyboardHeight + 12 : bottomPad + 12;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <MediaUploadOverlay status={publishStatus} style={StyleSheet.absoluteFillObject}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.fallbackBg]} />
          )}

          {type === "video" && !publishStatus ? (
            <View style={styles.videoBadge}>
              <Ionicons name="play" size={22} color="#fff" />
            </View>
          ) : null}
        </MediaUploadOverlay>

        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          style={[styles.topGradient, { paddingTop: topPad + 8 }]}
        >
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.publishBtn, !canPublish && styles.publishBtnDisabled]}
            onPress={onPublish}
            disabled={!canPublish}
            activeOpacity={0.85}
          >
            {isPublishing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.publishText}>Publier</Text>
            )}
          </TouchableOpacity>
        </LinearGradient>

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.72)"]}
          style={[styles.bottomGradient, { paddingBottom: captionBottomPadding }]}
        >
          <TextInput
            style={styles.captionInput}
            placeholder="Ajouter une légende…"
            placeholderTextColor="rgba(255,255,255,0.55)"
            multiline
            maxLength={700}
            value={caption}
            onChangeText={onCaptionChange}
          />
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  fallbackBg: {
    backgroundColor: "#111827",
  },
  videoBadge: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  publishBtn: {
    minWidth: 92,
    height: 40,
    borderRadius: 999,
    paddingHorizontal: 18,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  publishBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  publishText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 28,
    paddingHorizontal: 16,
    gap: 10,
  },
  captionInput: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    minHeight: 44,
    maxHeight: 120,
    textAlignVertical: "top",
  },
});
