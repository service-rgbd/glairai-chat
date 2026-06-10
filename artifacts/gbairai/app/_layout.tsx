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
import { AuthenticatedIncomingCallOverlay } from "@/components/AuthenticatedIncomingCallOverlay";
import { AuthenticatedNativeCallController } from "@/components/AuthenticatedNativeCallController";
import { PersistedQueryProvider } from "@/components/PersistedQueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatsProvider } from "@/contexts/ChatsContext";
import { ChannelsProvider } from "@/modules/channels/context/ChannelsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { queryClient } from "@/lib/query-client";
import { getApiBaseUrl } from "@/lib/api-config";
import { setupPushNotificationRouting } from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

function RootAppBody() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthenticatedIncomingCallOverlay />
      <AuthenticatedNativeCallController />
      <RootStack />
    </GestureHandlerRootView>
  );
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
      <Stack.Screen name="channel/create" />
      <Stack.Screen name="channel/[id]" />
      <Stack.Screen name="channel/[id]/settings" />
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
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <PersistedQueryProvider>
                <ChatsProvider>
                  <ChannelsProvider>
                    <RootAppBody />
                  </ChannelsProvider>
                </ChatsProvider>
              </PersistedQueryProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
