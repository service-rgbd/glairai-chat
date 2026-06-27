import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import {
  ChannelFormField,
  ChannelMenuRow,
  ChannelPrimaryButton,
  ChannelScreenHeader,
  ChannelSection,
} from "@/modules/channels/components/ChannelFormUi";
import { useChannels } from "@/modules/channels/context/ChannelsContext";
import { canManageChannel, isOfficialChannel } from "@/modules/channels/lib/channel-official";
import type { Channel } from "@/modules/channels/types";
import { isLikelyNetworkError } from "@/lib/app-network";
import { useColors } from "@/hooks/useColors";

export default function ChannelSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getChannel, updateExistingChannel, removeChannel, refreshDiscovery } = useChannels();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void getChannel(id)
      .then((result) => {
        setChannel(result);
        setName(result.name);
        setDescription(result.description);
      })
      .catch((loadError) => {
        setError(
          isLikelyNetworkError(loadError)
            ? "Connexion insuffisante pour charger les paramètres."
            : loadError instanceof Error
              ? loadError.message
              : "Impossible de charger la chaîne",
        );
      })
      .finally(() => setLoading(false));
  }, [getChannel, id]);

  const handleSave = async () => {
    if (!id) return;
    setError(null);
    setSaving(true);
    try {
      const result = await updateExistingChannel(id, { name, description });
      setChannel(result.channel);
      await refreshDiscovery();
      router.back();
    } catch (saveError) {
      setError(
        isLikelyNetworkError(saveError)
          ? "Enregistrement impossible sans connexion internet."
          : saveError instanceof Error
            ? saveError.message
            : "Impossible d'enregistrer",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Supprimer la chaîne",
      "Cette action est irréversible. Toutes les publications seront supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void removeChannel(id)
              .then(async () => {
                await refreshDiscovery();
                router.replace("/(tabs)/(main)/channels");
              })
              .catch((deleteError) => {
                Alert.alert(
                  "Suppression impossible",
                  isLikelyNetworkError(deleteError)
                    ? "Vérifiez votre connexion internet."
                    : deleteError instanceof Error
                      ? deleteError.message
                      : "Une erreur est survenue.",
                );
              });
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.loaderRoot, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!channel) {
    return (
      <View style={[styles.loaderRoot, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>{error ?? "Chaîne introuvable"}</Text>
      </View>
    );
  }

  if (!canManageChannel(channel)) {
    return (
      <View style={[styles.loaderRoot, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>
          {isOfficialChannel(channel)
            ? "Cette chaîne officielle est un exemple en lecture seule."
            : "Accès réservé au propriétaire"}
        </Text>
      </View>
    );
  }

  const initials = channel.name.slice(0, 2).toUpperCase();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ChannelScreenHeader title="Gérer la chaîne" topPad={topPad} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Avatar uri={channel.avatarUrl} initials={initials} color="#6D4AFF" size={72} />
          <View style={styles.profileBody}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {channel.name}
            </Text>
            <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>
              {channel.followersCount} abonné{channel.followersCount > 1 ? "s" : ""}
              {channel.category ? ` · ${channel.category}` : ""}
            </Text>
          </View>
        </View>

        <ChannelSection title="Actions rapides">
          <ChannelMenuRow
            icon="eye-outline"
            label="Voir la chaîne publique"
            onPress={() => router.push(`/channel/${channel.id}`)}
          />
          <ChannelMenuRow
            icon="create-outline"
            label="Publier une annonce"
            showDivider
            onPress={() => router.push(`/channel/${channel.id}`)}
          />
        </ChannelSection>

        <ChannelSection title="Profil de la chaîne">
          <ChannelFormField
            label="Nom"
            value={name}
            onChangeText={setName}
            placeholder="Nom de la chaîne"
            maxLength={64}
          />
          <ChannelFormField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez votre chaîne"
            multiline
            maxLength={280}
          />
        </ChannelSection>

        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        ) : null}

        <ChannelPrimaryButton
          label="Enregistrer les modifications"
          onPress={() => void handleSave()}
          loading={saving}
          disabled={name.trim().length < 2}
        />

        <ChannelSection title="Zone sensible">
          <ChannelMenuRow
            icon="trash-outline"
            label="Supprimer la chaîne"
            destructive
            onPress={handleDelete}
          />
        </ChannelSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loaderRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { padding: 16, gap: 18 },
  profileCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileBody: { flex: 1, gap: 4 },
  profileName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  profileMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
