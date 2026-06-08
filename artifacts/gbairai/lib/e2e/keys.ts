import { x25519 } from "@noble/curves/ed25519.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/ciphers/utils.js";

import { bytesToBase64 } from "@/lib/e2e/bytes";
import { E2E_ONE_TIME_PREKEY_COUNT } from "@/lib/e2e/config";
import type { StoredDeviceKeys } from "@/lib/e2e/types";

function randomRegistrationId() {
  return (randomBytes(2)[0]! << 8) | randomBytes(2)[1]!;
}

function signPreKey(identityPrivateKey: Uint8Array, signedPreKeyPublic: Uint8Array) {
  return bytesToBase64(hmac(sha256, identityPrivateKey, signedPreKeyPublic));
}

export function generateDeviceKeys(deviceId: string): StoredDeviceKeys {
  const identity = x25519.keygen();
  const signedPreKey = x25519.keygen();
  const signedPreKeyId = 1;
  const signedPreKeySignature = signPreKey(identity.secretKey, signedPreKey.publicKey);

  const oneTimePreKeys = Array.from({ length: E2E_ONE_TIME_PREKEY_COUNT }, (_, index) => {
    const keyPair = x25519.keygen();
    return {
      keyId: index + 1,
      publicKey: bytesToBase64(keyPair.publicKey),
      privateKey: bytesToBase64(keyPair.secretKey),
    };
  });

  return {
    deviceId,
    registrationId: randomRegistrationId() || 1,
    identityPublic: bytesToBase64(identity.publicKey),
    identityPrivate: bytesToBase64(identity.secretKey),
    signedPreKeyId,
    signedPreKeyPublic: bytesToBase64(signedPreKey.publicKey),
    signedPreKeyPrivate: bytesToBase64(signedPreKey.secretKey),
    signedPreKeySignature,
    oneTimePreKeys,
  };
}

export function buildRegisterDevicePayload(keys: StoredDeviceKeys) {
  return {
    deviceId: keys.deviceId,
    registrationId: keys.registrationId,
    identityKeyPublic: keys.identityPublic,
    signedPreKeyId: keys.signedPreKeyId,
    signedPreKeyPublic: keys.signedPreKeyPublic,
    signedPreKeySignature: keys.signedPreKeySignature,
    oneTimePreKeys: keys.oneTimePreKeys.map((item) => ({
      keyId: item.keyId,
      publicKey: item.publicKey,
    })),
  };
}

export function consumeOneTimePreKey(keys: StoredDeviceKeys, keyId: number | null) {
  if (keyId == null) return null;
  const match = keys.oneTimePreKeys.find((item) => item.keyId === keyId);
  return match?.privateKey ?? null;
}
