import { Tabs } from "expo-router";
import React from "react";

import { TelegramTabBar } from "@/components/TelegramTabBar";

export default function MainTabLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <TelegramTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 88,
        },
      }}
    >
      <Tabs.Screen name="contacts" options={{ title: "Contacts", href: null }} />
      <Tabs.Screen name="channels" options={{ title: "Chaînes" }} />
      <Tabs.Screen name="calls" options={{ title: "Appels" }} />
      <Tabs.Screen name="index" options={{ title: "Échanges" }} />
      <Tabs.Screen name="status" options={{ title: "Statuts" }} />
      <Tabs.Screen name="settings" options={{ title: "Paramètres" }} />
    </Tabs>
  );
}
