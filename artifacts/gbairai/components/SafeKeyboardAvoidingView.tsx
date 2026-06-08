import React from "react";
import { KeyboardAvoidingView as NativeKeyboardAvoidingView, Platform, type KeyboardAvoidingViewProps } from "react-native";

import { isExpoGo } from "@/lib/runtime-env";

type Props = KeyboardAvoidingViewProps & { children: React.ReactNode };

export function SafeKeyboardAvoidingView(props: Props) {
  if (isExpoGo()) {
    return (
      <NativeKeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        {...props}
      />
    );
  }

  const [KeyboardAvoidingView, setKeyboardAvoidingView] =
    React.useState<React.ComponentType<Props> | null>(null);

  React.useEffect(() => {
    void import("react-native-keyboard-controller").then((module) => {
      setKeyboardAvoidingView(() => module.KeyboardAvoidingView as React.ComponentType<Props>);
    });
  }, []);

  if (!KeyboardAvoidingView) {
    return (
      <NativeKeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        {...props}
      />
    );
  }

  return <KeyboardAvoidingView {...props} />;
}
