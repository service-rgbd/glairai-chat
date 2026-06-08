import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Image as RNImage,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DOODLE_BG = require("@/assets/images/wallpapers/chat-doodle.png");

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.root}>
      <RNImage source={DOODLE_BG} resizeMode="repeat" style={StyleSheet.absoluteFill} />

      <LinearGradient
        colors={["rgba(15,10,35,0.12)", "rgba(15,10,35,0.55)", "rgba(10,8,24,0.92)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: topPad + 32, paddingBottom: bottomPad + 28 }]}>
        <View style={styles.hero}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            contentFit="cover"
          />
          <Image
            source={require("@/assets/images/gbairai-title.png")}
            style={styles.titleImage}
            contentFit="contain"
            accessibilityLabel="Gbairai"
          />
          <Text style={styles.tagline}>Messagerie chiffrée de bout en bout</Text>
          <Text style={styles.subtext}>Anonymat garanti.</Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(auth)/phone")}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>Commencer</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            En continuant, vous acceptez nos{" "}
            <Text style={styles.link}>Conditions</Text>
            {" et notre "}
            <Text style={styles.link}>Politique de confidentialité</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1a1033",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingBottom: 48,
  },
  logo: {
    width: 198,
    height: 198,
    borderRadius: 99,
  },
  titleImage: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1024 / 500,
    marginTop: -4,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    letterSpacing: 0.1,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  subtext: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.48)",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 24,
    marginTop: -4,
  },
  footer: {
    gap: 16,
    marginBottom: 56,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#1a1033",
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.38)",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 12,
  },
  link: {
    color: "rgba(255,255,255,0.58)",
    fontFamily: "Inter_500Medium",
  },
});
