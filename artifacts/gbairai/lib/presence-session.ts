import { updatePresenceHeartbeat } from "@workspace/api-client-react";

type PresenceSocketOffline = () => void;

let socketOfflineEmitter: PresenceSocketOffline | null = null;

/** Enregistre l'émetteur socket (ChatsContext) pour signaler la déconnexion. */
export function registerPresenceSocketOffline(emitter: PresenceSocketOffline | null) {
  socketOfflineEmitter = emitter;
}

/**
 * Signale hors ligne avant logout : socket si connecté, puis API REST en secours.
 * Le token doit être passé explicitement car le getter auth peut déjà être null.
 */
export async function signalPresenceOffline(options?: { authToken?: string | null }) {
  try {
    socketOfflineEmitter?.();
  } catch {
    // best effort
  }

  const token = options?.authToken?.trim();
  if (!token) return;

  try {
    await updatePresenceHeartbeat(
      { isOnline: false },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    // best effort — la session peut déjà être révoquée
  }
}
