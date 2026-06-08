import React from "react";

import { isExpoGo } from "@/lib/runtime-env";

type ProviderProps = { children: React.ReactNode };
type KeyboardProviderComponent = React.ComponentType<ProviderProps>;
type KeyboardAvoidingViewComponent = React.ComponentType<
  React.ComponentProps<typeof import("react-native").KeyboardAvoidingView>
>;

let KeyboardProvider: KeyboardProviderComponent | null = null;
let KeyboardAvoidingView: KeyboardAvoidingViewComponent | null = null;

if (!isExpoGo()) {
  try {
    // Chargé une seule fois au démarrage pour éviter un remount global tardif.
    const module = require("react-native-keyboard-controller") as {
      KeyboardProvider: KeyboardProviderComponent;
      KeyboardAvoidingView: KeyboardAvoidingViewComponent;
    };
    KeyboardProvider = module.KeyboardProvider;
    KeyboardAvoidingView = module.KeyboardAvoidingView;
  } catch {
    // Module natif indisponible (web, tests).
  }
}

export function AppKeyboardProvider({ children }: ProviderProps) {
  if (!KeyboardProvider || isExpoGo()) {
    return <>{children}</>;
  }

  return <KeyboardProvider>{children}</KeyboardProvider>;
}

export function getKeyboardAvoidingViewComponent() {
  return KeyboardAvoidingView;
}
