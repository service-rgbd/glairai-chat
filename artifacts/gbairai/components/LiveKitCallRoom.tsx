import {
  AudioSession,
  LiveKitRoom,
  useLocalParticipant,
  useRemoteParticipants,
  VideoTrack,
  isTrackReference,
  useRoomContext,
  useTracks,
} from "@livekit/react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { refreshConversationCallToken } from "@/lib/calls";
import {
  LiveKitConnectionState,
  LiveKitTrackSource,
  type LiveKitConnectionStateValue,
} from "@/lib/livekit-constants";

const TRACK_SOURCES = [LiveKitTrackSource.Camera, LiveKitTrackSource.Microphone] as const;

type FacingMode = "user" | "environment";

type Props = {
  serverUrl: string;
  token: string;
  callType: "audio" | "video";
  callSessionId?: string;
  authToken?: string | null;
  otherUserName: string;
  otherUserAvatar: string | null;
  otherUserInitials: string;
  otherUserColor: string;
  onConnected: () => void;
  onRemoteJoined: () => void;
  onRemoteLeft?: () => void;
  onDisconnected: () => void;
  onError: (message: string) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onTokenRefreshed?: (token: string) => void;
};

async function applySpeakerRoute(enabled: boolean) {
  try {
    await AudioSession.startAudioSession();
    const outputs = await AudioSession.getAudioOutputs();
    if (Platform.OS === "ios") {
      await AudioSession.selectAudioOutput(
        enabled && outputs.includes("force_speaker") ? "force_speaker" : "default",
      );
      return;
    }

    if (enabled && outputs.includes("speaker")) {
      await AudioSession.selectAudioOutput("speaker");
      return;
    }

    if (outputs.includes("earpiece")) {
      await AudioSession.selectAudioOutput("earpiece");
    }
  } catch {
    // Best effort.
  }
}

function ConnectionWatcher({
  callSessionId,
  authToken,
  onReconnecting,
  onReconnected,
  onTokenRefreshed,
}: {
  callSessionId?: string;
  authToken?: string | null;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onTokenRefreshed?: (token: string) => void;
}) {
  const room = useRoomContext();
  const previousStateRef = useRef<LiveKitConnectionStateValue | null>(null);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    if (!room) return;

    const handleState = (state: LiveKitConnectionStateValue) => {
      const previous = previousStateRef.current;
      previousStateRef.current = state;

      if (state === LiveKitConnectionState.Reconnecting) {
        onReconnecting?.();
      }

      if (
        previous === LiveKitConnectionState.Reconnecting &&
        state === LiveKitConnectionState.Connected
      ) {
        onReconnected?.();
      }

      if (
        state === LiveKitConnectionState.Reconnecting &&
        callSessionId &&
        authToken &&
        !refreshInFlightRef.current
      ) {
        refreshInFlightRef.current = true;
        void refreshConversationCallToken(callSessionId, authToken)
          .then((session) => {
            onTokenRefreshed?.(session.token);
          })
          .catch(() => undefined)
          .finally(() => {
            refreshInFlightRef.current = false;
          });
      }
    };

    handleState(room.state as LiveKitConnectionStateValue);
    room.on("connectionStateChanged", handleState as (state: LiveKitConnectionStateValue) => void);
    return () => {
      room.off("connectionStateChanged", handleState);
    };
  }, [authToken, callSessionId, onReconnecting, onReconnected, onTokenRefreshed, room]);

  return null;
}

