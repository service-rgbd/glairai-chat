import { Image, type ImageSource } from "expo-image";
import React from "react";
import {
  StyleSheet,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = {
  source: ImageSource;
  size?: number;
  focused?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Icônes emoji PNG — fond clair en mode sombre pour rester lisibles sur blur / fond dark. */
export function EmojiNavImage({ source, size = 28, focused = false, style }: Props) {
  const isDark = useColorScheme() === "dark";

  if (!isDark) {
    return (
      <Image
        source={source}
        style={[{ width: size, height: size }, style]}
        contentFit="contain"
      />
    );
  }

  const pad = 3;
  const outer = size + pad * 2;

  return (
    <View
      style={[
        styles.plate,
        {
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          backgroundColor: focused ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.16)",
        },
        style,
      ]}
    >
      <Image source={source} style={{ width: size, height: size }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignItems: "center",
    justifyContent: "center",
  },
});
