import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback } from "react";

import { CHAT_INCOMING_MESSAGE_SOUND } from "@/lib/message-sounds";

export function useMessageReceivedSound(enabled = true) {
  const player = useAudioPlayer(CHAT_INCOMING_MESSAGE_SOUND);

  return useCallback(() => {
    if (!enabled) return;
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      .then(() => {
        player.seekTo(0);
        player.play();
      })
      .catch(() => {
        try {
          player.seekTo(0);
          player.play();
        } catch {
          // Objet audio natif parfois libéré au démontage — ignorer.
        }
      });
  }, [enabled, player]);
}
