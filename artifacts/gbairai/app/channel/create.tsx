import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  "Actualités Et Informations",
  "Sport",
  "Style De Vie",
  "Organisations",
  "Divertissement",
];

export default function CreateChannelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createNewChannel, refreshDiscovery } = useChannels();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setSaving(true);
    try {
      const result = await createNewChannel({ name, description, category });
      await refreshDiscovery();
      router.replace(`/channel/${result.channel.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Impossible de créer la chaîne");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Nouvelle chaîne</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 24, gap: 16 }}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Nom</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ma chaîne"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez votre chaîne"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.input,
              styles.textArea,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Catégorie</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((item) => {
              const active = category === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setCategory(item)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: active ? "#fff" : colors.text, fontFamily: "Inter_500Medium" }}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary, opacity: saving ? 0.75 : 1 }]}
          onPress={() => void handleCreate()}
          disabled={saving || name.trim().length < 2}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createText}>Créer la chaîne</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  error: { fontSize: 13, fontFamily: "Inter_400Regular" },
  createBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  createText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
