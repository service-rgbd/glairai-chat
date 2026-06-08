import { Feather, Ionicons } from "@expo/vector-icons";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
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
import { useChatWallpaper } from "@/hooks/useChatWallpaper";
import { useColors } from "@/hooks/useColors";
import {
  clearArchivedAccessPassword,
  isArchivedAccessEnabled,
  setArchivedAccessPassword,
  verifyArchivedAccessPassword,
} from "@/lib/archived-access";
import { useCallRingtone, CALL_RINGTONES } from "@/lib/call-ringtone";
import { getLocalDbStats } from "@/lib/local-db";
import { getMediaCacheStats } from "@/lib/media-cache";
import { purgeOfflineCacheForUser } from "@/lib/offline-cache";
import { queryClient } from "@/lib/query-client";
import { SETTINGS_ICONS, type SettingsIconKey } from "@/lib/settings-icons";

type IconName = keyof typeof Ionicons.glyphMap;

function SettingsIcon({
  image,
  sprite,
  ionIcon,
  ionColor,
}: {
  image?: ImageSource;
  sprite?: { source: ImageSource; column: number; row: number; columns?: number; rows?: number };
  ionIcon?: IconName;
  ionColor?: string;
}) {
  const colors = useColors();
  const cellSize = 28;

  if (image) {
    return <Image source={image} style={styles.settingsIconImage} contentFit="contain" />;
  }

  if (sprite) {
    const columns = sprite.columns ?? 2;
    const rows = sprite.rows ?? 4;
    return (
      <View style={styles.spriteClip}>
        <Image
          source={sprite.source}
          style={{
            width: cellSize * columns,
            height: cellSize * rows,
            transform: [{ translateX: -sprite.column * cellSize }, { translateY: -sprite.row * cellSize }],
          }}
          contentFit="cover"
        />
      </View>
    );
  }

  if (ionIcon) {
    return <Ionicons name={ionIcon} size={20} color={ionColor ?? colors.primary} />;
  }

  return null;
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function SettingsRow({
  label,
  value,
  iconKey,
  image,
  sprite,
  ionIcon,
  destructive,
  trailing,
  onPress,
  isLast,
}: {
  label: string;
  value?: string;
  iconKey?: SettingsIconKey;
  image?: ImageSource;
  sprite?: { source: ImageSource; column: number; row: number; columns?: number; rows?: number };
  ionIcon?: IconName;
  destructive?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const colors = useColors();
  const iconImage = iconKey ? SETTINGS_ICONS[iconKey] : image;
  const iconBoxStyle = sprite
    ? [styles.iconBox, styles.iconBoxSprite]
    : [styles.iconBox, { backgroundColor: colors.muted }];
  const content = (
    <>
      <View style={iconBoxStyle}>
        <SettingsIcon image={iconImage} sprite={sprite} ionIcon={ionIcon} ionColor={destructive ? colors.destructive : colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.text }]}>
          {label}
        </Text>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]} numberOfLines={2}>
            {value}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        onPress ? <Feather name="chevron-right" size={18} color={colors.mutedForeground} /> : null
      )}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.row, !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      {content}
    </TouchableOpacity>
  );
}

