import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0F172A", "#1a0e3d", "#0a0a1a"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      <View style={[styles.content, { paddingTop: topPad + 40, paddingBottom: bottomPad + 24 }]}>
        <View style={styles.logoSection}>
          <View style={styles.logoGlow}>
            <LinearGradient
              colors={["#6D4AFF", "#00D4A4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoLetter}>G</Text>
            </LinearGradient>
          </View>
          <Text style={styles.appName}>Gbairai</Text>
          <Text style={styles.tagline}>Connectez-vous. Communiquez.{"\n"}Créez.</Text>
        </View>

        <View style={styles.features}>
          {["Messages instantanés", "Appels audio & vidéo", "Statuts & Stories"].map((f) => (
            <View key={f} style={styles.featureRow}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>{f}</Text>
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
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
    gap: 16,
  },
  logoGlow: {
    shadowColor: "#6D4AFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
    elevation: 20,
  },
  logoGradient: {
    width: 110,
    height: 110,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  logoLetter: {
    fontSize: 60,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  appName: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 26,
  },
  features: {
    gap: 14,
    paddingVertical: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00D4A4",
  },
  featureText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
  },
  actions: {
    gap: 16,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: "hidden",
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
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    lineHeight: 18,
  },
  link: {
    color: "#9B7FFF",
  },
});
