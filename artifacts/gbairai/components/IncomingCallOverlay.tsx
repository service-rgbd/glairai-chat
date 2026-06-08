import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { CallSoundController } from "@/components/CallSoundController";
import { useAuth } from "@/contexts/AuthContext";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { signalConversationCall } from "@/lib/calls";
import { logConversationCall } from "@/lib/call-log";
import { subscribeCallSignal } from "@/lib/call-signaling";
import {
  clearIncomingCallIfMatches,
  getIncomingCall,
  getIncomingCallUiMode,
  setIncomingCallUiMode,
  subscribeIncomingCall,
  subscribeIncomingCallUiMode,
  type IncomingCallPayload,
  type IncomingCallUiMode,
} from "@/lib/incoming-call";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function IncomingCallOverlay() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { authToken } = useAuth();
  const { users, recordCall } = useChats();
  const [incoming, setIncoming] = useState<IncomingCallPayload | null>(() => getIncomingCall());
  const [uiMode, setUiMode] = useState<IncomingCallUiMode>(() => getIncomingCallUiMode());

  useEffect(() => subscribeIncomingCall(setIncoming), []);
  useEffect(() => subscribeIncomingCallUiMode(setUiMode), []);

  useEffect(() => {
    if (!incoming) return;
    return subscribeCallSignal((event) => {
      if (event.callId !== incoming.callId) return;
      if (
        event.type === "cancelled" ||
        event.type === "declined" ||
        event.type === "ended" ||
        event.type === "missed"
      ) {
        clearIncomingCallIfMatches(incoming.callId);
      }
    });
  }, [incoming]);

  if (!incoming) return null;

  const caller = users[incoming.callerUserId];
  const callerName = incoming.callerName || caller?.name || "Contact";
  const callerAvatar = incoming.callerAvatarUrl ?? caller?.avatar ?? null;
  const callerInitials = caller?.initials ?? initialsFromName(callerName);
  const callerColor = caller?.color ?? colors.primary;
  const isVideo = incoming.callType === "video";

  const accept = () => {
    const callId = recordCall({
      userId: incoming.callerUserId,
      conversationId: incoming.conversationId,
      type: incoming.callType,
      direction: "incoming",
      missed: false,
      failed: false,
      duration: null,
    });
    clearIncomingCallIfMatches(incoming.callId);
    router.push({
      pathname: "/call/[conversationId]",
      params: {
        conversationId: incoming.conversationId,
        type: incoming.callType,
        callId,
        callSessionId: incoming.callId,
        incoming: "1",
      },
    });
  };

  const decline = () => {
    void (async () => {
      if (authToken) {
        try {
          await signalConversationCall(incoming.callId, "decline", authToken, {
            conversationId: incoming.conversationId,
            callType: incoming.callType,
            callerUserId: incoming.callerUserId,
          });
        } catch {
          // Best effort: clear local overlay even if API unreachable.
        }
        try {
          await logConversationCall(
            {
              callId: incoming.callId,
              conversationId: incoming.conversationId,
              callerUserId: incoming.callerUserId,
              callType: incoming.callType,
              outcome: "declined",
            },
            authToken,
          );
        } catch {
          // Best effort.
        }
      }
      recordCall({
        id: `calllog_${incoming.callId}`,
        userId: incoming.callerUserId,
        conversationId: incoming.conversationId,
        type: incoming.callType,
        direction: "incoming",
        missed: true,
        failed: false,
        duration: null,
      });
      clearIncomingCallIfMatches(incoming.callId);
    })();
  };

  if (uiMode === "banner") {
    return (
      <>
        <CallSoundController phase="ringing" variant="incoming" />
        <View
          pointerEvents="box-none"
          style={[styles.bannerHost, { paddingTop: insets.top + 6 }]}
        >
          <Pressable
            style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setIncomingCallUiMode("fullscreen")}
          >
            <Avatar uri={callerAvatar} initials={callerInitials} color={callerColor} size={44} />
            <View style={styles.bannerText}>
              <Text style={[styles.bannerTitle, { color: colors.text }]} numberOfLines={1}>
                {callerName}
              </Text>
              <Text style={[styles.bannerSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {isVideo ? "Appel vidéo entrant" : "Appel audio entrant"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.bannerAction, styles.decline]}
              onPress={decline}
              activeOpacity={0.85}
              accessibilityLabel="Refuser"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bannerAction, styles.accept]}
              onPress={accept}
              activeOpacity={0.85}
              accessibilityLabel="Accepter"
            >
              <Ionicons name={isVideo ? "videocam" : "call"} size={20} color="#fff" />
            </TouchableOpacity>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={decline}>
      <StatusBar barStyle="light-content" />
      <CallSoundController phase="ringing" variant="incoming" />
      <LinearGradient colors={["#0B1220", "#111827", "#1E293B"]} style={styles.fullscreen}>
        <View style={[styles.fullscreenHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.minimizeBtn}
            onPress={() => setIncomingCallUiMode("banner")}
            activeOpacity={0.8}
            accessibilityLabel="Réduire l'appel entrant"
          >
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.fullscreenBody}>
          <Avatar uri={callerAvatar} initials={callerInitials} color={callerColor} size={148} />
          <Text style={styles.fullscreenName}>{callerName}</Text>
          <Text style={styles.fullscreenSubtitle}>
            {isVideo ? "Appel vidéo entrant..." : "Appel audio entrant..."}
          </Text>
        </View>

        <View style={[styles.fullscreenActions, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
          <View style={styles.actionColumn}>
            <TouchableOpacity
              style={[styles.fullscreenActionBtn, styles.decline]}
              onPress={decline}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Refuser</Text>
          </View>

          <View style={styles.actionColumn}>
            <TouchableOpacity
              style={[styles.fullscreenActionBtn, styles.accept]}
              onPress={accept}
              activeOpacity={0.85}
            >
              <Ionicons name={isVideo ? "videocam" : "call"} size={30} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Accepter</Text>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bannerHost: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  bannerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  bannerAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreen: {
    flex: 1,
  },
  fullscreenHeader: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  minimizeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  fullscreenBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  fullscreenName: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginTop: 8,
  },
  fullscreenSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  fullscreenActions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  actionColumn: {
    alignItems: "center",
    gap: 10,
  },
  fullscreenActionBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  decline: {
    backgroundColor: "#EF4444",
  },
  accept: {
    backgroundColor: "#22C55E",
  },
});
