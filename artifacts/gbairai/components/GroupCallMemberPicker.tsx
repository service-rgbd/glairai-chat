import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import type { GUser } from "@/contexts/chats-types";
import { useColors } from "@/hooks/useColors";

type Props = {
  visible: boolean;
  callType: "audio" | "video";
  members: GUser[];
  onClose: () => void;
  onConfirm: (selectedUserIds: string[]) => void;
};

export function GroupCallMemberPicker({
  visible,
  callType,
  members,
  onClose,
  onConfirm,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => members.map((m) => m.id));

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  const toggleMember = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleOpen = () => {
    if (!visible) return;
    setSelectedIds(members.map((m) => m.id));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={handleOpen}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
              <Text style={[styles.headerBtnText, { color: colors.primary }]}>Annuler</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              {callType === "video" ? "Appel vidéo" : "Appel audio"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedIds.length === 0) return;
                onConfirm(selectedIds);
              }}
              style={styles.headerBtn}
              activeOpacity={0.7}
              disabled={selectedIds.length === 0}
            >
              <Text
                style={[
                  styles.headerBtnText,
                  { color: selectedIds.length === 0 ? colors.mutedForeground : colors.primary },
                ]}
              >
                Appeler
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Choisissez les participants à faire sonner
          </Text>

          {sortedMembers.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={sortedMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.row, { borderBottomColor: colors.border }]}
                    onPress={() => toggleMember(item.id)}
                    activeOpacity={0.75}
                  >
                    <Avatar uri={item.avatar} initials={item.initials} color={item.color} size={44} />
                    <Text style={[styles.rowName, { color: colors.text }]}>{item.name}</Text>
                    <Ionicons
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 72,
    paddingHorizontal: 4,
  },
  headerBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});
