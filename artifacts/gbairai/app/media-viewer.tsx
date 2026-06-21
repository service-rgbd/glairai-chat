import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChats } from "@/contexts/chats-context-ref";
import { useViewOnceScreenshotGuard } from "@/hooks/useViewOnceScreenshotGuard";
import { useColors } from "@/hooks/useColors";

type MediaType = "image" | "video";

const extensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
};

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function numberParam(value: string | string[] | undefined) {
  const parsed = Number(singleParam(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getFileExtension(url: string, mimeType: string, type: MediaType) {
  const fromMime = extensionByMime[mimeType.toLowerCase()];
  if (fromMime) return fromMime;

  const cleanUrl = url.split("?")[0] ?? "";
  const match = cleanUrl.match(/\.(jpg|jpeg|png|webp|mp4|mov)$/i);
  if (match?.[0]) return match[0].toLowerCase();

  return type === "image" ? ".jpg" : ".mp4";
}

export default function MediaViewerScreen() {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sendImageMessage, sendVideoMessage, consumeViewOnceMessage, reportViewOnceScreenshot } =
    useChats();
  const [isSaving, setIsSaving] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const consumedRef = useRef(false);

  const type = singleParam(params.type) === "video" ? "video" : "image";
  const chatId = singleParam(params.chatId) ?? "";
  const messageId = singleParam(params.messageId) ?? "";
  const isViewOnceMode = singleParam(params.viewOnce) === "1";
  const consumeOnClose = singleParam(params.consumeOnClose) === "1";
  const url = singleParam(params.url) ?? "";
  const key = singleParam(params.key) ?? "";
  const mimeType = singleParam(params.mimeType) ?? (type === "image" ? "image/jpeg" : "video/mp4");
  const width = numberParam(params.width);
  const height = numberParam(params.height);
  const durationSeconds = numberParam(params.durationSeconds);
  const title = isViewOnceMode ? "Photo à vue unique" : type === "image" ? "Photo" : "Vidéo";

  const finishViewOnce = useCallback(() => {
    if (!consumeOnClose || !messageId || !chatId || consumedRef.current) {
      return;
    }
    consumedRef.current = true;
    void consumeViewOnceMessage(chatId, messageId);
  }, [chatId, consumeOnClose, consumeViewOnceMessage, messageId]);

  const handleClose = useCallback(() => {
    finishViewOnce();
    router.back();
  }, [finishViewOnce]);

  const handleScreenshotConfirm = useCallback(() => {
    if (!messageId || !chatId) return;
    void reportViewOnceScreenshot(chatId, messageId);
  }, [chatId, messageId, reportViewOnceScreenshot]);

  useViewOnceScreenshotGuard({
    enabled: isViewOnceMode && consumeOnClose,
    onConfirmScreenshot: handleScreenshotConfirm,
  });

  useEffect(() => {
    if (!consumeOnClose) return;

    const unsubscribe = navigation.addListener("beforeRemove", () => {
      finishViewOnce();
    });

    return unsubscribe;
  }, [consumeOnClose, finishViewOnce, navigation]);

  useEffect(() => {
    if (!consumeOnClose || Platform.OS !== "android") return;

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });

    return () => subscription.remove();
  }, [consumeOnClose, handleClose]);

  const imageAspectRatio = useMemo(() => {
    if (!width || !height) return 1;
    return Math.max(0.45, Math.min(width / height, 2.2));
  }, [height, width]);

  const player = useVideoPlayer(type === "video" ? url : "", (instance) => {
    instance.loop = false;
  });

  const saveMedia = async () => {
    if (isViewOnceMode) {
      Alert.alert("Action impossible", "Les médias à vue unique ne peuvent pas être enregistrés.");
      return;
    }
    if (!url) return;
    if (Platform.OS === "web") {
      Alert.alert("Enregistrement", "L'enregistrement dans la galerie est disponible sur mobile.");
      return;
    }

    setIsSaving(true);
    try {
      const permissionType = type === "image" ? "photo" : "video";
      const existingPermission = await MediaLibrary.getPermissionsAsync(true, [permissionType]);
      const permission =
        existingPermission.status === "granted"
          ? existingPermission
          : await MediaLibrary.requestPermissionsAsync(true, [permissionType]);

      if (permission.status !== "granted") {
        Alert.alert("Permission requise", "Autorisez l'accès à la galerie pour enregistrer ce média.");
        return;
      }

      const extension = getFileExtension(url, mimeType, type);
      const destination = new File(Paths.cache, `gbairai_${Date.now()}${extension}`);
      const downloadedFile = await File.downloadFileAsync(url, destination, { idempotent: true });
      await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);
      Alert.alert("Média enregistré", `${title} enregistrée dans votre galerie.`);
    } catch (error) {
      Alert.alert(
        "Échec de l'enregistrement",
        error instanceof Error ? error.message : "Impossible d'enregistrer ce média.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resendMedia = () => {
    if (isViewOnceMode) {
      Alert.alert("Action impossible", "Les médias à vue unique ne peuvent pas être renvoyés.");
      return;
    }
    if (!chatId || !key || !url) return;
    setIsResending(true);
    try {
      if (type === "image") {
        sendImageMessage(chatId, { url, key, mimeType, width, height });
      } else {
        sendVideoMessage(chatId, { url, key, mimeType, durationSeconds });
      }
      Alert.alert("Média renvoyé", `${title} renvoyée dans la conversation.`);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconButton} onPress={handleClose} activeOpacity={0.75}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.previewArea}>
        {type === "image" ? (
          <Image source={{ uri: url }} style={[styles.image, { aspectRatio: imageAspectRatio }]} contentFit="contain" />
        ) : (
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls
            fullscreenOptions={{ enabled: true }}
          />
        )}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + 18 }]}>
        {isViewOnceMode ? (
          <Text style={styles.viewOnceHint}>
            {consumeOnClose
              ? "Ce média disparaîtra à la fermeture. L'enregistrement est désactivé."
              : "Aperçu à vue unique. L'enregistrement est désactivé."}
          </Text>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: "rgba(255,255,255,0.22)" }]}
              onPress={saveMedia}
              disabled={isSaving || !url}
              activeOpacity={0.82}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={21} color="#fff" />
              )}
              <Text style={styles.actionText}>Enregistrer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={resendMedia}
              disabled={isResending || !chatId || !key || !url}
              activeOpacity={0.82}
            >
              {isResending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="send-outline" size={20} color="#fff" />
              )}
              <Text style={styles.actionText}>Renvoyer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    height: 88,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  previewArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    maxHeight: "100%",
  },
  video: {
    width: "100%",
    height: "72%",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  primaryButton: {
    borderWidth: 0,
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  viewOnceHint: {
    flex: 1,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
