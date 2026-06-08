import React from "react";
import { KeyboardAvoidingView as NativeKeyboardAvoidingView, Platform, type KeyboardAvoidingViewProps } from "react-native";

import { isExpoGo } from "@/lib/runtime-env";

import { getKeyboardAvoidingViewComponent } from "@/lib/keyboard-shell";

type Props = KeyboardAvoidingViewProps & { children: React.ReactNode };

export function SafeKeyboardAvoidingView(props: Props) {
  const KeyboardAvoidingView = getKeyboardAvoidingViewComponent();

  if (!KeyboardAvoidingView || isExpoGo()) {
    return (
      <NativeKeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        {...props}
      />
    );
  }

  return <KeyboardAvoidingView {...props} />;
}
