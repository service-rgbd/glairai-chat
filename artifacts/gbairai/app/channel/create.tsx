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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useChannels } from "@/modules/channels/context/ChannelsContext";
import { uploadChannelImage } from "@/modules/channels/lib/upload-image";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = ["Organisations", "Sport", "Style De Vie", "Divertissement"];

export default function CreateChannelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authToken } = useAuth();
  const { createNewChannel, refreshDiscovery } = useChannels();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
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
      );
      setAvatarUri(uploadedUrl);
    } catch (uploadError) {
      setAvatarPreview(null);
      setAvatarUri(null);
      setError(
        uploadError instanceof Error ? uploadError.message : "Impossible d'envoyer la photo",
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
      setError(createError instanceof Error ? createError.message : "Impossible de créer la chaîne");
    } finally {
      setSaving(false);
    }
  };

  const displayAvatar = avatarPreview ?? avatarUri;
  const isBusy = saving || uploadingAvatar;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Nouvelle chaîne</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 24, gap: 16 }}>
        <TouchableOpacity
          style={styles.avatarSection}
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
          <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
            Photo de la chaîne
          </Text>
        </TouchableOpacity>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Nom</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ma chaîne"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez votre chaîne"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.input,
              styles.textArea,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Catégorie</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((item) => {
              const active = category === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setCategory(item)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: active ? "#fff" : colors.text, fontFamily: "Inter_500Medium" }}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary, opacity: isBusy ? 0.75 : 1 }]}
          onPress={() => void handleCreate()}
          disabled={isBusy || name.trim().length < 2}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createText}>Créer la chaîne</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  avatarSection: { alignItems: "center", gap: 10, paddingVertical: 8 },
  avatarShell: {
    width: 108,
    height: 108,
    borderRadius: 54,
    overflow: "hidden",
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  error: { fontSize: 13, fontFamily: "Inter_400Regular" },
  createBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  createText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
