import { useAudioPlayer } from "expo-audio";
import React, { useEffect, useMemo } from "react";

import type { CallSoundPhase } from "@/lib/call-audio";
import { getCallRingtoneSource, useCallRingtone } from "@/lib/call-ringtone";

type Props = {
  phase: CallSoundPhase;
  variant?: "outgoing" | "incoming";
};

export function CallSoundController({ phase, variant = "outgoing" }: Props) {
  const { selection } = useCallRingtone();
  const ringSource = useMemo(
    () => getCallRingtoneSource(selection, variant === "incoming" ? "incoming" : "outgoing"),
    [selection, variant],
  );

  const ringPlayer = useAudioPlayer(ringSource);
  const connect = useAudioPlayer(require("@/assets/sounds/connect.wav"));
  const end = useAudioPlayer(require("@/assets/sounds/end.wav"));

  useEffect(() => {
    ringPlayer.loop = true;
  }, [ringPlayer]);

  useEffect(() => {
    ringPlayer.pause();
    connect.pause();
    end.pause();

    if (phase === "ringing") {
      ringPlayer.seekTo(0);
      ringPlayer.play();
    } else if (phase === "connected") {
      connect.seekTo(0);
      connect.play();
    } else if (phase === "ended") {
      end.seekTo(0);
      end.play();
    }
    // Ne pas appeler pause() au démontage : expo-audio libère l'objet natif
    // avant le cleanup React → NativeSharedObjectNotFoundException.
  }, [phase, ringPlayer, connect, end]);

  return null;
}
