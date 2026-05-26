import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>Discussions</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="status">
        <Icon sf={{ default: "circle.dotted", selected: "circle.fill" }} />
        <Label>Statuts</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calls">
        <Icon sf={{ default: "phone", selected: "phone.fill" }} />
        <Label>Appels</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>Réglages</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 60,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBarBg }]} />
          ) : null,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_500Medium",
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discussions",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color} />
            ) : (
              <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: "Statuts",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "aperture" : "aperture-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Appels",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "call" : "call-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Réglages",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
