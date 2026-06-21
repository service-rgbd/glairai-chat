import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { prepareLocalMediaUriForUpload } from "@/lib/media";

type PickerTab = "photos" | "albums";
type QuickAction = "text" | "composition" | "voice" | "ai";

type GalleryAsset = {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
  filename: string;
};

type GridItem =
  | { id: string; kind: "camera" }
  | (GalleryAsset & { kind: "asset" });

interface StoryMediaPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectText: () => void;
  onSelectAsset: (payload: {
    uri: string;
    mediaType: "image" | "video";
    mimeType: string | null;
    assetId?: string | null;
  }) => void;
}

const GRID_GAP = 2;
const GRID_COLUMNS = 3;
const STORY_ACTION_GREEN = "#25D366";

export function StoryMediaPickerModal({
  visible,
  onClose,
  onSelectText,
  onSelectAsset,
}: StoryMediaPickerModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [tab, setTab] = useState<PickerTab>("photos");
  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [preparingAssetId, setPreparingAssetId] = useState<string | null>(null);
  const [assets, setAssets] = useState<GalleryAsset[]>([]);

  const cellSize = useMemo(() => {
    const width = Dimensions.get("window").width;
    return Math.floor((width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  }, []);

  const loadAssets = useCallback(async () => {
    setLoadingAssets(true);
    try {
      const response = await MediaLibrary.getAssetsAsync({
        first: 120,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [MediaLibrary.SortBy.creationTime],
      });

      const mapped = response.assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        mediaType: asset.mediaType === MediaLibrary.MediaType.video ? ("video" as const) : ("photo" as const),
        filename: asset.filename,
      }));
      setAssets(mapped);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  const refreshPermission = useCallback(async () => {
    const current = await MediaLibrary.getPermissionsAsync();
    setPermission(current);
    if (current.granted) {
      await loadAssets();
    } else {
      setAssets([]);
    }
  }, [loadAssets]);

  useEffect(() => {
    if (!visible) {
      setTab("photos");
      return;
    }
    void refreshPermission();
  }, [refreshPermission, visible]);

  const requestPermission = async () => {
    const response = await MediaLibrary.requestPermissionsAsync();
    setPermission(response);
    if (response.granted) {
      await loadAssets();
    }
  };

  const openSettings = () => {
    void Linking.openSettings();
  };

  const ensureGalleryPermission = async () => {
    if (permission?.granted) return true;
    const response = await MediaLibrary.requestPermissionsAsync();
    setPermission(response);
    if (response.granted) {
      await loadAssets();
    }
    return response.granted;
  };

  const selectPreparedAsset = async (input: {
    uri: string;
    mediaType: "image" | "video";
    mimeType: string;
    assetId?: string | null;
  }) => {
    const uri =
      Platform.OS === "ios"
        ? await prepareLocalMediaUriForUpload(input.uri, input.mimeType, input.assetId)
        : input.uri;
    onSelectAsset({
      uri,
      mediaType: input.mediaType,
      mimeType: input.mimeType,
      assetId: input.assetId,
    });
  };

  const pickFromLibrary = async (mediaTypes: ImagePicker.MediaType[]) => {
    const granted = await ensureGalleryPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: mediaTypes.includes("images") && mediaTypes.length === 1,
      quality: 0.85,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    const asset = result.assets[0];
    const mediaType = asset.type === "video" ? "video" : "image";
    const mimeType = asset.mimeType ?? (mediaType === "video" ? "video/mp4" : "image/jpeg");
    try {
      await selectPreparedAsset({
        uri: asset.uri,
        mediaType,
        mimeType,
        assetId: asset.assetId,
      });
    } catch (error) {
      Alert.alert(
        "Impossible d'ouvrir ce média",
        error instanceof Error ? error.message : "Réessayez avec un autre fichier.",
      );
    }
  };

  const handleQuickAction = async (action: QuickAction) => {
    if (action === "text") {
      onSelectText();
      return;
    }

    if (action === "composition") {
      await pickFromLibrary(["images"]);
      return;
    }

    if (action === "voice") {
      Alert.alert("Statut vocal", "Cette fonctionnalité arrive bientôt.");
      return;
    }

    if (action === "ai") {
      Alert.alert("Images d'IA", "Cette fonctionnalité arrive bientôt.");
    }
  };

  const handleCameraPress = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      Alert.alert(
        "Accès à la caméra",
        "Autorisez Gbairai à utiliser la caméra pour capturer un statut.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Réglages", onPress: openSettings },
        ],
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    const asset = result.assets[0];
    const mediaType = asset.type === "video" ? "video" : "image";
    const mimeType = asset.mimeType ?? (mediaType === "video" ? "video/mp4" : "image/jpeg");
    try {
      await selectPreparedAsset({
        uri: asset.uri,
        mediaType,
        mimeType,
        assetId: asset.assetId,
      });
    } catch (error) {
      Alert.alert(
        "Impossible d'utiliser ce média",
        error instanceof Error ? error.message : "Réessayez.",
      );
    }
  };

  const handleGalleryPress = async (item: GalleryAsset) => {
    const mimeType = item.mediaType === "video" ? "video/mp4" : "image/jpeg";
    setPreparingAssetId(item.id);
    try {
      const info = await MediaLibrary.getAssetInfoAsync(item.id, {
        shouldDownloadFromNetwork: true,
      });
      await selectPreparedAsset({
        uri: info.localUri ?? item.uri,
        mediaType: item.mediaType === "video" ? "video" : "image",
        mimeType,
        assetId: item.id,
      });
    } catch (error) {
      Alert.alert(
        "Impossible d'ouvrir ce média",
        error instanceof Error ? error.message : "Réessayez avec un autre fichier.",
      );
    } finally {
      setPreparingAssetId(null);
    }
  };

  const quickActions: { key: QuickAction; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "text", label: "Texte", icon: "text" },
    { key: "composition", label: "Composition", icon: "grid" },
    { key: "voice", label: "Vocal", icon: "mic" },
    { key: "ai", label: "Images d'IA", icon: "sparkles" },
  ];

  const gridData = useMemo<GridItem[]>(
    () => [{ id: "__camera__", kind: "camera" }, ...assets.map((asset) => ({ ...asset, kind: "asset" as const }))],
    [assets],
  );

  const renderPermissionGate = () => (
    <View style={styles.permissionBlock}>
      <View style={[styles.permissionIconWrap, { backgroundColor: `${STORY_ACTION_GREEN}14` }]}>
        <Ionicons name="images-outline" size={36} color={STORY_ACTION_GREEN} />
      </View>
      <Text style={[styles.permissionTitle, { color: colors.text }]}>Accès à vos photos</Text>
      <Text style={[styles.permissionBody, { color: colors.mutedForeground }]}>
        Gbairai a besoin de votre autorisation pour afficher vos photos et vidéos et vous permettre de publier un statut.
      </Text>
      <TouchableOpacity
        style={[styles.permissionBtn, { backgroundColor: STORY_ACTION_GREEN }]}
        onPress={() => void requestPermission()}
        activeOpacity={0.85}
      >
        <Text style={styles.permissionBtnText}>Continuer</Text>
      </TouchableOpacity>
      {permission?.status === "denied" && !permission.canAskAgain ? (
        <TouchableOpacity onPress={openSettings} activeOpacity={0.75}>
          <Text style={[styles.permissionLink, { color: STORY_ACTION_GREEN }]}>Ouvrir les réglages</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderGallery = () => {
    if (loadingAssets) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={STORY_ACTION_GREEN} />
        </View>
      );
    }

    return (
      <FlatList
        data={gridData}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={{ gap: GRID_GAP }}
        contentContainerStyle={{ paddingBottom: bottomPad + 16, gap: GRID_GAP }}
        renderItem={({ item }) => {
          if (item.kind === "camera") {
            return (
              <TouchableOpacity
                style={[
                  styles.gridCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => void handleCameraPress()}
                activeOpacity={0.82}
              >
                <Ionicons name="camera" size={28} color={colors.text} />
                <Text style={[styles.cameraLabel, { color: colors.text }]}>Caméra</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              style={[styles.gridCell, { width: cellSize, height: cellSize }]}
              onPress={() => void handleGalleryPress(item)}
              activeOpacity={0.88}
              disabled={preparingAssetId === item.id}
            >
              <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
              {preparingAssetId === item.id ? (
                <View style={styles.preparingOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
              {item.mediaType === "video" ? (
                <View style={styles.videoBadge}>
                  <Ionicons name="play" size={14} color="#fff" />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={[styles.tabSwitch, { backgroundColor: colors.muted }]}>
            {(["photos", "albums"] as const).map((value) => {
              const active = tab === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.tabBtn, active && { backgroundColor: colors.card }]}
                  onPress={() => setTab(value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, { color: active ? colors.text : colors.mutedForeground }]}>
                    {value === "photos" ? "Photos" : "Albums"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.quickRow}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[styles.quickTile, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => void handleQuickAction(action.key)}
              activeOpacity={0.82}
            >
              <Ionicons name={action.icon} size={26} color={STORY_ACTION_GREEN} />
              <Text style={[styles.quickLabel, { color: colors.text }]} numberOfLines={1}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.galleryArea}>
          {tab === "albums" ? (
            <View style={styles.albumsPlaceholder}>
              <Text style={[styles.albumsText, { color: colors.mutedForeground }]}>
                Les albums arrivent bientôt. Utilisez l&apos;onglet Photos pour le moment.
              </Text>
            </View>
          ) : !permission?.granted ? (
            renderPermissionGate()
          ) : (
            renderGallery()
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  tabSwitch: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  headerSpacer: { width: 40 },
  quickRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  quickTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    alignItems: "center",
    gap: 8,
    minHeight: 88,
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  galleryArea: {
    flex: 1,
  },
  permissionBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  permissionIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  permissionBody: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  permissionBtn: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  permissionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  permissionLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  albumsPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  albumsText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  gridCell: {
    borderRadius: 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  cameraLabel: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  videoBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  preparingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
