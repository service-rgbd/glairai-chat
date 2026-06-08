import React from "react";
import { Platform, ScrollView, ScrollViewProps } from "react-native";

import { isExpoGo } from "@/lib/runtime-env";

type Props = ScrollViewProps;

/** Expo Go : ScrollView natif. Dev build : KeyboardAwareScrollView si disponible. */
export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web" || isExpoGo()) {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }

  const [KeyboardAwareScrollView, setKeyboardAwareScrollView] =
    React.useState<React.ComponentType<Props> | null>(null);

  React.useEffect(() => {
    void import("react-native-keyboard-controller").then((module) => {
      setKeyboardAwareScrollView(
        () => module.KeyboardAwareScrollView as React.ComponentType<Props>,
      );
    });
  }, []);

  if (!KeyboardAwareScrollView) {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
      {children}
    </KeyboardAwareScrollView>
  );
}
