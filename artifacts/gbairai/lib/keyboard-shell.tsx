import React from "react";

import { isExpoGo } from "@/lib/runtime-env";

type ProviderProps = { children: React.ReactNode };
type KeyboardProviderComponent = React.ComponentType<ProviderProps>;
type KeyboardAvoidingViewComponent = React.ComponentType<
  React.ComponentProps<typeof import("react-native").KeyboardAvoidingView>
>;

let KeyboardProvider: KeyboardProviderComponent | null = null;
let KeyboardAvoidingView: KeyboardAvoidingViewComponent | null = null;

const keyboardControllerEnabled =
  process.env.EXPO_PUBLIC_KEYBOARD_CONTROLLER === "true" && !isExpoGo();

if (keyboardControllerEnabled) {
  try {
    const module = require("react-native-keyboard-controller") as {
      KeyboardProvider: KeyboardProviderComponent;
      KeyboardAvoidingView: KeyboardAvoidingViewComponent;
    };
    KeyboardProvider = module.KeyboardProvider;
    KeyboardAvoidingView = module.KeyboardAvoidingView;
    if (__DEV__) {
      console.log("[Gbairai] keyboard-controller actif");
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[Gbairai] keyboard-controller indisponible", error);
    }
  }
} else if (__DEV__ && !isExpoGo()) {
  console.log("[Gbairai] keyboard-controller désactivé (KeyboardAvoidingView natif)");
}

export function AppKeyboardProvider({
  children,
  enabled = true,
}: ProviderProps & { enabled?: boolean }) {
  if (!enabled || !KeyboardProvider || isExpoGo()) {
    return <>{children}</>;
  }

  return <KeyboardProvider>{children}</KeyboardProvider>;
}

export function getKeyboardAvoidingViewComponent() {
  return KeyboardAvoidingView;
}
