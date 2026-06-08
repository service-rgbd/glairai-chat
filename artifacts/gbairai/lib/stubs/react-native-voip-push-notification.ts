/** Stub Metro — Expo Go / EXPO_PUBLIC_NATIVE_CALL_UI !== true */
const noop = () => undefined;

const VoipPushNotification = {
  registerVoipToken: noop,
  addEventListener: (_event: string, _handler: (...args: unknown[]) => void) => undefined,
  removeEventListener: (_event: string, _handler: (...args: unknown[]) => void) => undefined,
  onVoipNotificationCompleted: noop,
};

export default VoipPushNotification;
