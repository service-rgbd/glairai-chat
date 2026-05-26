import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setupProfile } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled) setAvatar(res.assets[0].uri);
  };

  const handleFinish = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await setupProfile(name.trim(), avatar, bio.trim());
    setLoading(false);
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.content, { paddingTop: topPad + 20, paddingBottom: bottomPad + 24 }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Votre profil</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Ajoutez votre nom et une photo pour que vos contacts puissent vous reconnaître.
          </Text>
        </View>

        <TouchableOpacity style={styles.avatarSection} onPress={pickImage} activeOpacity={0.8}>
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
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.fields}>
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Nom complet *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="Votre nom"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              maxLength={50}
              autoFocus
            />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Bio (optionnel)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="À propos de vous..."
              placeholderTextColor={colors.mutedForeground}
              value={bio}
              onChangeText={setBio}
              maxLength={100}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: name.trim() ? colors.primary : colors.muted }]}
          onPress={handleFinish}
          disabled={!name.trim() || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: name.trim() ? "#fff" : colors.mutedForeground }]}>
              Terminer
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 28,
  },
  header: { gap: 10 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
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
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIcon: { fontSize: 16 },
  fields: { gap: 16 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: "auto",
  },
  btnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});
