export type CallSignalEvent =
  | {
      type: "cancelled" | "declined" | "ended" | "missed";
      callId: string;
      conversationId: string;
    }
  | {
      type: "answered";
      callId: string;
      conversationId: string;
    };

type Listener = (event: CallSignalEvent) => void;

const listeners = new Set<Listener>();

export function emitCallSignal(event: CallSignalEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeCallSignal(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
