import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChannels } from "@/modules/channels/context/ChannelsContext";
import type { Channel } from "@/modules/channels/types";
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

  useEffect(() => {
    if (!id) return;
    void getChannel(id)
      .then((result) => {
        setChannel(result);
        setName(result.name);
        setDescription(result.description);
      })
      .finally(() => setLoading(false));
  }, [getChannel, id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const result = await updateExistingChannel(id, { name, description });
      setChannel(result.channel);
      await refreshDiscovery();
      router.back();
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
            void removeChannel(id).then(async () => {
              await refreshDiscovery();
              router.replace("/(tabs)/(main)/channels");
            });
          },
        },
      ],
    );
  };

  if (loading || !channel) {
    return (
      <View style={[styles.loaderRoot, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (channel.role !== "owner") {
    return (
      <View style={[styles.loaderRoot, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Accès réservé au propriétaire</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Paramètres</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 24, gap: 16 }}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Nom</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            style={[
              styles.input,
              styles.textArea,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
            ]}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.75 : 1 }]}
          onPress={() => void handleSave()}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
          <Text style={[styles.deleteText, { color: colors.destructive }]}>Supprimer la chaîne</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loaderRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
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
  saveBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  deleteBtn: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