function SettingsSwitchRow({
  label,
  value,
  iconKey,
  image,
  sprite,
  ionIcon,
  enabled,
  onToggle,
  isLast,
}: {
  label: string;
  value?: string;
  iconKey?: SettingsIconKey;
  image?: ImageSource;
  sprite?: { source: ImageSource; column: number; row: number; columns?: number; rows?: number };
  ionIcon?: IconName;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  isLast?: boolean;
}) {
  const colors = useColors();
  const iconImage = iconKey ? SETTINGS_ICONS[iconKey] : image;
  const iconBoxStyle = sprite
    ? [styles.iconBox, styles.iconBoxSprite]
    : [styles.iconBox, { backgroundColor: colors.muted }];
  return (
    <View
      style={[styles.row, !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      <View style={iconBoxStyle}>
        <SettingsIcon image={iconImage} sprite={sprite} ionIcon={ionIcon} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]} numberOfLines={2}>
            {value}
          </Text>
        ) : null}
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

  const initials = (currentUser?.name ?? "U").slice(0, 2).toUpperCase();
  const avatarColor = "#FF6B35";

  useEffect(() => {
    if (!currentUser?.id) return;
    void isArchivedAccessEnabled(currentUser.id).then(setArchivedPasswordEnabled);
  }, [currentUser?.id]);

  useEffect(() => {
    setDraftName(currentUser?.name ?? "");
    setDraftBio(currentUser?.bio ?? "");
    setDraftAvatar(currentUser?.avatar ?? null);
  }, [currentUser?.avatar, currentUser?.bio, currentUser?.name]);

  const visibilityOptions = useMemo(() => ["everyone", "contacts", "nobody"] as const, []);
  const fontScaleOptions = useMemo(() => ["small", "medium", "large"] as const, []);

  const lastSeenLabel =
    currentUser?.settings.lastSeenVisibility === "everyone"
      ? "Tout le monde"
      : currentUser?.settings.lastSeenVisibility === "contacts"
        ? "Mes contacts"
        : "Personne";

  const fontScaleLabel =
    currentUser?.settings.chatFontScale === "small"
      ? "Petite"
      : currentUser?.settings.chatFontScale === "large"
        ? "Grande"
        : "Moyenne";

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnecter",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/welcome");
        },
      },
    ]);
  };

  const patchSettings = async (updates: Partial<NonNullable<typeof currentUser>["settings"]>) => {
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
    const currentIndex = visibilityOptions.indexOf(currentUser.settings.lastSeenVisibility);
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

  const openArchivePasswordSettings = () => {
    if (archivedPasswordEnabled) {
      Alert.alert("Mot de passe archivées", "Que souhaitez-vous faire ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Modifier", onPress: () => setShowSetArchivePassword(true) },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: () => setShowRemoveArchivePassword(true),
        },
      ]);
      return;
    }
    setShowSetArchivePassword(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPad + 8, paddingBottom: bottomPad + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={[styles.gridBtn, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.75}>
            <Image source={SETTINGS_ICONS.menuGrid} style={styles.gridIcon} contentFit="contain" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editPill, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setEditingProfile((value) => !value)}
            activeOpacity={0.75}
          >
            <Text style={[styles.editPillText, { color: colors.primary }]}>
              {editingProfile ? "Fermer" : "Modifier"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileHero}>
          <View style={styles.avatarWrap}>
            {currentUser?.avatar ? (
              <Avatar uri={currentUser.avatar} initials={initials} color={avatarColor} size={96} />
            ) : (
              <LinearGradient
                colors={["#FF8A4C", "#FF3D71"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
            )}
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{currentUser?.name || "Utilisateur"}</Text>
          <Text style={[styles.profilePhone, { color: colors.mutedForeground }]}>{currentUser?.phone}</Text>
          <View style={[styles.statusChip, { backgroundColor: socketConnected ? `${colors.primary}18` : colors.muted }]}>
            <View style={[styles.statusDot, { backgroundColor: socketConnected ? colors.online : colors.mutedForeground }]} />
            <Text style={[styles.statusChipText, { color: socketConnected ? colors.primary : colors.mutedForeground }]}>
              {socketConnected ? "En ligne" : "Hors ligne"}
            </Text>
          </View>
        </View>

        {editingProfile ? (
          <SettingsGroup>
            <View style={styles.editorWrap}>
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
            </View>
          </SettingsGroup>
        ) : (
          <SettingsGroup>
            <SettingsRow
              label="Définir une photo de profil"
              iconKey="profilePhoto"
              onPress={() => setEditingProfile(true)}
            />
            <SettingsRow
              label="Modifier le profil"
              iconKey="editProfile"
              onPress={() => setEditingProfile(true)}
              isLast
            />
          </SettingsGroup>
        )}

        <SettingsGroup>
          <SettingsRow
            label="Mon profil"
            value={currentUser?.bio || currentUser?.statusText || "Disponible"}
            iconKey="profile"
            onPress={() => setEditingProfile(true)}
          />
          <SettingsRow
            label="Appels récents"
            iconKey="calls"
            onPress={() => router.push("/(tabs)/(main)/calls")}
          />
          <SettingsRow
            label="Arrière-plan du chat"
            value={wallpaper.label}
            iconKey="wallpaper"
            onPress={() => router.push("/(tabs)/chat-wallpaper")}
          />
          <SettingsRow
            label="Sonnerie d'appel"
            value={ringtone.label}
            iconKey="ringtone"
            onPress={() => void cycleRingtone()}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            label="Dernière connexion"
            value={lastSeenLabel}
            iconKey="lastSeen"
            onPress={() => void cycleLastSeenVisibility()}
          />
          <SettingsSwitchRow
            label="Accusés de lecture"
            value="Afficher quand vos messages sont lus"
            iconKey="readReceipts"
            enabled={currentUser?.settings.readReceiptsEnabled ?? true}
            onToggle={(value) => void patchSettings({ readReceiptsEnabled: value })}
          />
          <SettingsSwitchRow
            label="Notifications push"
            iconKey="bell"
            enabled={currentUser?.settings.notificationsEnabled ?? true}
            onToggle={(value) => void patchSettings({ notificationsEnabled: value })}
          />
          <SettingsSwitchRow
            label="Son"
            iconKey="ringtone"
            enabled={currentUser?.settings.notificationSoundEnabled ?? true}
            onToggle={(value) => void patchSettings({ notificationSoundEnabled: value })}
          />
          <SettingsSwitchRow
            label="Vibration"
            iconKey="vibration"
            enabled={currentUser?.settings.vibrationEnabled ?? true}
            onToggle={(value) => void patchSettings({ vibrationEnabled: value })}
          />
          <SettingsRow
            label="Mot de passe des archivées"
            value={archivedPasswordEnabled ? "Activé" : "Désactivé"}
            iconKey="lock"
            onPress={openArchivePasswordSettings}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsSwitchRow
            label="Téléchargement automatique"
            iconKey="download"
            enabled={currentUser?.settings.autoDownloadMedia ?? true}
            onToggle={(value) => void patchSettings({ autoDownloadMedia: value })}
          />
          <SettingsSwitchRow
            label="Mode économie de données"
            iconKey="wifi"
            enabled={currentUser?.settings.lowDataMode ?? false}
            onToggle={(value) => void patchSettings({ lowDataMode: value })}
          />
          <SettingsRow
            label="Taille du texte"
            value={fontScaleLabel}
            iconKey="textSize"
            onPress={() => void cycleFontScale()}
          />
          <SettingsRow
            label="Vider le cache"
            value={
              cacheStats.conversations > 0 || cacheStats.messages > 0 || cacheStats.mediaFiles > 0
                ? `${cacheStats.conversations} discussions · ${cacheStats.messages} messages · ${cacheStats.mediaFiles} média(s) (${cacheStats.mediaMb} Mo)`
                : "Conversations, messages et médias locaux"
            }
            iconKey="download"
            destructive
            onPress={() => {
              Alert.alert("Vider le cache", "Supprimer les données locales ?", [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Vider",
                  style: "destructive",
                  onPress: async () => {
                    if (!currentUser?.id) return;
                    await purgeOfflineCacheForUser(currentUser.id);
                    queryClient.clear();
                    setCacheStats({ mediaFiles: 0, mediaMb: 0, conversations: 0, messages: 0 });
                    Alert.alert("Cache vidé", "Conversations, messages et médias locaux ont été réinitialisés.");
                  },
                },
              ]);
            }}
            isLast
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow
            label="Déconnexion"
            iconKey="logout"
            destructive
            onPress={handleLogout}
            isLast
          />
        </SettingsGroup>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>Gbairai v1.0.0</Text>
      </ScrollView>

      <PasswordPromptModal
        visible={showSetArchivePassword}
        title="Mot de passe des archivées"
        description="Choisissez un mot de passe pour protéger l'accès aux conversations archivées."
        confirmLabel="Enregistrer"
        icon={require("@/assets/images/archived-password.png")}
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
        icon={require("@/assets/images/archived-password.png")}
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
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  gridBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gridIcon: {
    width: 22,
    height: 22,
  },
  editPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editPillText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  profileHero: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 4,
    gap: 6,
  },
  avatarWrap: {
    marginBottom: 6,
  },
  avatarGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
  },
  profileName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  profilePhone: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  groupCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  settingsIconImage: {
    width: 28,
    height: 28,
  },
  spriteClip: {
    width: 28,
    height: 28,
    overflow: "hidden",
  },
  iconBoxSprite: {
    backgroundColor: "#1C1C1E",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 18,
  },
  editorWrap: {
    padding: 14,
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginBottom: 8,
  },
});
