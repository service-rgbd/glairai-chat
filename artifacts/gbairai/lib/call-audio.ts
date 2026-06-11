export async function configureCallAudioMode(_videoCall: boolean) {
  // Pendant un appel LiveKit, Expo Audio ne doit pas reconfigurer l'AVAudioSession.
  // LiveKit/WebRTC est l'unique propriétaire du micro, du haut-parleur et de la route audio.
}

export async function resetCallAudioMode() {
  // Voir configureCallAudioMode : ne pas reprendre l'AVAudioSession à LiveKit.
}

export type CallSoundPhase = "idle" | "ringing" | "connected" | "ended";
