import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import type { ImageSource } from "expo-image";
import React, { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmojiNavImage } from "@/components/EmojiNavImage";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { openGlobalSearch } from "@/lib/navigation";

const ACTIVE = "#3390EC";
const BADGE_RED = "#FF3B30";
const DARK_ICON = "#FFFFFF";

const VISIBLE_TABS = ["channels", "calls", "index", "status", "settings"] as const;

const TAB_ICONS: Record<string, ImageSource> = {
  calls: require("@/assets/images/nav/calls.png"),
  index: require("@/assets/images/nav/chats.png"),
  status: require("@/assets/images/nav/status.png"),
  settings: require("@/assets/images/nav/settings.png"),
};

const TAB_ION: Record<
  string,
  { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }
> = {
  channels: { outline: "megaphone-outline", filled: "megaphone" },
  calls: { outline: "call-outline", filled: "call" },
  index: { outline: "chatbubbles-outline", filled: "chatbubbles" },
  status: { outline: "disc-outline", filled: "disc" },
  settings: { outline: "settings-outline", filled: "settings" },
};

function GlassSurface({
  children,
  style,
  isDark,
}: {
  children: React.ReactNode;
  style?: object;
  isDark: boolean;
}) {
  const overlay = isDark ? "rgba(22, 22, 24, 0.42)" : "rgba(255, 255, 255, 0.58)";
  const borderColor = isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.10)";

  return (
    <View style={[styles.glassShell, style, { borderColor }]}>
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={isDark ? 34 : 52}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
      <View style={styles.glassContent}>{children}</View>
    </View>
  );
}

export function TelegramTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const { chats, missedCallsUnreadCount } = useChats();

  const unreadTotal = useMemo(
    () => chats.reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0),
    [chats],
  );

  const focusedRouteName = state.routes[state.index]?.name;
  const visibleRoutes = VISIBLE_TABS.map((name) => state.routes.find((route) => route.name === name)).filter(
    (route): route is (typeof state.routes)[number] => Boolean(route),
  );

  const labelInactive = isDark ? "rgba(255,255,255,0.78)" : colors.mutedForeground;

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 10) + 4, paddingHorizontal: 14 },
      ]}
      pointerEvents="box-none"
    >
      <GlassSurface isDark={isDark} style={styles.capsule}>
        <View style={styles.capsuleRow}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = focusedRouteName === route.name;
          const label = options.title ?? route.name;
          const iconSource = TAB_ICONS[route.name];
          const ion = TAB_ION[route.name];
          const labelColor = isFocused ? ACTIVE : labelInactive;
          const iconColor = isFocused ? ACTIVE : isDark ? DARK_ICON : colors.mutedForeground;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const badgeFromOptions =
            typeof options.tabBarBadge === "number"
              ? options.tabBarBadge
              : typeof options.tabBarBadge === "string"
                ? options.tabBarBadge
                : null;
          const badge =
            route.name === "index" && unreadTotal > 0
              ? unreadTotal
              : route.name === "calls" && missedCallsUnreadCount > 0
                ? missedCallsUnreadCount
                : badgeFromOptions;

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.75}
              style={styles.tab}
            >
              <View style={styles.tabInner}>
                <View style={styles.iconWrap}>
                  {isDark && ion ? (
                    <Ionicons
                      name={isFocused ? ion.filled : ion.outline}
                      size={26}
                      color={iconColor}
                    />
                  ) : iconSource ? (
                    <EmojiNavImage
                      source={iconSource}
                      size={28}
                      focused={isFocused}
                      style={{ transform: [{ scale: isFocused ? 1.08 : 1 }] }}
                    />
                  ) : ion ? (
                    <Ionicons
                      name={isFocused ? ion.filled : ion.outline}
                      size={26}
                      color={iconColor}
                    />
                  ) : (
                    <Ionicons
                      name="ellipse-outline"
                      size={24}
                      color={iconColor}
                    />
                  )}
                  {badge != null && badge !== 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {typeof badge === "number" && badge > 99 ? "99+" : badge}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.label,
                    { color: labelColor, fontFamily: isFocused ? "Inter_600SemiBold" : "Inter_500Medium" },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        </View>
      </GlassSurface>

      <GlassSurface isDark={isDark} style={styles.searchBtn}>
        <TouchableOpacity
          style={styles.searchBtnInner}
          activeOpacity={0.75}
          onPress={openGlobalSearch}
          accessibilityRole="button"
          accessibilityLabel="Rechercher"
        >
          <Ionicons name="search" size={22} color={isDark ? DARK_ICON : colors.text} />
        </TouchableOpacity>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  glassShell: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
      },
      android: { elevation: 8 },
    }),
  },
  glassContent: {
    position: "relative",
    zIndex: 1,
  },
  capsule: {
    flex: 1,
    borderRadius: 999,
    minHeight: 62,
  },
  capsuleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    minHeight: 62,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    minWidth: 48,
    gap: 2,
  },
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 9,
    letterSpacing: 0.02,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -16,
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    backgroundColor: BADGE_RED,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    lineHeight: 12,
  },
  searchBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  searchBtnInner: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
});
