import { Feather, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { PasswordPromptModal } from "@/components/PasswordPromptModal";
import { ProfileEditor } from "@/components/ProfileEditor";
import { useAuth } from "@/contexts/AuthContext";
import { useChats } from "@/contexts/chats-context-ref";
import { useCallRingtone, CALL_RINGTONES } from "@/lib/call-ringtone";
import {
  clearArchivedAccessPassword,
  isArchivedAccessEnabled,
  setArchivedAccessPassword,
  verifyArchivedAccessPassword,
} from "@/lib/archived-access";
import { useChatWallpaper } from "@/hooks/useChatWallpaper";
import { useColors } from "@/hooks/useColors";
import { getLocalDbStats } from "@/lib/local-db";
import { getMediaCacheStats } from "@/lib/media-cache";
import { purgeOfflineCacheForUser } from "@/lib/offline-cache";
import { queryClient } from "@/lib/query-client";

interface SettingSwitchRowProps {
  label: string;
  value?: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}

function SettingSwitchRow({ label, value, enabled, onToggle }: SettingSwitchRowProps) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>}
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        thumbColor="#fff"
        trackColor={{ false: colors.muted, true: colors.primary }}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [cacheStats, setCacheStats] = useState({
    mediaFiles: 0,
    mediaMb: 0,
    conversations: 0,
    messages: 0,
  });

  useEffect(() => {
    void Promise.all([getMediaCacheStats(), getLocalDbStats()]).then(([media, localDb]) => {
      setCacheStats({
        mediaFiles: media.files,
        mediaMb: Math.round((media.bytes / (1024 * 1024)) * 10) / 10,
        conversations: localDb.conversations,
        messages: localDb.messages,
      });
    });
  }, []);

  const { currentUser, updateProfile, logout } = useAuth();
  const { wallpaper } = useChatWallpaper();
  const { ringtoneId, ringtone, setRingtoneId } = useCallRingtone();
  const { socketConnected } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [editingProfile, setEditingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [draftName, setDraftName] = useState(currentUser?.name ?? "");
  const [draftBio, setDraftBio] = useState(currentUser?.bio ?? "");
  const [draftAvatar, setDraftAvatar] = useState<string | null>(currentUser?.avatar ?? null);
  const [archivedPasswordEnabled, setArchivedPasswordEnabled] = useState(false);
  const [showSetArchivePassword, setShowSetArchivePassword] = useState(false);
  const [showRemoveArchivePassword, setShowRemoveArchivePassword] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    void isArchivedAccessEnabled(currentUser.id).then(setArchivedPasswordEnabled);
  }, [currentUser?.id]);

  useEffect(() => {
    setDraftName(currentUser?.name ?? "");
    setDraftBio(currentUser?.bio ?? "");
    setDraftAvatar(currentUser?.avatar ?? null);
  }, [currentUser?.avatar, currentUser?.bio, currentUser?.name]);

  const visibilityOptions = useMemo(
    () => ["everyone", "contacts", "nobody"] as const,
    [],
  );
  const fontScaleOptions = useMemo(
    () => ["small", "medium", "large"] as const,
    [],
  );

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnecter", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/welcome"); } },
    ]);
  };

  const patchSettings = async (
    updates: Partial<NonNullable<typeof currentUser>["settings"]>,
  ) => {
    if (!currentUser) return;
    try {
      await updateProfile({
        settings: {
          ...currentUser.settings,
          ...updates,
        },
      });
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer ce réglage. Réessayez.");
    }
  };

  const cycleLastSeenVisibility = async () => {
    if (!currentUser) return;
    const currentIndex = visibilityOptions.indexOf(
      currentUser.settings.lastSeenVisibility,
    );
    const nextValue = visibilityOptions[(currentIndex + 1) % visibilityOptions.length];
    await patchSettings({ lastSeenVisibility: nextValue });
  };

  const cycleFontScale = async () => {
    if (!currentUser) return;
    const currentIndex = fontScaleOptions.indexOf(currentUser.settings.chatFontScale);
    const nextValue = fontScaleOptions[(currentIndex + 1) % fontScaleOptions.length];
    await patchSettings({ chatFontScale: nextValue });
  };

  const cycleRingtone = async () => {
    const currentIndex = CALL_RINGTONES.findIndex((item) => item.id === ringtoneId);
    const next = CALL_RINGTONES[(currentIndex + 1) % CALL_RINGTONES.length]!;
    await setRingtoneId(next.id);
  };

  const saveProfile = async () => {
    if (!draftName.trim()) return;
    setLoadingProfile(true);
    try {
      await updateProfile({
        name: draftName.trim(),
        bio: draftBio.trim(),
        avatar: draftAvatar,
      });
      setEditingProfile(false);
    } finally {
      setLoadingProfile(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Réglages</Text>
        <View style={[styles.statusPill, { backgroundColor: socketConnected ? colors.primary : colors.muted }]}>
          <Text style={styles.statusPillText}>{socketConnected ? "Connecté" : "Hors ligne"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 96 }}>
        <View style={[styles.profileBlock, { borderBottomColor: colors.border }]}>
          <View style={styles.profileHeader}>
            <View style={styles.profileIdentity}>
              <Avatar
                uri={currentUser?.avatar}
                initials={(currentUser?.name ?? "U").slice(0, 2).toUpperCase()}
                color="#6D4AFF"
                size={68}
              />
              <View style={styles.profileText}>
              <Text style={[styles.profileName, { color: colors.text }]}>
                {currentUser?.name || "Utilisateur"}
              </Text>
              <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
                {currentUser?.phone}
              </Text>
              <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
                {currentUser?.statusText || currentUser?.bio || "Disponible"}
              </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setEditingProfile((value) => !value)} activeOpacity={0.7}>
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {editingProfile ? "Fermer" : "Modifier"}
              </Text>
            </TouchableOpacity>
          </View>

          {editingProfile ? (
            <ProfileEditor
              name={draftName}
              bio={draftBio}
              avatar={draftAvatar}
              loading={loadingProfile}
              submitLabel="Enregistrer"
              onChangeName={setDraftName}
              onChangeBio={setDraftBio}
              onChangeAvatar={setDraftAvatar}
              onSubmit={saveProfile}
            />
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Confidentialité</Text>
        <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={cycleLastSeenVisibility} activeOpacity={0.7}>
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Dernière connexion</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {currentUser?.settings.lastSeenVisibility === "everyone"
                ? "Tout le monde"
                : currentUser?.settings.lastSeenVisibility === "contacts"
                  ? "Mes contacts"
                  : "Personne"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <SettingSwitchRow
          label="Accusés de lecture"
          value="Afficher quand vos messages sont lus"
          enabled={currentUser?.settings.readReceiptsEnabled ?? true}
          onToggle={(value) => void patchSettings({ readReceiptsEnabled: value })}
        />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Notifications</Text>
        <SettingSwitchRow
          label="Notifications push"
          enabled={currentUser?.settings.notificationsEnabled ?? true}
          onToggle={(value) => void patchSettings({ notificationsEnabled: value })}
        />
        <SettingSwitchRow
          label="Son"
          enabled={currentUser?.settings.notificationSoundEnabled ?? true}
          onToggle={(value) => void patchSettings({ notificationSoundEnabled: value })}
        />
        <SettingSwitchRow
          label="Vibration"
          enabled={currentUser?.settings.vibrationEnabled ?? true}
          onToggle={(value) => void patchSettings({ vibrationEnabled: value })}
        />

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Discussions et données</Text>
        <TouchableOpacity
          style={[styles.row, { borderBottomColor: colors.border }]}
          onPress={() => {
            if (archivedPasswordEnabled) {
              Alert.alert("Mot de passe archivées", "Que souhaitez-vous faire ?", [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Modifier",
                  onPress: () => setShowSetArchivePassword(true),
                },
                {
                  text: "Désactiver",
                  style: "destructive",
                  onPress: () => setShowRemoveArchivePassword(true),
                },
              ]);
              return;
            }
            setShowSetArchivePassword(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Mot de passe des archivées</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {archivedPasswordEnabled ? "Activé" : "Désactivé"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <SettingSwitchRow
          label="Téléchargement automatique"
          enabled={currentUser?.settings.autoDownloadMedia ?? true}
          onToggle={(value) => void patchSettings({ autoDownloadMedia: value })}
        />
        <SettingSwitchRow
          label="Mode économie de données"
          enabled={currentUser?.settings.lowDataMode ?? false}
          onToggle={(value) => void patchSettings({ lowDataMode: value })}
        />
        <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={cycleFontScale} activeOpacity={0.7}>
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Taille du texte</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {currentUser?.settings.chatFontScale === "small"
                ? "Petite"
                : currentUser?.settings.chatFontScale === "large"
                  ? "Grande"
                  : "Moyenne"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.row, { borderBottomColor: colors.border }]}
          onPress={() => router.push("/(tabs)/chat-wallpaper")}
          activeOpacity={0.7}
        >
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Arrière-plan du chat</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{wallpaper.label}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.row, { borderBottomColor: colors.border }]}
          onPress={() => void cycleRingtone()}
          activeOpacity={0.7}
        >
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Sonnerie d'appel</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{ringtone.label}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Contacts et cache</Text>
        <TouchableOpacity
          style={[styles.row, { borderBottomColor: colors.border }]}
          onPress={async () => {
            if (!currentUser?.id) return;
            await purgeOfflineCacheForUser(currentUser.id);
            queryClient.clear();
            setCacheStats({ mediaFiles: 0, mediaMb: 0, conversations: 0, messages: 0 });
            Alert.alert("Cache vidé", "Conversations, messages et médias locaux ont été réinitialisés.");
          }}
          activeOpacity={0.7}
        >
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Vider le cache</Text>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
              {cacheStats.conversations > 0 || cacheStats.messages > 0 || cacheStats.mediaFiles > 0
                ? `${cacheStats.conversations} discussions · ${cacheStats.messages} messages · ${cacheStats.mediaFiles} média(s) (${cacheStats.mediaMb} Mo)`
                : "Conversations, messages et médias locaux"}
            </Text>
          </View>
          <Ionicons name="trash-outline" size={20} color={colors.destructive} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.logoutRow, { borderBottomColor: colors.border }]} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Déconnexion</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>Gbairai v1.0.0</Text>
      </ScrollView>

      <PasswordPromptModal
        visible={showSetArchivePassword}
        title="Mot de passe des archivées"
        description="Choisissez un mot de passe pour protéger l'accès aux conversations archivées."
        confirmLabel="Enregistrer"
        onClose={() => setShowSetArchivePassword(false)}
        onSubmit={async (password) => {
          if (!currentUser?.id) return false;
          try {
            await setArchivedAccessPassword(currentUser.id, password);
            setArchivedPasswordEnabled(true);
            return true;
          } catch (error) {
            Alert.alert(
              "Erreur",
              error instanceof Error ? error.message : "Impossible d'enregistrer le mot de passe.",
            );
            return false;
          }
        }}
      />

      <PasswordPromptModal
        visible={showRemoveArchivePassword}
        title="Désactiver le mot de passe"
        description="Entrez votre mot de passe actuel pour désactiver la protection."
        confirmLabel="Désactiver"
        onClose={() => setShowRemoveArchivePassword(false)}
        onSubmit={async (password) => {
          if (!currentUser?.id) return false;
          const ok = await verifyArchivedAccessPassword(currentUser.id, password);
          if (!ok) return false;
          await clearArchivedAccessPassword(currentUser.id);
          setArchivedPasswordEnabled(false);
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  profileBlock: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  profileIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  profileText: { flex: 1 },
  profileName: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  profileMeta: { fontSize: 13.5, fontFamily: "Inter_400Regular", marginTop: 3 },
  actionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionTitle: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 8,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Inter_600SemiBold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15.5, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoutText: { fontSize: 15.5, fontFamily: "Inter_500Medium" },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
});
