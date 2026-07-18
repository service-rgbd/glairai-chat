import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import {
  SettingsPrimaryButton,
  SettingsScreenShell,
  SettingsSecondaryButton,
} from "@/components/settings/SettingsUi";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthToken } from "@/hooks/useAuthToken";
import { useColors } from "@/hooks/useColors";
import {
  isLocalProfilePhotoUri,
  pickProfilePhotoFromLibrary,
  takeProfilePhotoWithCamera,
  uploadProfilePhoto,
} from "@/lib/profile-photo";

export default function SettingsPhotoScreen() {
  const colors = useColors();
  const { currentUser, updateProfile } = useAuth();
  const authToken = useAuthToken();
  const [avatar, setAvatar] = useState<string | null>(currentUser?.avatar ?? null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const initials = useMemo(
    () => (currentUser?.name ?? "U").slice(0, 2).toUpperCase(),
    [currentUser?.name],
  );

  useEffect(() => {
    setAvatar(currentUser?.avatar ?? null);
    setDirty(false);
  }, [currentUser?.avatar]);

  const applyLocalPhoto = async (picker: () => Promise<{ ok: boolean; asset?: { uri: string; mimeType?: string | null }; reason?: string }>) => {
    const result = await picker();
    if (!result.ok) {
      if (result.reason === "permission") {
        Alert.alert("Autorisation requise", "Autorisez l'accès à la photothèque ou à la caméra dans les réglages du téléphone.");
      }
      return;
    }

    const localUri = result.asset?.uri;
    if (!localUri) return;

    setAvatar(localUri);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      let nextAvatar = avatar;
      if (dirty && avatar && isLocalProfilePhotoUri(avatar) && authToken) {
        nextAvatar = await uploadProfilePhoto(authToken, avatar);
      }
      await updateProfile({ avatar: nextAvatar });
      setDirty(false);
      router.back();
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer la photo de profil.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    Alert.alert("Supprimer la photo", "Votre photo de profil sera retirée.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          setAvatar(null);
          setDirty(true);
        },
      },
    ]);
  };

  return (
    <SettingsScreenShell
      title="Photo de profil"
      footer={
        <SettingsPrimaryButton
          label="Enregistrer"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={!dirty}
        />
      }
    >
      <View style={styles.previewWrap}>
        <Avatar uri={avatar} initials={initials} color="#FF6B35" size={148} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => void applyLocalPhoto(takeProfilePhotoWithCamera)}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionTitle, { color: colors.text }]}>Prendre une photo</Text>
          <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>Ouvrir l'appareil photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => void applyLocalPhoto(pickProfilePhotoFromLibrary)}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionTitle, { color: colors.text }]}>Choisir dans la galerie</Text>
          <Text style={[styles.actionHint, { color: colors.mutedForeground }]}>Recadrage carré automatique</Text>
        </TouchableOpacity>
      </View>

      {avatar ? <SettingsSecondaryButton label="Supprimer la photo" onPress={handleRemove} destructive /> : null}
    </SettingsScreenShell>
  );
}

const styles = StyleSheet.create({
  previewWrap: {
    alignItems: "center",
    paddingVertical: 16,
  },
  actions: { gap: 10 },
  actionBtn: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  actionHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
