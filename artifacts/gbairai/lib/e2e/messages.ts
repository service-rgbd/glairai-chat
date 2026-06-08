import { fetchPreKeyBundle } from "@/lib/e2e/api";
import { isE2eEnabled, isE2ePayload, E2E_FALLBACK_LABEL } from "@/lib/e2e/config";
import { decryptFromPeer, encryptForPeer } from "@/lib/e2e/crypto";
import { ensureE2eDeviceRegistered } from "@/lib/e2e/bootstrap";
import { loadSession, saveSession } from "@/lib/e2e/store";

export { isE2ePayload, E2E_FALLBACK_LABEL };

export function shouldEncryptDirectText(chatType: string, messageType: string) {
  return isE2eEnabled() && chatType === "direct" && messageType === "text";
}

export async function encryptDirectTextMessage(
  userId: string,
  peerUserId: string,
  plaintext: string,
) {
  const deviceKeys = await ensureE2eDeviceRegistered(userId);
  if (!deviceKeys) {
    throw new Error("Clés E2E indisponibles");
  }

  let session = await loadSession(userId, peerUserId);
  let bundle = null;
  if (!session) {
    bundle = await fetchPreKeyBundle(peerUserId);
  }

  const result = encryptForPeer(deviceKeys, session, bundle, peerUserId, plaintext);
  await saveSession(userId, result.session);
  return result.content;
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
  } catch {
    return E2E_FALLBACK_LABEL;
  }
}
