import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export interface ChatOptionItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

interface ChatOptionsSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  options: ChatOptionItem[];
  onClose: () => void;
  /** Menu ancré sous l'en-tête (chat) ou feuille en bas (liste). */
  placement?: "bottom" | "top";
  /** Décalage depuis le haut pour `placement="top"`. */
  anchorTopOffset?: number;
}

export function ChatOptionsSheet({
  visible,
  title,
  subtitle = "Que souhaitez-vous faire ?",
  options,
  onClose,
  placement = "bottom",
  anchorTopOffset,
}: ChatOptionsSheetProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topOffset = anchorTopOffset ?? insets.top + 12;
  const isTopMenu = placement === "top";

  const handleOptionPress = (option: ChatOptionItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    option.onPress();
  };

  const regularOptions = options.filter((option) => !option.destructive);
  const destructiveOptions = options.filter((option) => option.destructive);

  const renderOption = (option: ChatOptionItem) => {
    const accent = option.destructive ? colors.destructive : colors.primary;
    return (
      <TouchableOpacity
        key={option.key}
        style={[
          styles.actionRow,
          isTopMenu ? styles.actionRowCompact : null,
          { backgroundColor: isTopMenu ? "transparent" : colors.background },
        ]}
        onPress={() => handleOptionPress(option)}
        activeOpacity={0.78}
      >
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: option.destructive ? `${colors.destructive}14` : `${colors.primary}12`,
            },
          ]}
        >
          <Ionicons name={option.icon} size={19} color={accent} />
        </View>
        <Text
          style={[
            styles.actionText,
            { color: option.destructive ? colors.destructive : colors.text },
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const menuCard = (
    <Pressable
      style={[
        styles.menuCard,
        isTopMenu ? styles.menuCardTop : styles.menuCardBottom,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: scheme === "dark" ? "#000" : "#64748B",
        },
      ]}
      onPress={(event) => event.stopPropagation()}
    >
      {!isTopMenu ? (
        <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
      ) : null}

      {title ? (
        <View style={[styles.headerBlock, isTopMenu ? styles.headerBlockTop : null]}>
          {subtitle ? (
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : null}

      <View style={styles.optionsList}>
        {regularOptions.map((option) => renderOption(option))}
        {destructiveOptions.length > 0 && regularOptions.length > 0 ? (
          <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
        ) : null}
        {destructiveOptions.map((option) => renderOption(option))}
      </View>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isTopMenu ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <View style={[styles.root, isTopMenu ? styles.rootTop : styles.rootBottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={isTopMenu ? 22 : 28}
              tint={scheme === "dark" ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={[styles.backdropTint, isTopMenu ? styles.backdropTintLight : null]} />
        </Pressable>

        {isTopMenu ? (
          <View style={[styles.topAnchor, { paddingTop: topOffset }]} pointerEvents="box-none">
            {menuCard}
          </View>
        ) : (
          <View style={[styles.footer, { paddingBottom: bottomPad + 12 }]} pointerEvents="box-none">
            {menuCard}
            <TouchableOpacity
              style={[
                styles.cancelSheet,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: scheme === "dark" ? "#000" : "#64748B",
                },
              ]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              activeOpacity={0.82}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootBottom: {
    justifyContent: "flex-end",
  },
  rootTop: {
    justifyContent: "flex-start",
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
  },
  backdropTintLight: {
    backgroundColor: "rgba(15, 23, 42, 0.22)",
  },
  footer: {
    paddingHorizontal: 14,
    gap: 10,
  },
  topAnchor: {
    alignItems: "flex-end",
    paddingHorizontal: 12,
  },
  menuCard: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 14,
    overflow: "hidden",
  },
  menuCardBottom: {
    borderRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
    width: "100%",
  },
  menuCardTop: {
    borderRadius: 18,
    paddingTop: 12,
    paddingHorizontal: 8,
    paddingBottom: 8,
    minWidth: 248,
    maxWidth: 300,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    opacity: 0.35,
    marginBottom: 10,
  },
  headerBlock: {
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 2,
  },
  headerBlockTop: {
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  optionsList: {
    gap: 2,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
    marginHorizontal: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionRowCompact: {
    paddingVertical: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cancelSheet: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
