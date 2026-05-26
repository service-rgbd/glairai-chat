import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = "Rechercher..." }: SearchBarProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.input, borderColor: colors.border }]}>
      <Feather name="search" size={18} color={colors.mutedForeground} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
