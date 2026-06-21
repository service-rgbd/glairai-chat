import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useEffect, type MutableRefObject } from "react";

import {
  CHAT_INCOMING_MESSAGE_SOUND,
  CONVERSATION_LIST_MESSAGE_SOUND,
} from "@/lib/message-sounds";

async function prepareMessagePlayback() {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
  });
}

type Props = {
  enabled: boolean;
  listPlayRef: MutableRefObject<(() => void) | null>;
  chatPlayRef: MutableRefObject<(() => void) | null>;
};

export function MessageSoundsBridge({ enabled, listPlayRef, chatPlayRef }: Props) {
  const listPlayer = useAudioPlayer(CONVERSATION_LIST_MESSAGE_SOUND);
  const chatPlayer = useAudioPlayer(CHAT_INCOMING_MESSAGE_SOUND);

  useEffect(() => {
    const play = (player: ReturnType<typeof useAudioPlayer>) => {
      if (!enabled) return;
      void prepareMessagePlayback()
        .then(() => {
          player.seekTo(0);
          player.play();
        })
        .catch(() => {
          try {
            player.seekTo(0);
            player.play();
          } catch {
            // Ignorer si l'objet natif est déjà libéré.
          }
        });
    };

    listPlayRef.current = () => play(listPlayer);
    chatPlayRef.current = () => play(chatPlayer);

    return () => {
      listPlayRef.current = null;
      chatPlayRef.current = null;
    };
  }, [chatPlayRef, chatPlayer, enabled, listPlayRef, listPlayer]);

  return null;
}
