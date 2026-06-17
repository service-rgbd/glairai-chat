import {
  db,
  e2eDevicesTable,
  e2eOneTimePreKeysTable,
  hasDatabase,
} from "@workspace/db";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type E2eOneTimePreKeyInput = {
  keyId: number;
  publicKey: string;
};

export type RegisterE2eDeviceInput = {
  deviceId: string;
  registrationId: number;
  identityKeyPublic: string;
  signedPreKeyId: number;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;
  oneTimePreKeys: E2eOneTimePreKeyInput[];
};

export type E2ePreKeyBundle = {
  userId: string;
  deviceId: string;
  registrationId: number;
  identityKeyPublic: string;
  signedPreKeyId: number;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;
  oneTimePreKey: E2eOneTimePreKeyInput | null;
};

type DeviceRow = {
  id: string;
  userId: string;
  deviceId: string;
  registrationId: number;
  identityKeyPublic: string;
  signedPreKeyId: number;
  signedPreKeyPublic: string;
  signedPreKeySignature: string;
};

type OneTimeKeyRow = {
  id: string;
  deviceRowId: string;
  keyId: number;
  publicKey: string;
  consumedAt: string | null;
};

const memoryDevices = new Map<string, DeviceRow>();
const memoryOneTimeKeys = new Map<string, OneTimeKeyRow[]>();

function deviceMemoryKey(userId: string, deviceId: string) {
  return `${userId}:${deviceId}`;
}

export function isE2eEnabledOnServer() {
  return process.env.E2E_ENABLED === "true";
}

export async function registerE2eDevice(userId: string, input: RegisterE2eDeviceInput) {
  if (!input.deviceId.trim()) {
    throw new Error("deviceId requis");
  }
  if (!input.identityKeyPublic.trim()) {
    throw new Error("identityKeyPublic requis");
  }
  if (!input.oneTimePreKeys.length) {
    throw new Error("Au moins une oneTimePreKey est requise");
  }

  if (hasDatabase && db) {
    const otherDevices = await db
      .select({ id: e2eDevicesTable.id })
      .from(e2eDevicesTable)
      .where(and(eq(e2eDevicesTable.userId, userId), ne(e2eDevicesTable.deviceId, input.deviceId)));

    for (const other of otherDevices) {
      await db.delete(e2eOneTimePreKeysTable).where(eq(e2eOneTimePreKeysTable.deviceRowId, other.id));
    }
    if (otherDevices.length) {
      await db
        .delete(e2eDevicesTable)
        .where(and(eq(e2eDevicesTable.userId, userId), ne(e2eDevicesTable.deviceId, input.deviceId)));
    }

    const existing = await db
      .select({ id: e2eDevicesTable.id })
      .from(e2eDevicesTable)
      .where(and(eq(e2eDevicesTable.userId, userId), eq(e2eDevicesTable.deviceId, input.deviceId)))
      .limit(1);

    const deviceRowId = existing[0]?.id ?? randomUUID();

    if (existing[0]) {
      await db
        .update(e2eDevicesTable)
        .set({
          registrationId: input.registrationId,
          identityKeyPublic: input.identityKeyPublic,
          signedPreKeyId: input.signedPreKeyId,
          signedPreKeyPublic: input.signedPreKeyPublic,
          signedPreKeySignature: input.signedPreKeySignature,
          updatedAt: new Date(),
        })
        .where(eq(e2eDevicesTable.id, deviceRowId));

      await db.delete(e2eOneTimePreKeysTable).where(eq(e2eOneTimePreKeysTable.deviceRowId, deviceRowId));
    } else {
      await db.insert(e2eDevicesTable).values({
        id: deviceRowId,
        userId,
        deviceId: input.deviceId,
        registrationId: input.registrationId,
        identityKeyPublic: input.identityKeyPublic,
        signedPreKeyId: input.signedPreKeyId,
        signedPreKeyPublic: input.signedPreKeyPublic,
        signedPreKeySignature: input.signedPreKeySignature,
      });
    }

    await db.insert(e2eOneTimePreKeysTable).values(
      input.oneTimePreKeys.map((item) => ({
        id: randomUUID(),
        deviceRowId,
        keyId: item.keyId,
        publicKey: item.publicKey,
      })),
    );

    return { deviceRowId, deviceId: input.deviceId };
  }

  for (const [key, device] of memoryDevices.entries()) {
    if (device.userId === userId && device.deviceId !== input.deviceId) {
      memoryDevices.delete(key);
      memoryOneTimeKeys.delete(device.id);
    }
  }

  const deviceRowId = randomUUID();
  memoryDevices.set(deviceMemoryKey(userId, input.deviceId), {
    id: deviceRowId,
    userId,
    deviceId: input.deviceId,
    registrationId: input.registrationId,
    identityKeyPublic: input.identityKeyPublic,
    signedPreKeyId: input.signedPreKeyId,
    signedPreKeyPublic: input.signedPreKeyPublic,
    signedPreKeySignature: input.signedPreKeySignature,
  });
  memoryOneTimeKeys.set(
    deviceRowId,
    input.oneTimePreKeys.map((item) => ({
      id: randomUUID(),
      deviceRowId,
      keyId: item.keyId,
      publicKey: item.publicKey,
      consumedAt: null,
    })),
  );

  return { deviceRowId, deviceId: input.deviceId };
}

