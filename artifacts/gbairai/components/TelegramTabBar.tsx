import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useChats } from "@/contexts/chats-context-ref";
import { openGlobalSearch } from "@/lib/navigation";

const ACTIVE = "#3390EC";
const INACTIVE = "#FFFFFF";
const BADGE_RED = "#FF3B30";

const VISIBLE_TABS = ["contacts", "calls", "index", "status", "settings"] as const;

type TabMeta = {
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
};

const TAB_META: Record<string, TabMeta> = {
  contacts: { activeIcon: "person-circle", inactiveIcon: "person-circle-outline" },
  calls: { activeIcon: "call", inactiveIcon: "call-outline" },
  index: { activeIcon: "chatbubbles", inactiveIcon: "chatbubbles-outline" },
  status: { activeIcon: "albums", inactiveIcon: "albums-outline" },
  settings: { activeIcon: "settings", inactiveIcon: "settings-outline" },
};

export function TelegramTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { chats, missedCallsUnreadCount } = useChats();

  const unreadTotal = useMemo(
    () => chats.reduce((sum, chat) => sum + (chat.unreadCount ?? 0), 0),
    [chats],
  );

  const focusedRouteName = state.routes[state.index]?.name;
  const visibleRoutes = VISIBLE_TABS.map((name) => state.routes.find((route) => route.name === name)).filter(
    (route): route is (typeof state.routes)[number] => Boolean(route),
  );

  const pillBg = "#000000";
  const pillBorder = "rgba(255,255,255,0.14)";
  const activeHighlight = "rgba(255,255,255,0.10)";
  const inactiveTint = INACTIVE;
  const labelInactive = INACTIVE;

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 10) + 4, paddingHorizontal: 14 },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.capsule, { backgroundColor: pillBg, borderColor: pillBorder }]}>
        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const isFocused = focusedRouteName === route.name;
          const label = options.title ?? route.name;
          const meta = TAB_META[route.name];
          const tint = isFocused ? ACTIVE : inactiveTint;
          const labelColor = isFocused ? ACTIVE : labelInactive;

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

          const iconName =
            meta != null
              ? isFocused
                ? meta.activeIcon
                : meta.inactiveIcon
              : "ellipse-outline";

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.75}
              style={styles.tab}
            >
              <View
                style={[
                  styles.tabInner,
                  isFocused ? { backgroundColor: activeHighlight } : null,
                ]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={iconName} size={22} color={tint} />
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

      <TouchableOpacity
        style={[styles.searchBtn, { backgroundColor: pillBg, borderColor: pillBorder }]}
        activeOpacity={0.75}
        onPress={openGlobalSearch}
        accessibilityRole="button"
        accessibilityLabel="Rechercher"
      >
        <Ionicons name="search" size={22} color={INACTIVE} />
      </TouchableOpacity>
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
  capsule: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 6,
    minHeight: 62,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 6,
    minWidth: 48,
    gap: 2,
  },
  iconWrap: {
    width: 28,
    height: 24,
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
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
});
