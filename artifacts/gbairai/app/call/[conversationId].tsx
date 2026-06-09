import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CallSoundController } from "@/components/CallSoundController";
import { Avatar } from "@/components/Avatar";
import { LiveKitCallRoom } from "@/components/LiveKitCallRoom";
import { useAuth } from "@/contexts/AuthContext";
import { useChats } from "@/contexts/chats-context-ref";
import { useColors } from "@/hooks/useColors";
import { configureCallAudioMode, resetCallAudioMode, type CallSoundPhase } from "@/lib/call-audio";
import { CALL_RING_TIMEOUT_MS } from "@/lib/call-config";
import { callNetworkLabel, useCallNetworkStatus } from "@/lib/call-network";
import { isNativeCallSupported, isExpoGoRuntime } from "@/lib/call-runtime";
import { subscribeCallSignal } from "@/lib/call-signaling";
import { logConversationCall, resolveCallLogOutcome } from "@/lib/call-log";
import {
  prepareConversationCall,
  signalConversationCall,
  CallRequestError,
  type CallSignalMeta,
  type PreparedCallSession,
} from "@/lib/calls";
import { clearIncomingCallIfMatches } from "@/lib/incoming-call";
import { assertCanStartCall, setActiveCall } from "@/lib/call-session-client";

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function CallScreen() {
  const {
    conversationId,
    type,
    callId,
    callSessionId,
    incoming,
  } = useLocalSearchParams<{
    conversationId: string;
    type?: "audio" | "video";
    callId?: string;
    callSessionId?: string;
    incoming?: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, authToken } = useAuth();
  const { chats, getOtherUser, startOutgoingCall, updateCall } = useChats();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PreparedCallSession | null>(null);
  const [soundPhase, setSoundPhase] = useState<CallSoundPhase>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const networkStatus = useCallNetworkStatus(Boolean(session));

  const activeCallIdRef = useRef<string | null>(null);
  const activeCallSessionIdRef = useRef<string | null>(null);
  const markedFailureRef = useRef(false);
  const connectedAtRef = useRef<number | null>(null);
  const hangupRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const callAnsweredRef = useRef(false);
  const remoteLeftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chat = useMemo(
    () => chats.find((item) => item.id === conversationId),
    [chats, conversationId],
  );
  const otherUser = chat ? getOtherUser(chat) : undefined;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const callType = type === "video" ? "video" : "audio";
  const isIncoming = incoming === "1";
  const normalizedCallId = Array.isArray(callId) ? callId[0] : callId;
  const normalizedCallSessionId = Array.isArray(callSessionId) ? callSessionId[0] : callSessionId;
  const nativeCallsEnabled = isNativeCallSupported();

  const finishCall = useCallback(
    (options?: {
      failed?: boolean;
      missed?: boolean;
      declined?: boolean;
      suggestVoiceMessage?: boolean;
    }) => {
      if (hangupRef.current) return;
      hangupRef.current = true;

      const activeCallId = activeCallIdRef.current;
      if (activeCallId) {
        const duration =
          connectedAtRef.current != null
            ? formatDuration(Math.max(0, Math.floor((Date.now() - connectedAtRef.current) / 1000)))
            : null;
        updateCall(activeCallId, {
          failed: options?.failed ?? false,
          missed: options?.missed ?? false,
          duration,
        });
      }

      clearIncomingCallIfMatches(activeCallSessionIdRef.current);
      setActiveCall(null);
      setSoundPhase("ended");
      void resetCallAudioMode();

      if (options?.suggestVoiceMessage && conversationId) {
        Alert.alert(
          "Pas de réponse",
          `${otherUser?.name ?? "Votre contact"} ne répond pas. Souhaitez-vous laisser un message vocal ?`,
          [
            { text: "Fermer", style: "cancel", onPress: () => router.back() },
            {
              text: "Message vocal",
              onPress: () => {
                router.replace({
                  pathname: "/chat/[id]",
                  params: { id: conversationId, recordVoice: "1" },
                });
              },
            },
          ],
        );
        return;
      }

      setTimeout(() => router.back(), 350);
    },
    [conversationId, otherUser?.name, updateCall],
  );

  const hangup = useCallback(async () => {
    const callSessionId = activeCallSessionIdRef.current;
    const callerUserId = isIncoming ? otherUser?.id : currentUser?.id;
    const durationSeconds =
      connectedAtRef.current != null
        ? Math.max(0, Math.floor((Date.now() - connectedAtRef.current) / 1000))
        : null;
    const wasConnected = wasConnectedRef.current;
    const outcome = resolveCallLogOutcome({
      isIncoming,
      wasConnected,
      declined: isIncoming && !wasConnected,
    });
    const meta: CallSignalMeta | undefined =
      conversationId && callerUserId
        ? {
            conversationId,
            callType,
            callerUserId,
            durationSeconds,
          }
        : undefined;

    if (authToken && callSessionId) {
      try {
        if (wasConnected) {
          await signalConversationCall(callSessionId, "end", authToken, meta);
        } else if (isIncoming) {
          await signalConversationCall(callSessionId, "decline", authToken, meta);
        } else {
          await signalConversationCall(callSessionId, "cancel", authToken, meta);
        }
      } catch {
        // Local hangup still proceeds.
      }

      if (meta) {
        try {
          await logConversationCall(
            {
              callId: callSessionId,
              conversationId: meta.conversationId,
              callerUserId: meta.callerUserId,
              callType: meta.callType,
              outcome,
              durationSeconds: meta.durationSeconds ?? null,
            },
            authToken,
          );
        } catch {
          // Best effort: message may already exist from the other participant.
        }
      }
    }

    finishCall({
      missed: isIncoming && !wasConnected,
      failed: false,
      suggestVoiceMessage: !isIncoming && !wasConnected,
    });
  }, [authToken, callType, conversationId, currentUser?.id, finishCall, isIncoming, otherUser?.id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!conversationId || !authToken) {
        setError("Conversation introuvable");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        if (!isIncoming) {
          assertCanStartCall(conversationId);
        }
        await configureCallAudioMode(callType === "video");
        const nextSession = await prepareConversationCall(conversationId, callType, authToken, {
          role: isIncoming ? "callee" : "caller",
          callId: normalizedCallSessionId,
        });
        if (cancelled) return;
        setSession(nextSession);
        activeCallSessionIdRef.current = nextSession.callId;
        setActiveCall({
          callSessionId: nextSession.callId,
          conversationId,
        });
        if (isIncoming || nextSession.role === "callee") {
          callAnsweredRef.current = true;
        }
        clearIncomingCallIfMatches(nextSession.callId);
        setSoundPhase("ringing");
      } catch (cause) {
        if (cancelled) return;
        setActiveCall(null);
        const message =
          cause instanceof CallRequestError
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : "Impossible de préparer l'appel";
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      void resetCallAudioMode();
    };
  }, [authToken, callType, conversationId, isIncoming, normalizedCallSessionId]);

  useEffect(() => {
    if (activeCallIdRef.current) return;
    if (typeof normalizedCallId === "string" && normalizedCallId.trim()) {
      activeCallIdRef.current = normalizedCallId;
      return;
    }
    if (!conversationId || !otherUser?.id || isIncoming) return;
    activeCallIdRef.current = startOutgoingCall({
      userId: otherUser.id,
      conversationId,
      type: callType,
    });
  }, [normalizedCallId, callType, conversationId, isIncoming, otherUser?.id, startOutgoingCall]);

  useEffect(() => {
    if (!error || markedFailureRef.current) return;
    const activeCallId = activeCallIdRef.current;
    if (!activeCallId) return;
    markedFailureRef.current = true;
    updateCall(activeCallId, { failed: true });
  }, [error, updateCall]);

  useEffect(() => {
    if (soundPhase !== "connected") return;
    const timer = setInterval(() => {
      if (connectedAtRef.current == null) return;
      setElapsedSeconds(Math.floor((Date.now() - connectedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [soundPhase]);

  useEffect(() => {
    if (!conversationId) return;
    return subscribeCallSignal((event) => {
      if (event.conversationId !== conversationId) return;
      if (
        activeCallSessionIdRef.current &&
        event.callId !== activeCallSessionIdRef.current
      ) {
        return;
      }

      if (event.type === "answered") {
        callAnsweredRef.current = true;
        if (!wasConnectedRef.current) {
          setSoundPhase("idle");
        }
        return;
      }

      if (event.type === "declined" || event.type === "cancelled" || event.type === "missed") {
        const wasConnected = wasConnectedRef.current;
        finishCall({
          missed: isIncoming && !wasConnected,
          suggestVoiceMessage: !isIncoming && !wasConnected,
        });
        return;
      }

      if (event.type === "ended") {
        finishCall();
      }
    });
  }, [conversationId, finishCall, isIncoming]);

  useEffect(() => {
    if (isIncoming || soundPhase !== "ringing" || wasConnectedRef.current || hangupRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      void hangup();
    }, CALL_RING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [hangup, isIncoming, soundPhase]);

  const handleLiveKitConnected = useCallback(() => {
    setSoundPhase((current) => (current === "ringing" ? "idle" : current));
  }, []);

  const handleRemoteJoined = useCallback(() => {
    if (remoteLeftTimerRef.current) {
      clearTimeout(remoteLeftTimerRef.current);
      remoteLeftTimerRef.current = null;
    }
    if (connectedAtRef.current != null) return;
    connectedAtRef.current = Date.now();
    wasConnectedRef.current = true;
    setSoundPhase("connected");
    const sessionCallId = activeCallSessionIdRef.current;
    if (sessionCallId) {
      void import("@/lib/call-system-ui").then(({ reportNativeCallConnected }) => {
        reportNativeCallConnected(sessionCallId);
      });
    }
  }, []);

  const handleRemoteLeft = useCallback(() => {
    if (!wasConnectedRef.current || hangupRef.current) return;
    if (remoteLeftTimerRef.current) return;
    remoteLeftTimerRef.current = setTimeout(() => {
      remoteLeftTimerRef.current = null;
      void hangup();
    }, 8_000);
  }, [hangup]);

  useEffect(() => {
    return () => {
      if (remoteLeftTimerRef.current) {
        clearTimeout(remoteLeftTimerRef.current);
      }
      setActiveCall(null);
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <CallSoundController phase={soundPhase} variant={isIncoming ? "incoming" : "outgoing"} />

      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => void hangup()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </TouchableOpacity>
        {soundPhase === "connected" ? (
          <Text style={[styles.duration, { color: colors.mutedForeground }]}>
            {formatDuration(elapsedSeconds)}
          </Text>
        ) : isReconnecting ? (
          <Text style={[styles.duration, { color: colors.primary }]}>Reconnexion…</Text>
        ) : callNetworkLabel(networkStatus) ? (
          <Text style={[styles.duration, { color: colors.destructive }]}>
            {callNetworkLabel(networkStatus)}
          </Text>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            Connexion à LiveKit...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={28} color={colors.destructive} />
          <Text style={[styles.helper, { color: colors.destructive }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.hangupFallback, { backgroundColor: colors.destructive }]}
            onPress={() => void hangup()}
            activeOpacity={0.85}
          >
            <Text style={styles.hangupFallbackText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      ) : session && nativeCallsEnabled ? (
        <LiveKitCallRoom
          serverUrl={session.url}
          token={session.token}
          callType={callType}
          callSessionId={session.callId}
          authToken={authToken}
          otherUserName={otherUser?.name ?? currentUser?.name ?? "Appel"}
          otherUserAvatar={otherUser?.avatar ?? null}
          otherUserInitials={otherUser?.initials ?? "??"}
          otherUserColor={otherUser?.color ?? colors.primary}
          onConnected={handleLiveKitConnected}
          onRemoteJoined={handleRemoteJoined}
          onRemoteLeft={handleRemoteLeft}
          onReconnecting={() => setIsReconnecting(true)}
          onReconnected={() => setIsReconnecting(false)}
          onTokenRefreshed={(nextToken) => {
            setSession((current) => (current ? { ...current, token: nextToken } : current));
          }}
          onDisconnected={() => void hangup()}
          onError={(message) => setError(message)}
        />
      ) : (
        <View style={styles.center}>
          <Avatar
            uri={otherUser?.avatar ?? null}
            initials={otherUser?.initials ?? "??"}
            color={otherUser?.color ?? colors.primary}
            size={112}
          />
          <Text style={[styles.title, { color: colors.text }]}>
            {otherUser?.name ?? "Appel Gbairai"}
          </Text>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            {soundPhase === "ringing"
              ? isIncoming
                ? "Connexion à l'appel..."
                : "Sonnerie en cours..."
              : isExpoGoRuntime()
                ? "Les appels audio/vidéo nécessitent un dev build EAS (LiveKit). Expo Go ne supporte pas WebRTC."
                : "LiveKit est configuré côté serveur. Installez un dev build iOS/Android pour activer audio/vidéo."}
          </Text>
          {session ? (
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>
              Salle prête : {session.roomName}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.hangupFallback, { backgroundColor: colors.destructive }]}
            onPress={() => void hangup()}
            activeOpacity={0.85}
          >
            <Text style={styles.hangupFallbackText}>Raccrocher</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  duration: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginRight: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  helper: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  hangupFallback: {
    marginTop: 8,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  hangupFallbackText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
