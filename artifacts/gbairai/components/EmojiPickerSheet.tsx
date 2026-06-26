import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { filterEmojiCatalogItems, useEmoji3dCatalog, type EmojiCatalogItem } from "@/lib/emoji-catalog";
import { CHAT_EMOJI_3D, fluentEmojiAssetRelativePath, getChatEmoji3dImageUrl } from "@/lib/story-reactions";

interface EmojiPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: EmojiCatalogItem) => void;
}

export function EmojiPickerSheet({ visible, onClose, onSelect }: EmojiPickerSheetProps) {
  const colors = useColors();
  const { data, isLoading } = useEmoji3dCatalog(visible);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");

  const fallbackItems = useMemo<EmojiCatalogItem[]>(
    () =>
      CHAT_EMOJI_3D.map((emoji) => ({
        id: emoji.id,
        emoji: emoji.emoji,
        label: emoji.label,
        fluentName: emoji.fluentName,
        assetPath: emoji.assetPath ?? fluentEmojiAssetRelativePath(emoji.fluentName),
        group: "Favoris",
      })),
    [],
  );

  const groups = useMemo(() => {
    const source = data?.groups.length ? data.groups : ["Favoris"];
    return ["all", ...source];
  }, [data?.groups]);

  const items = useMemo(() => {
    const catalog =
      data?.items.length
        ? data
        : { items: fallbackItems, groups: ["Favoris"] as string[] };

    return filterEmojiCatalogItems(catalog, { group: activeGroup, q: search });
  }, [activeGroup, data, fallbackItems, search]);

  const handleClose = () => {
    setSearch("");
    setActiveGroup("all");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Émojis 3D</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {isLoading
                ? "Chargement du catalogue..."
                : `${data?.items.length ?? fallbackItems.length} émojis disponibles`}
            </Text>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un émoji..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.searchInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupRow}
              style={styles.groupScroll}
            >
              {groups.map((group) => {
                const selected = activeGroup === group;
                const label = group === "all" ? "Tous" : group;
                return (
                  <TouchableOpacity
                    key={group}
                    style={[
                      styles.groupChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.background,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setActiveGroup(group)}
                    activeOpacity={0.82}
                  >
                    <Text
                      style={[
                        styles.groupChipText,
                        { color: selected ? "#fff" : colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {isLoading && !items.length ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              style={styles.list}
              data={items}
              keyExtractor={(item) => `${item.fluentName}:${item.assetPath}`}
              numColumns={4}
              columnWrapperStyle={styles.column}
              contentContainerStyle={styles.grid}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Aucun émoji trouvé
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.item, { backgroundColor: colors.background }]}
                  onPress={() => {
                    onSelect(item);
                    handleClose();
                  }}
                  activeOpacity={0.82}
                >
                  <Image
                    source={{ uri: getChatEmoji3dImageUrl(item) }}
                    style={styles.image}
                    contentFit="contain"
                  />
                  <Text style={[styles.emojiChar, { color: colors.text }]} numberOfLines={1}>
                    {item.emoji}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: "78%",
    maxHeight: "78%",
    overflow: "hidden",
  },
  header: {
    flexShrink: 0,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  searchInput: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  groupScroll: {
    flexGrow: 0,
    maxHeight: 44,
  },
  groupRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  groupChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 180,
  },
  groupChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  grid: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  column: {
    gap: 10,
    marginBottom: 10,
  },
  item: {
    flex: 1,
    maxWidth: "25%",
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 6,
  },
  image: {
    width: 42,
    height: 42,
  },
  emojiChar: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
