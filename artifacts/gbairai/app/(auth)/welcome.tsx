import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FEATURES = [
  { label: "Messages instantanés", icon: "chatbubbles" as const },
  { label: "Appels audio & vidéo", icon: "call" as const },
  { label: "Statuts & Stories", icon: "albums" as const },
];

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.root}>
      <Image
        source={require("@/assets/images/welcome-bg.png")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
      />

      <LinearGradient
        colors={["rgba(15,23,42,0.55)", "rgba(15,23,42,0.82)", "rgba(10,10,26,0.96)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: topPad + 48, paddingBottom: bottomPad + 20 }]}>
        <View style={styles.hero}>
          <View style={styles.logoRing}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logoImage}
              contentFit="cover"
            />
          </View>
          <Text style={styles.appName}>Gbairai</Text>
          <Text style={styles.tagline}>Connectez-vous. Communiquez.{"\n"}Créez.</Text>
        </View>

        <View style={styles.featuresCard}>
          {FEATURES.map((feature, index) => (
            <View
              key={feature.label}
              style={[
                styles.featureRow,
                index < FEATURES.length - 1 && styles.featureRowBorder,
              ]}
            >
              <View style={styles.featureIconWrap}>
                <Ionicons name={feature.icon} size={20} color="#8B6FFF" />
              </View>
              <Text style={styles.featureText}>{feature.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(auth)/phone")}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#6D4AFF", "#8B6FFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtnGrad}
            >
              <Text style={styles.primaryBtnText}>Commencer</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            En continuant, vous acceptez nos{" "}
            <Text style={styles.link}>Conditions d'utilisation</Text>
            {" "}et notre{" "}
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
    backgroundColor: "#0F172A",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  hero: {
    alignItems: "center",
    gap: 14,
  },
  logoRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    padding: 3,
    backgroundColor: "rgba(109,74,255,0.35)",
    shadowColor: "#6D4AFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 53,
  },
  appName: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.8,
  },
  tagline: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    lineHeight: 24,
  },
  featuresCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  featureRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(109,74,255,0.18)",
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.9)",
  },
  actions: {
    gap: 14,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#6D4AFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnGrad: {
    paddingVertical: 17,
    alignItems: "center",
    borderRadius: 16,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  disclaimer: {
    fontSize: 12,
    color: "rgba(255,255,255,0.38)",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  link: {
    color: "#9B7FFF",
  },
});
