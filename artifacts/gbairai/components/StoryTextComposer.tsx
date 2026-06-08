import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafeKeyboardAvoidingView as KeyboardAvoidingView } from "@/components/SafeKeyboardAvoidingView";
import {
  STORY_TEXT_BACKGROUNDS,
  STORY_TEXT_FONTS,
  STORY_TEXT_MAX_LENGTH,
  type StoryTextFontId,
  containsBlockedStoryContent,
  sanitizeStoryText,
  storyTextColor,
  storyTextPlaceholderColor,
} from "@/lib/story-text";

type ComposerTab = "video" | "photo" | "text" | "voice";

interface StoryTextComposerProps {
  visible: boolean;
  isPublishing?: boolean;
  initialBackgroundColor?: string;
  onClose: () => void;
  onPublish: (payload: { text: string; backgroundColor: string }) => Promise<void>;
  onSelectPhoto: () => void;
  onSelectVideo: () => void;
  onSelectVoice: () => void;
}

const BOTTOM_BAR_BG = "#3D1515";
const PALETTE_BAR_BG = "#4A1D96";
const TAB_ACTIVE = "#FF9500";

export function StoryTextComposer({
  visible,
  isPublishing = false,
  initialBackgroundColor = STORY_TEXT_BACKGROUNDS[0],
  onClose,
  onPublish,
  onSelectPhoto,
  onSelectVideo,
  onSelectVoice,
}: StoryTextComposerProps) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [text, setText] = useState("");
  const [backgroundColor, setBackgroundColor] = useState(initialBackgroundColor);
  const [fontId, setFontId] = useState<StoryTextFontId>("inter-bold");
  const [showPalette, setShowPalette] = useState(false);
  const [showFonts, setShowFonts] = useState(false);

  const activeFont = useMemo(
    () => STORY_TEXT_FONTS.find((font) => font.id === fontId) ?? STORY_TEXT_FONTS[0],
    [fontId],
  );

  const textColor = storyTextColor(backgroundColor);
  const placeholderColor = storyTextPlaceholderColor(backgroundColor);
  const canPublish = text.trim().length > 0 && !isPublishing;

  useEffect(() => {
    if (!visible) {
      setText("");
      setBackgroundColor(initialBackgroundColor);
      setFontId("inter-bold");
      setShowPalette(false);
      setShowFonts(false);
      return;
    }
    setBackgroundColor(initialBackgroundColor);
  }, [initialBackgroundColor, visible]);

  const handleTextChange = (raw: string) => {
    if (containsBlockedStoryContent(raw)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Contenu non autorisé", "Les scripts et balises HTML ne sont pas autorisés.");
      return;
    }
    setText(sanitizeStoryText(raw));
  };

  const handlePublish = async () => {
    const trimmed = sanitizeStoryText(text).trim();
    if (!trimmed || isPublishing) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onPublish({ text: trimmed, backgroundColor });
  };

  const handleTabPress = (tab: ComposerTab) => {
    void Haptics.selectionAsync();
    if (tab === "text") return;
    if (tab === "photo") {
      onClose();
      onSelectPhoto();
      return;
    }
    if (tab === "video") {
      onClose();
      onSelectVideo();
      return;
    }
    onSelectVoice();
  };

  const tabs: { key: ComposerTab; label: string }[] = [
    { key: "video", label: "VIDÉO" },
    { key: "photo", label: "PHOTO" },
    { key: "text", label: "TEXTE" },
    { key: "voice", label: "VOIX" },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity style={styles.glassBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.topRight}>
            <TouchableOpacity
              style={[styles.glassBtn, showFonts && styles.glassBtnActive]}
              onPress={() => {
                void Haptics.selectionAsync();
                setShowFonts((current) => !current);
                setShowPalette(false);
              }}
              activeOpacity={0.8}
              accessibilityLabel="Choisir une police"
            >
              <Text style={styles.aaLabel}>Aa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.glassBtn, showPalette && styles.glassBtnActive]}
              onPress={() => {
                void Haptics.selectionAsync();
                setShowPalette((current) => !current);
                setShowFonts(false);
              }}
              activeOpacity={0.8}
              accessibilityLabel="Choisir une couleur de fond"
            >
              <Ionicons name="color-palette-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {showFonts ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fontStrip}
            keyboardShouldPersistTaps="handled"
          >
            {STORY_TEXT_FONTS.map((font) => {
              const selected = font.id === fontId;
              return (
                <TouchableOpacity
                  key={font.id}
                  style={[styles.fontChip, selected && styles.fontChipSelected]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setFontId(font.id);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.fontChipAa, { fontFamily: font.fontFamily }]}>Aa</Text>
                  <Text style={styles.fontChipLabel}>{font.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.inputArea}>
          <TextInput
            style={[
              styles.textInput,
              {
                color: textColor,
                fontFamily: activeFont.fontFamily,
              },
            ]}
            placeholder="Écrivez un statut"
            placeholderTextColor={placeholderColor}
            multiline
            textAlign="center"
            textAlignVertical="center"
            maxLength={STORY_TEXT_MAX_LENGTH}
            value={text}
            onChangeText={handleTextChange}
            autoFocus
            scrollEnabled
          />
        </View>

        {showPalette ? (
          <View style={[styles.paletteBar, { backgroundColor: PALETTE_BAR_BG }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.paletteStrip}
              keyboardShouldPersistTaps="handled"
            >
              {STORY_TEXT_BACKGROUNDS.map((color) => {
                const selected = backgroundColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      selected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setBackgroundColor(color);
                    }}
                    activeOpacity={0.88}
                  />
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {canPublish ? (
          <TouchableOpacity
            style={[styles.sendFab, { bottom: bottomPad + 72 }]}
            onPress={() => void handlePublish()}
            activeOpacity={0.85}
            accessibilityLabel="Publier le statut"
          >
            {isPublishing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="arrow-forward" size={26} color="#fff" />
            )}
          </TouchableOpacity>
        ) : null}

        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 10, backgroundColor: BOTTOM_BAR_BG }]}>
          {tabs.map((tab) => {
            const active = tab.key === "text";
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.bottomTab}
                onPress={() => handleTabPress(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.bottomTabText, { color: active ? TAB_ACTIVE : "#fff" }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {text.length > STORY_TEXT_MAX_LENGTH - 80 ? (
          <Text style={[styles.counter, { color: textColor, bottom: bottomPad + 58 }]}>
            {text.length}/{STORY_TEXT_MAX_LENGTH}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 2,
  },
  topRight: {
    flexDirection: "row",
    gap: 10,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  glassBtnActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  aaLabel: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  fontStrip: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  fontChip: {
    minWidth: 64,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
    gap: 4,
  },
  fontChipSelected: {
    backgroundColor: "rgba(255,255,255,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  fontChipAa: {
    fontSize: 22,
    color: "#fff",
  },
  fontChipLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  inputArea: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  textInput: {
    fontSize: 32,
    lineHeight: 42,
    minHeight: 120,
    maxHeight: "70%",
    textAlign: "center",
  },
  paletteBar: {
    paddingVertical: 14,
  },
  paletteStrip: {
    paddingHorizontal: 16,
    gap: 14,
    alignItems: "center",
  },
  colorSwatch: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    transform: [{ scale: 1.08 }],
  },
  sendFab: {
    position: "absolute",
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 14,
    paddingHorizontal: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  bottomTabText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  counter: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    opacity: 0.75,
  },
});
