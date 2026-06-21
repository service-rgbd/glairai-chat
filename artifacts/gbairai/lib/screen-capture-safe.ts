import { requireOptionalNativeModule } from "expo-modules-core";

type ScreenCaptureNative = {
  addListener: (eventName: string, listener: () => void) => { remove: () => void };
  preventScreenCaptureAsync?: () => Promise<void>;
  allowScreenCaptureAsync?: () => Promise<void>;
};

const native = requireOptionalNativeModule<ScreenCaptureNative>("ExpoScreenCapture");

export function isScreenCaptureNativeAvailable() {
  return native != null;
}

export function addScreenshotListener(listener: () => void) {
  if (!native) {
    return { remove: () => undefined };
  }

  return native.addListener("onScreenshot", listener);
}

export async function preventScreenCaptureSafe() {
  if (!native?.preventScreenCaptureAsync) {
    return;
  }

  try {
    await native.preventScreenCaptureAsync();
  } catch {
    // Module indisponible sur cette build.
  }
}

export async function allowScreenCaptureSafe() {
  if (!native?.allowScreenCaptureAsync) {
    return;
  }

  try {
    await native.allowScreenCaptureAsync();
  } catch {
    // Module indisponible sur cette build.
  }
}
