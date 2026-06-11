// @noble/* et WebCrypto s'appuient sur getRandomValues — absent par défaut dans React Native.
require("react-native-get-random-values");

try {
  if (process.env.EXPO_PUBLIC_LIVEKIT_ENABLED === "true") {
    const { registerGlobals } = require("@livekit/react-native");
    // La gestion automatique de l'AVAudioSession iOS est indispensable : sans elle,
    // la catégorie audio n'est jamais passée en "playAndRecord" quand le moteur
    // WebRTC démarre → micro muet et aucun son pendant les appels.
    // Depuis @livekit/react-native 2.11, cette gestion n'installe que des handlers JS
    // au démarrage (aucun appel natif tant qu'un appel ne commence pas), donc pas de
    // risque de crash au lancement (clavier / auth).
    registerGlobals();
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
