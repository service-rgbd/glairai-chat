import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
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

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { countries, pendingCountryCode, requestOtpForPhone } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState(pendingCountryCode);

  useEffect(() => {
    if (pendingCountryCode) {
      setSelectedCountryCode(pendingCountryCode);
    }
  }, [pendingCountryCode]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const selectedCountry =
    countries.find((item) => item.code === selectedCountryCode) ?? countries[0];
  const digitsOnly = phone.replace(/\D/g, "").slice(0, 15);
  const formatted = digitsOnly.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  const filteredCountries = countries.filter((country) => {
    const haystack = `${country.name} ${country.callingCode} ${country.code}`.toLowerCase();
    return haystack.includes(countrySearch.toLowerCase());
  });

  const handleContinue = async () => {
    if (!selectedCountry || digitsOnly.length < 6) return;
    setLoading(true);
    try {
      const fullPhone = `${selectedCountry.callingCode}${digitsOnly}`;
      await requestOtpForPhone(fullPhone, selectedCountry.code);
      Keyboard.dismiss();
      InteractionManager.runAfterInteractions(() => {
        router.push("/(auth)/otp");
      });
    } catch (error) {
      Alert.alert(
        "Envoi impossible",
        error instanceof Error ? error.message : "Impossible d'envoyer le code de vérification",
      );
    } finally {
      setLoading(false);
    }
  };

  const isValid = Boolean(selectedCountry) && digitsOnly.length >= 6;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? topPad : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad + 20, paddingBottom: 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/(auth)/welcome")}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Retour</Text>
        </TouchableOpacity>

        <View style={styles.logoSection}>
          <AuthLogo size={112} />
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Votre numéro</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Entrez votre numéro de téléphone pour recevoir un code de vérification.
          </Text>
        </View>

        <View style={styles.inputSection}>
          <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[styles.countryCode, { borderRightColor: colors.border }]}
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.flag}>{selectedCountry?.flag ?? "🌍"}</Text>
              <Text style={[styles.code, { color: colors.text }]}>
                {selectedCountry?.callingCode ?? "+000"}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Numéro"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              value={formatted}
              onChangeText={setPhone}
              maxLength={19}
              autoFocus
            />
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Tous les pays et indicatifs sont disponibles. Un code à 6 chiffres sera envoyé à ce numéro.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPad + 16 }]}>
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

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background, paddingTop: topPad + 12 }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choisir un pays</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)} activeOpacity={0.7}>
              <Text style={[styles.backText, { color: colors.primary }]}>Fermer</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[styles.searchInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
            placeholder="Rechercher un pays ou un indicatif"
            placeholderTextColor={colors.mutedForeground}
            value={countrySearch}
            onChangeText={setCountrySearch}
          />

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.countryItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedCountryCode(item.code);
                  setPickerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.countryInfo}>
                  <Text style={[styles.countryName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.countrySub, { color: colors.mutedForeground }]}>
                    {item.callingCode} • {item.code}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  backBtn: { alignSelf: "flex-start" },
  backText: { fontSize: 17, fontFamily: "Inter_500Medium" },
  logoSection: {
    alignItems: "center",
    paddingVertical: 4,
  },
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
  modalRoot: { flex: 1, paddingHorizontal: 20, gap: 16 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  searchInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countryInfo: { flex: 1 },
  countryName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  countrySub: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  btn: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  btnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});
