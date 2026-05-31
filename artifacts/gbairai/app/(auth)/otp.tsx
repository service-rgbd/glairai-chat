import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthLogo } from "@/components/AuthLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { isOtpDemoDevMode } from "@/lib/api-config";

const CODE_LENGTH = 6;

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pendingOtpCode, pendingPhone, requestOtpForPhone, pendingCountryCode, verifyPendingOtp } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(59);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isOtpDemoDevMode() || !pendingOtpCode || pendingOtpCode.length !== CODE_LENGTH) {
      return;
    }
    setDigits(pendingOtpCode.split("").slice(0, CODE_LENGTH));
  }, [pendingOtpCode]);

  useEffect(() => {
    const code = digits.join("");
    if (code.length === CODE_LENGTH) {
      handleVerify(code);
    }
  }, [digits]);

  const handleDigit = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[index] = digit;
    setDigits(updated);
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      const updated = [...digits];
      updated[index - 1] = "";
      setDigits(updated);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (_code: string) => {
    setLoading(true);
    try {
      const user = await verifyPendingOtp(_code);
      setTimeout(() => {
        router.replace(user.isOnboarded ? "/" : "/(auth)/profile-setup");
      }, 0);
    } catch (error) {
      Alert.alert(
        "Code invalide",
        error instanceof Error ? error.message : "Impossible de vérifier le code",
      );
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const isFull = digits.every((d) => d !== "");

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.content, { paddingTop: topPad + 20, paddingBottom: bottomPad + 24 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Retour</Text>
        </TouchableOpacity>

        <View style={styles.logoSection}>
          <AuthLogo size={128} />
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Vérification</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Code envoyé au{"\n"}
            <Text style={[styles.phone, { color: colors.text }]}>{pendingPhone || "+224 6XX XXX XXX"}</Text>
          </Text>
        </View>

        {isOtpDemoDevMode() ? (
          pendingOtpCode ? (
            <View style={[styles.demoBox, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <Text style={[styles.demoLabel, { color: colors.mutedForeground }]}>Code de test</Text>
              <Text style={[styles.demoCodeValue, { color: colors.primary }]}>{pendingOtpCode}</Text>
              <Text style={[styles.demoHint, { color: colors.mutedForeground }]}>
                Saisi automatiquement — validez ou corrigez ci-dessous.
              </Text>
            </View>
          ) : (
            <View style={[styles.demoBox, { backgroundColor: colors.card, borderColor: colors.destructive }]}>
              <Text style={[styles.demoLabel, { color: colors.mutedForeground }]}>Code de test</Text>
              <Text style={[styles.demoHint, { color: colors.mutedForeground }]}>
                En attente du code API…
              </Text>
            </View>
          )
        ) : null}

        <View style={styles.codeRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputRefs.current[i] = r; }}
              style={[
                styles.cell,
                {
                  color: colors.text,
                  borderColor: digit ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              value={digit}
              onChangeText={(v) => handleDigit(i, v)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={i === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        <View style={styles.resend}>
          {countdown > 0 ? (
            <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
              Renvoyer dans <Text style={{ color: colors.primary }}>0:{countdown.toString().padStart(2, "0")}</Text>
            </Text>
          ) : (
            <TouchableOpacity
              onPress={async () => {
                if (!pendingPhone) return;
                try {
                  setCountdown(59);
                  await requestOtpForPhone(pendingPhone, pendingCountryCode);
                } catch (error) {
                  Alert.alert(
                    "Envoi impossible",
                    error instanceof Error ? error.message : "Impossible de renvoyer le code",
                  );
                }
              }}
            >
              <Text style={[styles.resendText, { color: colors.primary }]}>Renvoyer le code</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isFull ? colors.primary : colors.muted }]}
          onPress={() => handleVerify(digits.join(""))}
          disabled={!isFull || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: isFull ? "#fff" : colors.mutedForeground }]}>Vérifier</Text>
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
    gap: 24,
  },
  backBtn: { alignSelf: "flex-start" },
  backText: { fontSize: 17, fontFamily: "Inter_500Medium" },
  logoSection: {
    alignItems: "center",
    paddingVertical: 8,
  },
  header: { gap: 10 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 24 },
  phone: { fontFamily: "Inter_600SemiBold" },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  cell: {
    width: 48,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  resend: { alignItems: "center" },
  resendText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  demoBox: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 4,
  },
  demoLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  demoCodeValue: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 6 },
  demoHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 17,
    marginTop: 4,
  },
  btn: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: "auto",
  },
  btnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});
