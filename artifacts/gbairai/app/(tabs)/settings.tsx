import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({ icon, label, value, onPress, danger }: SettingRowProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: danger ? colors.destructive : colors.text }]}>{label}</Text>
        {value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>}
      </View>
      {onPress && <Feather name="chevron-right" size={18} color={colors.mutedForeground} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, logout } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const initials = (currentUser?.name ?? "M").slice(0, 2).toUpperCase();

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vraiment vous déconnecter?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnecter", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/welcome"); } },
    ]);
  };

  const iconColor = colors.primary;
  const iconSize = 20;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Réglages</Text>
        <Feather name="search" size={22} color={colors.text} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 80 }}>
        <TouchableOpacity style={[styles.profileCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]} activeOpacity={0.8}>
          <Avatar uri={currentUser?.avatar} initials={initials} color="#6D4AFF" size={64} />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{currentUser?.name ?? "Utilisateur"}</Text>
            <Text style={[styles.profileBio, { color: colors.mutedForeground }]}>{currentUser?.bio || "Appuyer pour modifier le profil"}</Text>
            <Text style={[styles.profilePhone, { color: colors.mutedForeground }]}>{currentUser?.phone}</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SettingRow icon={<Ionicons name="key-outline" size={iconSize} color={iconColor} />} label="Sécurité" onPress={() => {}} />
          <SettingRow icon={<Ionicons name="phone-portrait-outline" size={iconSize} color={iconColor} />} label="Changer de numéro" onPress={() => {}} />
          <SettingRow icon={<Ionicons name="cloud-download-outline" size={iconSize} color={iconColor} />} label="Demander mes informations" onPress={() => {}} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SettingRow icon={<Ionicons name="lock-closed-outline" size={iconSize} color={iconColor} />} label="Confidentialité" onPress={() => {}} />
          <SettingRow icon={<Ionicons name="notifications-outline" size={iconSize} color={iconColor} />} label="Notifications" onPress={() => {}} />
          <SettingRow icon={<Ionicons name="chatbubble-outline" size={iconSize} color={iconColor} />} label="Discussions" onPress={() => {}} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SettingRow icon={<Ionicons name="folder-outline" size={iconSize} color={iconColor} />} label="Stockage et données" onPress={() => {}} />
          <SettingRow icon={<Ionicons name="help-circle-outline" size={iconSize} color={iconColor} />} label="Aide" onPress={() => {}} />
          <SettingRow icon={<Ionicons name="people-outline" size={iconSize} color={iconColor} />} label="Inviter des amis" onPress={() => {}} />
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SettingRow
            icon={<Ionicons name="log-out-outline" size={iconSize} color={colors.destructive} />}
            label="Déconnexion"
            onPress={handleLogout}
            danger
          />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>Gbairai v1.0.0</Text>
      </ScrollView>
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
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginVertical: 8,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  profileBio: { fontSize: 13.5, fontFamily: "Inter_400Regular", marginTop: 3 },
  profilePhone: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { width: 28, alignItems: "center" },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15.5, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
});
