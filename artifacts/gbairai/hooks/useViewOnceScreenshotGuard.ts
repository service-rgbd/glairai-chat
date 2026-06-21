import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";

import {
  addScreenshotListener,
  isScreenCaptureNativeAvailable,
} from "@/lib/screen-capture-safe";

type Options = {
  enabled: boolean;
  onConfirmScreenshot: () => void;
};

export function useViewOnceScreenshotGuard({ enabled, onConfirmScreenshot }: Options) {
  const warnedRef = useRef(false);
  const reportingRef = useRef(false);

  useEffect(() => {
    if (!enabled || Platform.OS === "web") {
      return;
    }

    if (!warnedRef.current) {
      warnedRef.current = true;
      const screenshotHint = isScreenCaptureNativeAvailable()
        ? "Si vous effectuez une capture d'écran, votre correspondant en sera averti."
        : "Les médias à vue unique ne peuvent pas être enregistrés depuis l'application.";

      Alert.alert("Photo à vue unique", screenshotHint, [{ text: "Compris" }]);
    }

    if (!isScreenCaptureNativeAvailable()) {
      return;
    }

    const subscription = addScreenshotListener(() => {
      if (reportingRef.current) {
        return;
      }

      Alert.alert(
        "Capture d'écran détectée",
        "Votre correspondant sera averti si vous confirmez.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "D'accord",
            onPress: () => {
              reportingRef.current = true;
              onConfirmScreenshot();
            },
          },
        ],
      );
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, onConfirmScreenshot]);
}
