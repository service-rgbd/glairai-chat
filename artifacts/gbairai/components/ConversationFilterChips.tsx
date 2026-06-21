import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type {
  ConversationFilterCounts,
  ConversationListFilter,
} from "@/lib/conversation-list-sections";

type Props = {
  activeFilter: ConversationListFilter;
  counts: ConversationFilterCounts;
  onChange: (filter: ConversationListFilter) => void;
};

const FILTERS: Array<{ id: ConversationListFilter; label: string; countKey: keyof ConversationFilterCounts }> =
  [
    { id: "all", label: "Toutes", countKey: "all" },
    { id: "unread", label: "Non lues", countKey: "unread" },
    { id: "direct", label: "Discussions", countKey: "direct" },
    { id: "channels", label: "Chaînes", countKey: "channels" },
    { id: "groups", label: "Groupes", countKey: "groups" },
  ];

export function ConversationFilterChips({ activeFilter, counts, onChange }: Props) {
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {FILTERS.map((filter) => {
          const selected = activeFilter === filter.id;
          const count = counts[filter.countKey];
          const showCount = filter.id !== "all" && count > 0;
          const label = showCount ? `${filter.label} ${count}` : filter.label;

          return (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: `${colors.primary}24`, borderColor: `${colors.primary}55` }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => onChange(filter.id)}
              activeOpacity={0.82}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selected ? colors.primary : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 4,
  },
  scroll: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
