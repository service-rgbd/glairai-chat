import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

type AuthLogoProps = {
  size?: number;
};

export function AuthLogo({ size = 120 }: AuthLogoProps) {
  const radius = size / 2;

  return (
    <View style={styles.container}>
      <View style={styles.glow}>
        <Image
          source={require("@/assets/images/logo.png")}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  glow: {
    shadowColor: "#6D4AFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },
});
