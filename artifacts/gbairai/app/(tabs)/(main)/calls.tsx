import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Platform, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CallItem } from "@/components/CallItem";
import { useAuth } from "@/contexts/AuthContext";
import { MOCK_CALLS } from "@/lib/mock-calls";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { buildCallHistorySections } from "@/lib/call-history";
import { openGlobalSearch } from "@/lib/navigation";

export default function CallsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { calls, users, startOutgoingCall } = useChats();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const displayedCalls = isAuthenticated ? calls : MOCK_CALLS;
  const sections = useMemo(() => buildCallHistorySections(displayedCalls), [displayedCalls]);

  const handleCallPress = (call: (typeof displayedCalls)[number]) => {
    if (!call.conversationId) return;
    const nextCallId = isAuthenticated
      ? startOutgoingCall({
          userId: call.userId,
          conversationId: call.conversationId,
          type: call.type,
        })
      : undefined;
    router.push({
      pathname: "/call/[conversationId]",
      params: {
        conversationId: call.conversationId,
        type: call.type,
        ...(nextCallId ? { callId: nextCallId } : {}),
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 6, borderBottomColor: colors.border, backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Appels</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openGlobalSearch} activeOpacity={0.7}>
            <Ionicons name="search-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <Ionicons name="call-outline" size={22} color={colors.primary} style={{ marginLeft: 18 }} />
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.listContent,
          !sections.length && styles.listContentEmpty,
          { paddingBottom: bottomPad + 96 },
        ]}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const user = users[item.userId];
          if (!user) return null;
          return <CallItem call={item} user={user} onPress={() => handleCallPress(item)} />;
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
  listContent: {
    flexGrow: 1,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
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
