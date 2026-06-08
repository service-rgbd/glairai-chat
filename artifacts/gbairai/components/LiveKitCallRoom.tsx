import {
  AudioSession,
  LiveKitRoom,
  useLocalParticipant,
  useRemoteParticipants,
  VideoTrack,
  isTrackReference,
  useTracks,
} from "@livekit/react-native";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";

/** Valeurs Track.Source de livekit-client — évite l'import web-only (DOMException). */
const TRACK_SOURCE = {
  Camera: "camera",
  Microphone: "microphone",
} as const;

type Props = {
  serverUrl: string;
  token: string;
  callType: "audio" | "video";
  otherUserName: string;
  otherUserAvatar: string | null;
  otherUserInitials: string;
  otherUserColor: string;
  onConnected: () => void;
  onRemoteJoined: () => void;
  onRemoteLeft?: () => void;
  onDisconnected: () => void;
  onError: (message: string) => void;
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
    // Best effort: LiveKit garde l'audio actif même si le routage échoue.
  }
}

function CallRoomBody({
  callType,
  otherUserName,
  otherUserAvatar,
  otherUserInitials,
  otherUserColor,
  onConnected,
  onRemoteJoined,
  onRemoteLeft,
  onDisconnected,
  onError,
}: Omit<Props, "serverUrl" | "token">) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const hadRemoteRef = useRef(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(callType === "video");
  const [speakerOn, setSpeakerOn] = useState(callType === "audio");

  const tracks = useTracks(
    [TRACK_SOURCE.Camera, TRACK_SOURCE.Microphone],
    { onlySubscribed: false },
  );

  const remoteVideoTrack = useMemo(
    () =>
      tracks.find(
        (track) =>
          isTrackReference(track) &&
          track.publication.source === TRACK_SOURCE.Camera &&
          track.participant.identity !== localParticipant.identity,
      ),
    [localParticipant.identity, tracks],
  );

  const localVideoTrack = useMemo(
    () =>
      tracks.find(
        (track) =>
          isTrackReference(track) &&
          track.publication.source === TRACK_SOURCE.Camera &&
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
          accessibilityLabel={micEnabled ? "Couper le micro" : "Activer le micro"}
        >
          <Ionicons name={micEnabled ? "mic" : "mic-off"} size={24} color="#fff" />
        </TouchableOpacity>

        {callType === "video" ? (
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: cameraEnabled ? colors.card : colors.destructive }]}
            onPress={() => void toggleCamera()}
            activeOpacity={0.8}
            accessibilityLabel={cameraEnabled ? "Couper la caméra" : "Activer la caméra"}
          >
            <Ionicons name={cameraEnabled ? "videocam" : "videocam-off"} size={24} color="#fff" />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: speakerOn ? colors.card : colors.destructive }]}
          onPress={() => void toggleSpeaker()}
          activeOpacity={0.8}
          accessibilityLabel={speakerOn ? "Désactiver le haut-parleur" : "Activer le haut-parleur"}
        >
          <Ionicons name={speakerOn ? "volume-high" : "volume-mute"} size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.hangupBtn]}
          onPress={onDisconnected}
          activeOpacity={0.8}
          accessibilityLabel="Raccrocher"
        >
          <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function LiveKitCallRoom(props: Props) {
  return (
    <LiveKitRoom
      serverUrl={props.serverUrl}
      token={props.token}
      connect
      audio
      video={props.callType === "video"}
      onConnected={props.onConnected}
      onDisconnected={props.onDisconnected}
      onError={(error) => props.onError(error.message)}
    >
      <CallRoomBody {...props} />
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
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 24,
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
