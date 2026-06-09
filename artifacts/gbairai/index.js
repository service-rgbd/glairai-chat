// @noble/* et WebCrypto s'appuient sur getRandomValues — absent par défaut dans React Native.
require("react-native-get-random-values");

try {
  if (process.env.EXPO_PUBLIC_LIVEKIT_ENABLED === "true") {
    const { registerGlobals } = require("@livekit/react-native");
    // Ne pas toucher AVAudioSession au démarrage — évite les crashs natifs (clavier / auth).
    registerGlobals({ autoConfigureAudioSession: false });
  }
} catch {
  // Expo Go / web : modules natifs LiveKit indisponibles.
}

if (typeof globalThis.DOMException === "undefined") {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message = "", name = "Error") {
      super(message);
      this.name = name;
    }
  };
}

require("expo-router/entry");