function CallRoomBody({
  callType,
  callSessionId,
  authToken,
  otherUserName,
  otherUserAvatar,
  otherUserInitials,
  otherUserColor,
  onConnected,
  onRemoteJoined,
  onRemoteLeft,
  onDisconnected,
  onReconnecting,
  onReconnected,
  onTokenRefreshed,
}: Omit<Props, "serverUrl" | "token" | "onError">) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const hadRemoteRef = useRef(false);
  const facingModeRef = useRef<FacingMode>("user");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(callType === "video");
  const [speakerOn, setSpeakerOn] = useState(callType === "audio");

  const tracks = useTracks([...TRACK_SOURCES] as Parameters<typeof useTracks>[0], {
    onlySubscribed: false,
  });

  const remoteVideoTrack = useMemo(
    () =>
      tracks.find(
        (track) =>
          isTrackReference(track) &&
          track.publication.source === LiveKitTrackSource.Camera &&
          track.participant.identity !== localParticipant.identity,
      ),
    [localParticipant.identity, tracks],
  );

  const localVideoTrack = useMemo(
    () =>
      tracks.find(
        (track) =>
          isTrackReference(track) &&
          track.publication.source === LiveKitTrackSource.Camera &&
          track.participant.identity === localParticipant.identity,
      ),
    [localParticipant.identity, tracks],
  );

  useEffect(() => {
    void applySpeakerRoute(speakerOn);
  }, [speakerOn]);

  useEffect(() => {
    if (remoteParticipants.length > 0) {
      hadRemoteRef.current = true;
      onRemoteJoined();
      return;
    }

    if (hadRemoteRef.current) {
      onRemoteLeft?.();
    }
  }, [onRemoteJoined, onRemoteLeft, remoteParticipants.length]);

  const toggleMic = async () => {
    const next = !micEnabled;
    await localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  };

  const toggleCamera = async () => {
    const next = !cameraEnabled;
    await localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
  };

  const flipCamera = async () => {
    const publication = localParticipant.getTrackPublication(
      LiveKitTrackSource.Camera as Parameters<typeof localParticipant.getTrackPublication>[0],
    );
    const videoTrack = publication?.videoTrack;
    if (!videoTrack || !("restartTrack" in videoTrack)) return;

    const nextFacing: FacingMode = facingModeRef.current === "user" ? "environment" : "user";
    facingModeRef.current = nextFacing;
    await videoTrack.restartTrack({ facingMode: nextFacing });
  };

  const toggleSpeaker = useCallback(async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    await applySpeakerRoute(next);
  }, [speakerOn]);

  const statusLabel =
    remoteParticipants.length > 0
      ? "En communication"
      : callType === "video"
        ? "Appel vidéo..."
        : "Sonnerie...";

  const controlsBottom = Math.max(insets.bottom, 16) + 24;

  return (
    <View style={styles.body}>
      <ConnectionWatcher
        callSessionId={callSessionId}
        authToken={authToken}
        onReconnecting={onReconnecting}
        onReconnected={onReconnected}
        onTokenRefreshed={onTokenRefreshed}
      />

      {callType === "video" && remoteVideoTrack && isTrackReference(remoteVideoTrack) ? (
        <VideoTrack trackRef={remoteVideoTrack} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.audioStage}>
          <Avatar
            uri={otherUserAvatar}
            initials={otherUserInitials}
            color={otherUserColor}
            size={120}
            showOnline
            isOnline={remoteParticipants.length > 0}
          />
        </View>
      )}

      {callType === "video" && localVideoTrack && isTrackReference(localVideoTrack) ? (
        <View style={[styles.localPreview, { borderColor: colors.border, top: insets.top + 72 }]}>
          <VideoTrack trackRef={localVideoTrack} style={styles.localVideo} objectFit="cover" />
        </View>
      ) : null}

      <View style={[styles.infoOverlay, { top: insets.top + 56 }]}>
        <Text style={styles.name}>{otherUserName}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
      </View>

      <View style={[styles.controls, { bottom: controlsBottom }]}>
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: micEnabled ? colors.card : colors.destructive }]}
          onPress={() => void toggleMic()}
          activeOpacity={0.8}
        >
          <Ionicons name={micEnabled ? "mic" : "mic-off"} size={24} color="#fff" />
        </TouchableOpacity>

        {callType === "video" ? (
          <>
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: cameraEnabled ? colors.card : colors.destructive }]}
              onPress={() => void toggleCamera()}
              activeOpacity={0.8}
            >
              <Ionicons name={cameraEnabled ? "videocam" : "videocam-off"} size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlBtn, { backgroundColor: colors.card }]}
              onPress={() => void flipCamera()}
              activeOpacity={0.8}
              accessibilityLabel="Inverser la caméra"
            >
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: speakerOn ? colors.card : colors.destructive }]}
          onPress={() => void toggleSpeaker()}
          activeOpacity={0.8}
        >
          <Ionicons name={speakerOn ? "volume-high" : "volume-mute"} size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.hangupBtn]}
          onPress={onDisconnected}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function LiveKitCallRoom({
  serverUrl,
  token,
  callSessionId,
  authToken,
  onTokenRefreshed,
  onConnected,
  ...rest
}: Props) {
  const [roomToken, setRoomToken] = useState(token);

  useEffect(() => {
    setRoomToken(token);
  }, [token]);

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={roomToken}
      connect
      audio
      video={rest.callType === "video"}
      onConnected={onConnected}
      onDisconnected={rest.onDisconnected}
      onError={(error) => rest.onError(error.message)}
    >
      <CallRoomBody
        {...rest}
        callSessionId={callSessionId}
        authToken={authToken}
        onConnected={onConnected}
        onTokenRefreshed={(nextToken) => {
          setRoomToken(nextToken);
          onTokenRefreshed?.(nextToken);
        }}
      />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  audioStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  localPreview: {
    position: "absolute",
    right: 16,
    width: 108,
    height: 148,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  localVideo: {
    width: "100%",
    height: "100%",
  },
  infoOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 24,
  },
  name: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  status: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
  },
  controlBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  hangupBtn: {
    backgroundColor: "#EF4444",
  },
});
