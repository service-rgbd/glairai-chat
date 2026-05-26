import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CallItem } from "@/components/CallItem";
import { MOCK_CALLS, useChats } from "@/contexts/ChatsContext";
import { useColors } from "@/hooks/useColors";

export default function CallsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { users } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Appels</Text>
        <View style={styles.headerActions}>
          <Ionicons name="search-outline" size={22} color={colors.text} />
          <Ionicons name="call-outline" size={22} color={colors.primary} style={{ marginLeft: 18 }} />
        </View>
      </View>

      <FlatList
        data={MOCK_CALLS}
        keyExtractor={(c) => c.id}
        scrollEnabled={!!MOCK_CALLS.length}
        contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
        renderItem={({ item }) => {
          const user = users[item.userId];
          if (!user) return null;
          return (
            <CallItem
              call={item}
              user={user}
              onPress={() => {}}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="call-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucun appel récent</Text>
          </View>
        }
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
  headerActions: { flexDirection: "row", alignItems: "center" },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
