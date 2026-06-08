import React from "react";
import { View } from "react-native";

/** Stub utilisé par Metro en Expo Go (EXPO_PUBLIC_LIVEKIT_ENABLED !== true). */
export function registerGlobals() {}

export function isTrackReference(_track: unknown): _track is never {
  return false;
}

export function useTracks() {
  return [];
}

export function useLocalParticipant() {
  return {
    localParticipant: {
      identity: "local",
      setMicrophoneEnabled: async () => undefined,
      setCameraEnabled: async () => undefined,
      getTrackPublication: () => undefined,
    },
  };
}

export function useRemoteParticipants() {
  return [];
}

export function useRoomContext() {
  return null;
}

export const AudioSession = {
  startAudioSession: async () => undefined,
  getAudioOutputs: async () => [] as string[],
  selectAudioOutput: async (_output: string) => undefined,
};

export function VideoTrack() {
  return <View />;
}

export function LiveKitRoom({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
