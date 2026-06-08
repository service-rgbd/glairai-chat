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
}

export function ChatOptionsSheet({
  visible,
  title,
  subtitle = "Que souhaitez-vous faire ?",
  options,
  onClose,
}: ChatOptionsSheetProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleOptionPress = (option: ChatOptionItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    option.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={28}
              tint={scheme === "dark" ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.backdropTint} />
        </Pressable>

        <View style={[styles.footer, { paddingBottom: bottomPad + 12 }]} pointerEvents="box-none">
          <Pressable
            style={[
              styles.mainSheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: scheme === "dark" ? "#000" : "#64748B",
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

            {title ? (
              <View style={styles.headerBlock}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.optionsGroup, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {options.map((option, index) => {
                const accent = option.destructive ? colors.destructive : colors.primary;
                return (
                  <React.Fragment key={option.key}>
                    {index > 0 ? (
                      <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    ) : null}
                    <TouchableOpacity
                      style={styles.actionRow}
                      onPress={() => handleOptionPress(option)}
                      activeOpacity={0.78}
                    >
                      <View
                        style={[
                          styles.iconBadge,
                          {
                            backgroundColor: option.destructive
                              ? `${colors.destructive}18`
                              : `${colors.primary}16`,
                          },
                        ]}
                      >
                        <Ionicons name={option.icon} size={20} color={accent} />
                      </View>
                      <Text
                        style={[
                          styles.actionText,
                          { color: option.destructive ? colors.destructive : colors.text },
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.mutedForeground}
                        style={styles.chevron}
                      />
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
          </Pressable>

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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
  },
  footer: {
    paddingHorizontal: 14,
    gap: 10,
  },
  mainSheet: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    opacity: 0.35,
    marginBottom: 12,
  },
  headerBlock: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 14,
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  optionsGroup: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  chevron: {
    opacity: 0.55,
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
