import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { base64ToBytes, bytesToBase64, concatBytes, utf8ToBytes } from "@/lib/e2e/bytes";
import { E2E_CONTENT_PREFIX, E2E_PROTOCOL_INFO } from "@/lib/e2e/config";
import { consumeOneTimePreKey } from "@/lib/e2e/keys";
import type {
  E2eEnvelope,
  PreKeyBundle,
  StoredDeviceKeys,
  StoredSession,
} from "@/lib/e2e/types";

const PROTOCOL_INFO = utf8ToBytes(E2E_PROTOCOL_INFO);
const MESSAGE_INFO = utf8ToBytes(`${E2E_PROTOCOL_INFO}:msg`);

function deriveRootKey(sharedParts: Uint8Array[]) {
  const ikm = concatBytes(...sharedParts);
  return hkdf(sha256, ikm, undefined, PROTOCOL_INFO, 32);
}

function deriveMessageKey(rootKey: Uint8Array) {
  return hkdf(sha256, rootKey, undefined, MESSAGE_INFO, 32);
}

function encryptBytes(messageKey: Uint8Array, plaintext: Uint8Array) {
  const nonce = randomBytes(12);
  const cipher = gcm(messageKey, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  return { nonce, ciphertext };
}

function decryptBytes(messageKey: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array) {
  const cipher = gcm(messageKey, nonce);
  return cipher.decrypt(ciphertext);
}

function deriveInitiatorRootKey(
  identityPrivate: Uint8Array,
  ephemeralPrivate: Uint8Array,
  bundle: PreKeyBundle,
) {
  const peerIdentity = base64ToBytes(bundle.identityKeyPublic);
  const peerSignedPreKey = base64ToBytes(bundle.signedPreKeyPublic);
  const peerOneTimePreKey = bundle.oneTimePreKey
    ? base64ToBytes(bundle.oneTimePreKey.publicKey)
    : null;

  const parts = [
    x25519.getSharedSecret(identityPrivate, peerSignedPreKey),
    x25519.getSharedSecret(ephemeralPrivate, peerIdentity),
    x25519.getSharedSecret(ephemeralPrivate, peerSignedPreKey),
  ];

  if (peerOneTimePreKey) {
    parts.push(x25519.getSharedSecret(ephemeralPrivate, peerOneTimePreKey));
  }

  return deriveRootKey(parts);
}

function deriveResponderRootKey(
  deviceKeys: StoredDeviceKeys,
  envelope: Extract<E2eEnvelope, { t: "init" }>,
) {
  const senderIdentity = base64ToBytes(envelope.ik);
  const senderEphemeral = base64ToBytes(envelope.ep);
  const signedPreKeyPrivate = base64ToBytes(deviceKeys.signedPreKeyPrivate);
  const identityPrivate = base64ToBytes(deviceKeys.identityPrivate);
  const oneTimePrivate = consumeOneTimePreKey(deviceKeys, envelope.opk);

  const parts = [
    x25519.getSharedSecret(signedPreKeyPrivate, senderIdentity),
    x25519.getSharedSecret(identityPrivate, senderEphemeral),
    x25519.getSharedSecret(signedPreKeyPrivate, senderEphemeral),
  ];

  if (oneTimePrivate) {
    parts.push(x25519.getSharedSecret(base64ToBytes(oneTimePrivate), senderEphemeral));
  }

  return deriveRootKey(parts);
}

export function serializeEnvelope(envelope: E2eEnvelope) {
  return `${E2E_CONTENT_PREFIX}${bytesToBase64(utf8ToBytes(JSON.stringify(envelope)))}`;
}

export function parseEnvelope(content: string): E2eEnvelope | null {
  if (!content.startsWith(E2E_CONTENT_PREFIX)) return null;
  try {
    const payload = content.slice(E2E_CONTENT_PREFIX.length);
    const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(payload))) as E2eEnvelope;
    if (parsed?.v !== 1) return null;
    if (parsed.t !== "init" && parsed.t !== "msg") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function encryptForPeer(
  deviceKeys: StoredDeviceKeys,
  session: StoredSession | null,
  bundle: PreKeyBundle | null,
  peerUserId: string,
  plaintext: string,
): { content: string; session: StoredSession } {
  const plaintextBytes = utf8ToBytes(plaintext);

  if (session) {
    const messageKey = deriveMessageKey(base64ToBytes(session.rootKey));
    const { nonce, ciphertext } = encryptBytes(messageKey, plaintextBytes);
    const envelope: E2eEnvelope = {
      v: 1,
      t: "msg",
      n: bytesToBase64(nonce),
      ct: bytesToBase64(ciphertext),
    };
    return { content: serializeEnvelope(envelope), session };
  }

  if (!bundle) {
    throw new Error("Bundle de clés E2E indisponible");
  }

  const identityPrivate = base64ToBytes(deviceKeys.identityPrivate);
  const ephemeral = x25519.keygen();
  const rootKey = deriveInitiatorRootKey(identityPrivate, ephemeral.secretKey, bundle);
  const messageKey = deriveMessageKey(rootKey);
  const { nonce, ciphertext } = encryptBytes(messageKey, plaintextBytes);

  const envelope: E2eEnvelope = {
    v: 1,
    t: "init",
    ep: bytesToBase64(ephemeral.publicKey),
    ik: deviceKeys.identityPublic,
    spk: bundle.signedPreKeyId,
    opk: bundle.oneTimePreKey?.keyId ?? null,
    n: bytesToBase64(nonce),
    ct: bytesToBase64(ciphertext),
  };

  return {
    content: serializeEnvelope(envelope),
    session: {
      peerUserId,
      rootKey: bytesToBase64(rootKey),
    },
  };
}

export function decryptFromPeer(
  deviceKeys: StoredDeviceKeys,
  session: StoredSession | null,
  senderUserId: string,
  content: string,
): { plaintext: string; session: StoredSession | null } {
  const envelope = parseEnvelope(content);
  if (!envelope) {
    throw new Error("Enveloppe E2E invalide");
  }

  let nextSession = session;
  let rootKeyBytes: Uint8Array;

  if (envelope.t === "init") {
    rootKeyBytes = deriveResponderRootKey(deviceKeys, envelope);
    nextSession = {
      peerUserId: senderUserId,
      rootKey: bytesToBase64(rootKeyBytes),
    };
  } else {
    if (!session) {
      throw new Error("Session E2E absente");
    }
    rootKeyBytes = base64ToBytes(session.rootKey);
  }

  const messageKey = deriveMessageKey(rootKeyBytes);
  const plaintext = decryptBytes(
    messageKey,
    base64ToBytes(envelope.n),
    base64ToBytes(envelope.ct),
  );

  return {
    plaintext: new TextDecoder().decode(plaintext),
    session: nextSession,
  };
}
