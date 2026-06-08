try {
  const { registerGlobals } = require("@livekit/react-native");
  registerGlobals({ autoConfigureAudioSession: true });
} catch {
  // Expo Go / web : modules natifs LiveKit indisponibles.
}

require("expo-router/entry");
