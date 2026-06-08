import { setAudioModeAsync } from "expo-audio";

export async function configureCallAudioMode(videoCall: boolean) {
  await setAudioModeAsync({
    allowsRecording: videoCall,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "duckOthers",
  });
}

export async function resetCallAudioMode() {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "mixWithOthers",
  });
}

export type CallSoundPhase = "idle" | "ringing" | "connected" | "ended";
