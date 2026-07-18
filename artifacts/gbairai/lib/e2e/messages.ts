import { fetchPreKeyBundle } from "@/lib/e2e/api";
import { isE2eEnabled, isE2ePayload, E2E_FALLBACK_LABEL } from "@/lib/e2e/config";
import { decryptFromPeer, encryptForPeer } from "@/lib/e2e/crypto";
import { ensureE2eDeviceRegistered } from "@/lib/e2e/bootstrap";
import { loadSession, saveSession } from "@/lib/e2e/store";

export { isE2ePayload, E2E_FALLBACK_LABEL };

const e2eDecryptWarningKeys = new Set<string>();

export function shouldEncryptDirectText(chatType: string, messageType: string) {
  return isE2eEnabled() && chatType === "direct" && messageType === "text";
}

function isPeerKeysMissingError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}

export async function encryptDirectTextMessage(
  userId: string,
  peerUserId: string,
  plaintext: string,
) {
  try {
    const deviceKeys = await ensureE2eDeviceRegistered(userId);
    if (!deviceKeys) {
      throw new Error("Clés E2E indisponibles");
    }

    const bundle = await fetchPreKeyBundle(peerUserId);
    // Chaque message est autonome tant que le stockage ne distingue pas les
    // sessions entrantes et sortantes. Cela évite les racines de session
    // écrasées qui provoquent "aes/gcm: invalid ghash tag".
    const result = encryptForPeer(deviceKeys, null, bundle, peerUserId, plaintext);
    return result.content;
  } catch (error) {
    if (isPeerKeysMissingError(error)) {
      const allowPlaintextFallback = __DEV__ || process.env.EXPO_PUBLIC_E2E_STRICT === "false";
      if (!allowPlaintextFallback) {
        throw new Error("Impossible d'envoyer un message chiffré à ce contact");
      }
      if (__DEV__) {
        console.warn("[Gbairai] E2E: contact sans clés — envoi en clair");
      }
      return plaintext;
    }
    throw error;
  }
}

export async function decryptDirectTextMessage(
  userId: string,
  senderUserId: string,
  content: string,
) {
  if (!isE2ePayload(content)) {
    return content;
  }

  const deviceKeys = await ensureE2eDeviceRegistered(userId);
  if (!deviceKeys) {
    throw new Error("Clés E2E indisponibles");
  }

  const session = await loadSession(userId, senderUserId);
  const result = decryptFromPeer(deviceKeys, session, senderUserId, content);
  if (result.session) {
    await saveSession(userId, result.session);
  }
  return result.plaintext;
}

export async function tryDecryptDirectTextMessage(
  userId: string,
  senderUserId: string,
  content: string,
) {
  if (!isE2ePayload(content)) {
    return content;
  }

  try {
    return await decryptDirectTextMessage(userId, senderUserId, content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const warningKey = `${senderUserId}:${message}:${content.slice(0, 80)}`;
    if (__DEV__ && !e2eDecryptWarningKeys.has(warningKey)) {
      e2eDecryptWarningKeys.add(warningKey);
      console.warn("[Gbairai] E2E decrypt impossible:", {
        senderUserId,
        error: message,
      });
    }
    return E2E_FALLBACK_LABEL;
  }
}
