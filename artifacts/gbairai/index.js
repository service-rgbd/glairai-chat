try {
  const { registerGlobals } = require("@livekit/react-native");
  registerGlobals({ autoConfigureAudioSession: true });
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
