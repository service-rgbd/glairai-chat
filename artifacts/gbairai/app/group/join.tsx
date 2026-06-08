import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useChats } from "@/contexts/chats-context-ref";
import { useCachedMediaUrl } from "@/hooks/useCachedMediaUrl";
import { useColors } from "@/hooks/useColors";
import {
  getGroupDisplayColor,
  getGroupDisplayInitials,
  getGroupMemberCountLabel,
  parseGroupInviteToken,
} from "@/lib/group-utils";

export default function JoinGroupScreen() {
  const params = useLocalSearchParams<{ token?: string; invite?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { previewGroupInvite, joinGroupWithInvite } = useChats();

  const initialToken =
    parseGroupInviteToken(params.token ?? "") ??
    parseGroupInviteToken(params.invite ?? "") ??
    "";

  const [inviteInput, setInviteInput] = useState(initialToken);
  const [activeToken, setActiveToken] = useState(initialToken);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isJoinLoading, setIsJoinLoading] = useState(false);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewGroupInvite>
  > | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const avatarUri = useCachedMediaUrl(preview?.avatarUrl ?? null);

  useEffect(() => {
    if (!isAuthenticated || !activeToken) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    void previewGroupInvite(activeToken)
      .then((result) => {
        setPreview(result);
      })
      .catch((error) => {
        setPreview(null);
        setPreviewError(
          error instanceof Error ? error.message : "Invitation invalide",
        );
      })
      .finally(() => {
        setIsPreviewLoading(false);
      });
  }, [activeToken, isAuthenticated, previewGroupInvite]);

  const handleLookup = () => {
    const parsed = parseGroupInviteToken(inviteInput);
    if (!parsed) {
      Alert.alert("Lien invalide", "Collez un lien d'invitation Gbairai valide.");
      return;
    }
    setActiveToken(parsed);
  };

  const handleJoin = async () => {
    if (!activeToken) return;
    setIsJoinLoading(true);
    try {
      const conversationId = await joinGroupWithInvite(activeToken);
      router.replace(`/chat/${conversationId}`);
    } catch (error) {
      Alert.alert(
        "Impossible de rejoindre",
        error instanceof Error ? error.message : "Cette invitation n'est plus valide.",
      );
    } finally {
      setIsJoinLoading(false);
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.text }]}>Rejoindre un groupe</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Connectez-vous pour accepter une invitation de groupe.
        </Text>
      </View>
    );
  }

  const previewInitials = preview?.title
    ? preview.title.slice(0, 2).toUpperCase()
    : "GR";
  const previewColor = preview ? getGroupDisplayColor(preview.conversationId) : colors.primary;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Rejoindre un groupe</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.content, { paddingBottom: bottomPad + 24 }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Lien ou code d'invitation
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          value={inviteInput}
          onChangeText={setInviteInput}
          placeholder="gbairai://group/join?token=..."
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.lookupBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleLookup}
          activeOpacity={0.8}
        >
          <Text style={[styles.lookupBtnText, { color: colors.primary }]}>Vérifier l'invitation</Text>
        </TouchableOpacity>

        {isPreviewLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : null}

        {previewError ? (
          <Text style={[styles.errorText, { color: colors.destructive ?? "#EF4444" }]}>
            {previewError}
          </Text>
        ) : null}

        {preview ? (
          <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Avatar
              uri={avatarUri}
              initials={previewInitials}
              color={previewColor}
              size={84}
            />
            <Text style={[styles.previewTitle, { color: colors.text }]}>
              {preview.title?.trim() || "Groupe Gbairai"}
            </Text>
            <Text style={[styles.previewMeta, { color: colors.mutedForeground }]}>
              {getGroupMemberCountLabel(preview.memberCount)}
            </Text>
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                void handleJoin();
              }}
              disabled={isJoinLoading}
              activeOpacity={0.85}
            >
              {isJoinLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.joinBtnText}>Rejoindre le groupe</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", paddingHorizontal: 20 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", paddingHorizontal: 20, marginTop: 8 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  lookupBtn: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  lookupBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  errorText: { marginTop: 20, textAlign: "center", fontSize: 15, fontFamily: "Inter_500Medium" },
  previewCard: {
    marginTop: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  previewTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", marginTop: 8 },
  previewMeta: { fontSize: 14, fontFamily: "Inter_400Regular" },
  joinBtn: {
    marginTop: 16,
    width: "100%",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  joinBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
