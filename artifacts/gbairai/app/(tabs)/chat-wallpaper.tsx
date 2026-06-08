import { Feather, Ionicons } from "@expo/vector-icons";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatWallpaperPreview } from "@/components/ChatWallpaper";
import { useChatWallpaper } from "@/hooks/useChatWallpaper";
import { useColors } from "@/hooks/useColors";
import { leaveOverlayScreen } from "@/lib/navigation";
import type { ChatWallpaperId } from "@/lib/chat-wallpapers";

export default function ChatWallpaperScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { wallpaperId, wallpapers, setWallpaperId } = useChatWallpaper();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSelect = async (id: ChatWallpaperId) => {
    await setWallpaperId(id);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.headerBg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={leaveOverlayScreen} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Arrière-plan du chat</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 24, paddingHorizontal: 16 }}>
        <Text style={[styles.lead, { color: colors.mutedForeground }]}>
          Choisissez un fond appliqué dans vos conversations. Les bulles restent lisibles sur tous les thèmes.
        </Text>

        <View style={styles.grid}>
          {wallpapers.map((item) => {
            const selected = wallpaperId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.card,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
                activeOpacity={0.8}
                onPress={() => void handleSelect(item.id)}
              >
                <ChatWallpaperPreview wallpaperId={item.id} size={88} />
                <Text style={[styles.cardLabel, { color: colors.text }]} numberOfLines={1}>
                  {item.label}
                </Text>
                {selected ? (
                  <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={14} color="#fff" />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  lead: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginTop: 16,
    marginBottom: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47.5%",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    position: "relative",
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  selectedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
