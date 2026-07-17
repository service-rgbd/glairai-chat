import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  createMediaUploadTarget,
  getUploadDisplayUrl,
  uploadFileToSignedUrl,
} from "@/lib/media";

interface ProfileEditorProps {
  name: string;
  bio: string;
  avatar: string | null;
  loading?: boolean;
  submitLabel: string;
  onChangeName: (value: string) => void;
  onChangeBio: (value: string) => void;
  onChangeAvatar: (value: string | null) => void;
  onSubmit: () => void;
}

export function ProfileEditor({
  name,
  bio,
  avatar,
  loading,
  submitLabel,
  onChangeName,
  onChangeBio,
  onChangeAvatar,
  onSubmit,
}: ProfileEditorProps) {
  const colors = useColors();
  const { authToken } = useAuth();

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const localUri = asset?.uri ?? null;
      if (!localUri) {
        onChangeAvatar(null);
        return;
      }

      if (!authToken) {
        onChangeAvatar(localUri);
        return;
      }

      const mimeType = asset?.mimeType ?? "image/jpeg";
      const target = await createMediaUploadTarget(authToken, {
        category: "avatar",
        mimeType,
      });
      await uploadFileToSignedUrl(target.uploadUrl, localUri, mimeType);
      const resolvedUrl = await getUploadDisplayUrl(authToken, target.key, target.publicUrl);
      onChangeAvatar(resolvedUrl);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.avatarSection}
        onPress={pickImage}
        activeOpacity={0.8}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={["#6D4AFF", "#00D4A4"]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarPlaceholder}>Photo</Text>
          </LinearGradient>
        )}
        <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.cameraIcon}>+</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.fields}>
        <View style={styles.fieldWrap}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Nom complet *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            placeholder="Votre nom"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={onChangeName}
            maxLength={50}
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Bio
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.bioInput,
              {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            placeholder="À propos de vous..."
            placeholderTextColor={colors.mutedForeground}
            value={bio}
            onChangeText={onChangeBio}
            maxLength={120}
            multiline
          />
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.btn,
          { backgroundColor: name.trim() ? colors.primary : colors.muted },
        ]}
        onPress={onSubmit}
        disabled={!name.trim() || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text
            style={[
              styles.btnText,
              { color: name.trim() ? "#fff" : colors.mutedForeground },
            ]}
          >
            {submitLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  avatarSection: {
    alignSelf: "center",
    position: "relative",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholder: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIcon: {
    fontSize: 22,
    lineHeight: 22,
    color: "#fff",
    marginTop: -2,
  },
  fields: { gap: 16 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingVertical: 12,
  },
  bioInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  btn: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  btnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});

