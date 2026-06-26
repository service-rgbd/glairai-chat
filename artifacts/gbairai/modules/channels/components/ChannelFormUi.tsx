import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export function ChannelScreenHeader(props: {
  title: string;
  topPad: number;
  onBack: () => void;
  backIcon?: keyof typeof Ionicons.glyphMap;
  rightSlot?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.header, { paddingTop: props.topPad + 8, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={props.onBack} style={styles.headerIconBtn} activeOpacity={0.75}>
        <Ionicons name={props.backIcon ?? "chevron-back"} size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
        {props.title}
      </Text>
      <View style={styles.headerIconBtn}>{props.rightSlot ?? null}</View>
    </View>
  );
}

export function ChannelHeroCard(props: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  const colors = useColors();
  return (
    <LinearGradient
      colors={["#6D4AFF", "#4F46E5", "#0EA5E9"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      {props.badge ? (
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{props.badge}</Text>
        </View>
      ) : null}
      <Text style={styles.heroTitle}>{props.title}</Text>
      <Text style={styles.heroSubtitle}>{props.subtitle}</Text>
      <View style={[styles.heroGlow, { backgroundColor: `${colors.primary}22` }]} />
    </LinearGradient>
  );
}

export function ChannelSection(props: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{props.title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {props.children}
      </View>
    </View>
  );
}

export function ChannelFormField(props: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  inputProps?: TextInputProps;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{props.label}</Text>
        {props.maxLength ? (
          <Text style={[styles.fieldCounter, { color: colors.mutedForeground }]}>
            {props.value.length}/{props.maxLength}
          </Text>
        ) : null}
      </View>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={props.multiline}
        maxLength={props.maxLength}
        style={[
          styles.input,
          props.multiline ? styles.textArea : null,
          { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
        ]}
        {...props.inputProps}
      />
      {props.hint ? (
        <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>{props.hint}</Text>
      ) : null}
    </View>
  );
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Organisations: "business-outline",
  Sport: "football-outline",
  "Style De Vie": "leaf-outline",
  Divertissement: "musical-notes-outline",
};

export function ChannelCategoryPicker(props: {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.categoryGrid}>
      {props.categories.map((item) => {
        const active = props.value === item;
        const icon = CATEGORY_ICONS[item] ?? "pricetag-outline";
        return (
          <TouchableOpacity
            key={item}
            style={[
              styles.categoryTile,
              {
                backgroundColor: active ? `${colors.primary}14` : colors.background,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
            onPress={() => props.onChange(item)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.categoryIconWrap,
                { backgroundColor: active ? colors.primary : `${colors.primary}18` },
              ]}
            >
              <Ionicons name={icon} size={18} color={active ? "#fff" : colors.primary} />
            </View>
            <Text
              style={[
                styles.categoryLabel,
                { color: active ? colors.primary : colors.text },
              ]}
              numberOfLines={2}
            >
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ChannelMenuRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  destructive?: boolean;
  onPress?: () => void;
  showDivider?: boolean;
}) {
  const colors = useColors();
  const accent = props.destructive ? colors.destructive : colors.primary;
  const content = (
    <>
      <View style={[styles.menuIcon, { backgroundColor: `${accent}14` }]}>
        <Ionicons name={props.icon} size={18} color={accent} />
      </View>
      <Text
        style={[styles.menuLabel, { color: props.destructive ? colors.destructive : colors.text }]}
      >
        {props.label}
      </Text>
      {props.value ? (
        <Text style={[styles.menuValue, { color: colors.mutedForeground }]} numberOfLines={1}>
          {props.value}
        </Text>
      ) : props.onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      ) : null}
    </>
  );

  if (!props.onPress) {
    return (
      <View style={[styles.menuRow, props.showDivider ? styles.menuRowDivider : null]}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.menuRow, props.showDivider ? styles.menuRowDivider : null]}
      onPress={props.onPress}
      activeOpacity={0.78}
    >
      {content}
    </TouchableOpacity>
  );
}

export function ChannelPrimaryButton(props: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const colors = useColors();
  const backgroundColor = props.destructive ? colors.destructive : colors.primary;
  return (
    <TouchableOpacity
      style={[
        styles.primaryBtn,
        { backgroundColor, opacity: props.disabled || props.loading ? 0.7 : 1 },
      ]}
      onPress={props.onPress}
      disabled={props.disabled || props.loading}
      activeOpacity={0.85}
    >
      {props.loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryBtnText}>{props.label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 8,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    gap: 8,
    minHeight: 132,
    justifyContent: "flex-end",
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -60,
    right: -40,
    opacity: 0.35,
  },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 14,
  },
  field: { gap: 8 },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  fieldCounter: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 11,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    minHeight: 108,
    textAlignVertical: "top",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryTile: {
    width: "47%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  categoryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  menuRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.25)",
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  menuValue: {
    maxWidth: 120,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
