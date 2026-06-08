export type StoredOneTimePreKey = {
  keyId: number;
  publicKey: string;
  privateKey: string;
};

export type StoredDeviceKeys = {
  deviceId: string;
  registrationId: number;
  identityPublic: string;
  identityPrivate: string;
  signedPreKeyId: number;
  signedPreKeyPublic: string;
  signedPreKeyPrivate: string;
  signedPreKeySignature: string;
  oneTimePreKeys: StoredOneTimePreKey[];
};

export type StoredSession = {
  peerUserId: string;
  rootKey: string;
};

export type PreKeyBundle = {
  userId: string;
  deviceId: string;
  registrationId: number;
  identityKeyPublic: string;
  signedPreKeyId: number;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;
  oneTimePreKey: { keyId: number; publicKey: string } | null;
};

export type E2eInitEnvelope = {
  v: 1;
  t: "init";
  ep: string;
  ik: string;
  spk: number;
  opk: number | null;
  n: string;
  ct: string;
};

export type E2eMsgEnvelope = {
  v: 1;
  t: "msg";
  n: string;
  ct: string;
};

export type E2eEnvelope = E2eInitEnvelope | E2eMsgEnvelope;
