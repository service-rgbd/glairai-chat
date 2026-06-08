import "react-native-gesture-handler";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthenticatedNativeCallController } from "@/components/AuthenticatedNativeCallController";
import { IncomingCallOverlay } from "@/components/IncomingCallOverlay";
import { PersistedQueryProvider } from "@/components/PersistedQueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatsProvider } from "@/contexts/ChatsContext";
import { AppKeyboardProvider } from "@/lib/keyboard-shell";
import { queryClient } from "@/lib/query-client";
import { getApiBaseUrl } from "@/lib/api-config";
import { setupPushNotificationRouting } from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

function AppShell({ children }: { children: React.ReactNode }) {
  return <AppKeyboardProvider>{children}</AppKeyboardProvider>;
}

function RootStack() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="group/join" />
      <Stack.Screen name="media-viewer" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="call/[conversationId]" />
      <Stack.Screen name="story/[id]" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="profile/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (__DEV__) {
      console.log("[Gbairai] démarrage — API:", getApiBaseUrl());
    }
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    return setupPushNotificationRouting();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PersistedQueryProvider>
              <ChatsProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <AppShell>
                    <IncomingCallOverlay />
                    <AuthenticatedNativeCallController />
                    <RootStack />
                  </AppShell>
                </GestureHandlerRootView>
              </ChatsProvider>
            </PersistedQueryProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
