import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileEditor } from "@/components/ProfileEditor";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthToken } from "@/hooks/useAuthToken";
import { useColors } from "@/hooks/useColors";
import {
  isLocalProfilePhotoUri,
  uploadProfilePhoto,
} from "@/lib/profile-photo";

export default function ProfileSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, setupProfile, logout } = useAuth();
  const authToken = useAuthToken();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    setName(currentUser?.name?.trim() === currentUser?.phone ? "" : (currentUser?.name ?? ""));
    setBio(currentUser?.bio ?? "");
    setAvatar(currentUser?.avatar ?? null);
  }, [currentUser?.avatar, currentUser?.bio, currentUser?.name, currentUser?.phone]);

  const handleFinish = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      let nextAvatar = avatar;
      if (avatar && isLocalProfilePhotoUri(avatar) && authToken) {
        nextAvatar = await uploadProfilePhoto(authToken, avatar);
      }
      await setupProfile(name.trim(), nextAvatar, bio.trim());
      setTimeout(() => {
        router.replace("/");
      }, 0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.content, { paddingTop: topPad + 20, paddingBottom: bottomPad + 24 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={async () => {
            await logout();
            router.replace("/(auth)/welcome");
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Retour</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Votre profil</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Ajoutez votre nom et une photo pour que vos contacts puissent vous reconnaître.
          </Text>
        </View>

        <ProfileEditor
          name={name}
          bio={bio}
          avatar={avatar}
          loading={loading}
          submitLabel="Terminer"
          onChangeName={setName}
          onChangeBio={setBio}
          onChangeAvatar={setAvatar}
          onSubmit={handleFinish}
        />
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
  backBtn: { alignSelf: "flex-start" },
  backText: { fontSize: 17, fontFamily: "Inter_500Medium" },
  header: { gap: 10 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
});
