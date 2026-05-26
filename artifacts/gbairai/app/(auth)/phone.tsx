import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setPendingPhone } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const formatted = phone.replace(/\D/g, "").slice(0, 9);

  const handleContinue = async () => {
    if (formatted.length < 8) return;
    setLoading(true);
    const fullPhone = `+224 ${formatted.slice(0, 3)} ${formatted.slice(3, 6)} ${formatted.slice(6)}`;
    setPendingPhone(fullPhone);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    router.push("/(auth)/otp");
  };

  const isValid = formatted.length >= 8;

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.content, { paddingTop: topPad + 20, paddingBottom: bottomPad + 24 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Retour</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Votre numéro</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Entrez votre numéro de téléphone pour recevoir un code de vérification.
          </Text>
        </View>

        <View style={styles.inputSection}>
          <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={[styles.countryCode, { borderRightColor: colors.border }]}>
              <Text style={[styles.flag]}>🇬🇳</Text>
              <Text style={[styles.code, { color: colors.text }]}>+224</Text>
            </View>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="6XX XXX XXX"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              value={formatted}
              onChangeText={setPhone}
              maxLength={9}
              autoFocus
            />
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Un SMS avec un code à 6 chiffres sera envoyé à ce numéro.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isValid ? colors.primary : colors.muted }]}
          onPress={handleContinue}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: isValid ? "#fff" : colors.mutedForeground }]}>
              Recevoir le code
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 32,
  },
  backBtn: { alignSelf: "flex-start" },
  backText: { fontSize: 17, fontFamily: "Inter_500Medium" },
  header: { gap: 10 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  inputSection: { gap: 12 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: "hidden",
    height: 56,
  },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRightWidth: 1,
    height: "100%",
    gap: 6,
  },
  flag: { fontSize: 22 },
  code: { fontSize: 16, fontFamily: "Inter_500Medium" },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 14,
    height: "100%",
    letterSpacing: 1,
  },
  hint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  btn: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: "auto",
  },
  btnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});
