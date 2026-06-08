/** Constantes LiveKit sans importer livekit-client (DOMException absent sur Hermes). */
export const LiveKitConnectionState = {
  Connected: "connected",
  Reconnecting: "reconnecting",
  Disconnected: "disconnected",
  Connecting: "connecting",
} as const;

export type LiveKitConnectionStateValue =
  (typeof LiveKitConnectionState)[keyof typeof LiveKitConnectionState];

export const LiveKitTrackSource = {
  Camera: "camera",
  Microphone: "microphone",
} as const;

export type LiveKitTrackSourceValue =
  (typeof LiveKitTrackSource)[keyof typeof LiveKitTrackSource];