export async function getE2ePreKeyBundle(userId: string): Promise<E2ePreKeyBundle | null> {
  if (hasDatabase && db) {
    const [device] = await db
      .select()
      .from(e2eDevicesTable)
      .where(eq(e2eDevicesTable.userId, userId))
      .orderBy(desc(e2eDevicesTable.updatedAt))
      .limit(1);

    if (!device) return null;

    const [oneTime] = await db
      .select()
      .from(e2eOneTimePreKeysTable)
      .where(
        and(
          eq(e2eOneTimePreKeysTable.deviceRowId, device.id),
          isNull(e2eOneTimePreKeysTable.consumedAt),
        ),
      )
      .limit(1);

    if (oneTime) {
      await db
        .update(e2eOneTimePreKeysTable)
        .set({ consumedAt: new Date() })
        .where(eq(e2eOneTimePreKeysTable.id, oneTime.id));
    }

    return {
      userId,
      deviceId: device.deviceId,
      registrationId: device.registrationId,
      identityKeyPublic: device.identityKeyPublic,
      signedPreKeyId: device.signedPreKeyId,
      signedPreKeyPublic: device.signedPreKeyPublic,
      signedPreKeySignature: device.signedPreKeySignature,
      oneTimePreKey: oneTime
        ? { keyId: oneTime.keyId, publicKey: oneTime.publicKey }
        : null,
    };
  }

  const device = [...memoryDevices.values()].find((item) => item.userId === userId);
  if (!device) return null;

  const keys = memoryOneTimeKeys.get(device.id) ?? [];
  const available = keys.find((item) => !item.consumedAt);
  if (available) {
    available.consumedAt = new Date().toISOString();
  }

  return {
    userId,
    deviceId: device.deviceId,
    registrationId: device.registrationId,
    identityKeyPublic: device.identityKeyPublic,
    signedPreKeyId: device.signedPreKeyId,
    signedPreKeyPublic: device.signedPreKeyPublic,
    signedPreKeySignature: device.signedPreKeySignature,
    oneTimePreKey: available
      ? { keyId: available.keyId, publicKey: available.publicKey }
      : null,
  };
}

export async function listE2eDeviceIds(userId: string) {
  if (hasDatabase && db) {
    const rows = await db
      .select({ deviceId: e2eDevicesTable.deviceId })
      .from(e2eDevicesTable)
      .where(eq(e2eDevicesTable.userId, userId));
    return rows.map((row) => row.deviceId);
  }

  return [...memoryDevices.values()]
    .filter((item) => item.userId === userId)
    .map((item) => item.deviceId);
}
