/** Stub Metro — Expo Go / EXPO_PUBLIC_NATIVE_CALL_UI !== true */
const noop = () => undefined;
const asyncNoop = async () => undefined;

const RNCallKeep = {
  setup: asyncNoop,
  setAvailable: asyncNoop,
  displayIncomingCall: noop,
  endCall: noop,
  endAllCalls: noop,
  backToForeground: noop,
  reportConnectedOutgoingCallWithUUID: noop,
  addEventListener: (_event: string, _handler: (...args: unknown[]) => void) => ({
    remove: noop,
  }),
  removeEventListener: noop,
};

export default RNCallKeep;
