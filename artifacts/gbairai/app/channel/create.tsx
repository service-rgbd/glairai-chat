import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthToken } from "@/hooks/useAuthToken";
import {
  ChannelCategoryPicker,
  ChannelFormField,
  ChannelHeroCard,
  ChannelPrimaryButton,
  ChannelScreenHeader,
  ChannelSection,
} from "@/modules/channels/components/ChannelFormUi";
import { useChannels } from "@/modules/channels/context/ChannelsContext";
import { uploadChannelImage } from "@/modules/channels/lib/upload-image";
import { isLikelyNetworkError } from "@/lib/app-network";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = ["Organisations", "Sport", "Style De Vie", "Divertissement"];

export default function CreateChannelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const authToken = useAuthToken();
  const { createNewChannel, refreshDiscovery } = useChannels();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Autorisez l'accès à la galerie pour ajouter une photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const asset = result.assets[0];
    setAvatarPreview(asset.uri);
    setError(null);

    if (!authToken) {
      setAvatarUri(asset.uri);
      return;
    }

    setUploadingAvatar(true);
    try {
      const uploadedUrl = await uploadChannelImage(
        authToken,
        asset.uri,
        asset.mimeType ?? "image/jpeg",
        "avatar",
        asset.assetId,
      );
      setAvatarUri(uploadedUrl);
    } catch (uploadError) {
      setAvatarPreview(null);
      setAvatarUri(null);
      setError(
        isLikelyNetworkError(uploadError)
          ? "Connexion insuffisante pour envoyer la photo. Réessayez avec un meilleur réseau."
          : uploadError instanceof Error
            ? uploadError.message
            : "Impossible d'envoyer la photo",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCreate = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = await createNewChannel({
        name,
        description,
        category,
        avatarUrl: avatarUri ?? undefined,
      });
      await refreshDiscovery();
      router.replace(`/channel/${result.channel.id}`);
    } catch (createError) {
      setError(
        isLikelyNetworkError(createError)
          ? "Impossible de créer la chaîne sans connexion internet."
          : createError instanceof Error
            ? createError.message
            : "Impossible de créer la chaîne",
      );
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = avatarPreview ?? avatarUri;
  const isBusy = saving || uploadingAvatar;
  const canCreate = name.trim().length >= 2 && !isBusy;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ChannelScreenHeader
        title="Nouvelle chaîne"
        topPad={topPad}
        backIcon="close"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <ChannelHeroCard
          badge="Chaînes Gbairai"
          title="Créez votre espace"
          subtitle="Publiez des annonces, développez votre audience et gérez votre chaîne comme sur Telegram."
        />

        <ChannelSection title="Identité visuelle">
          <TouchableOpacity
            style={styles.avatarRow}
            onPress={() => void pickAvatar()}
            activeOpacity={0.85}
            disabled={isBusy}
          >
            <View style={styles.avatarShell}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <LinearGradient colors={["#6D4AFF", "#00D4A4"]} style={styles.avatar}>
                  <Ionicons name="camera" size={28} color="#fff" />
                </LinearGradient>
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
            <View style={styles.avatarCopy}>
              <Text style={[styles.avatarTitle, { color: colors.text }]}>Photo de la chaîne</Text>
              <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
                Format carré recommandé · visible par tous les abonnés
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </ChannelSection>

        <ChannelSection title="Informations">
          <ChannelFormField
            label="Nom de la chaîne"
            value={name}
            onChangeText={setName}
            placeholder="Ex. Gbairai Sport"
            maxLength={64}
            hint="Choisissez un nom clair et mémorable."
          />
          <ChannelFormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Présentez votre chaîne en quelques lignes"
            multiline
            maxLength={280}
            hint="Cette description apparaît sur la fiche publique de votre chaîne."
          />
        </ChannelSection>

        <ChannelSection title="Catégorie">
          <ChannelCategoryPicker categories={CATEGORIES} value={category} onChange={setCategory} />
        </ChannelSection>

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: `${colors.destructive}12`, borderColor: `${colors.destructive}33` }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}

        <ChannelPrimaryButton
          label="Créer la chaîne"
          onPress={() => void handleCreate()}
          loading={saving}
          disabled={!canCreate}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 16,
    gap: 18,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarShell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCopy: {
    flex: 1,
    gap: 4,
  },
  avatarTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  avatarHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  errorCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
});
