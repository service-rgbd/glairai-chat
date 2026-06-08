import { customFetch } from "@workspace/api-client-react";

import type { PreKeyBundle } from "@/lib/e2e/types";
import { buildRegisterDevicePayload } from "@/lib/e2e/keys";
import type { StoredDeviceKeys } from "@/lib/e2e/types";

export async function registerDeviceOnServer(keys: StoredDeviceKeys) {
  return customFetch<{ deviceRowId: string; deviceId: string }>("/api/e2e/devices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildRegisterDevicePayload(keys)),
  });
}

export async function fetchPreKeyBundle(peerUserId: string) {
  return customFetch<PreKeyBundle>(`/api/e2e/prekeys/${encodeURIComponent(peerUserId)}`);
}

export async function listPeerDeviceIds(peerUserId: string) {
  return customFetch<{ userId: string; deviceIds: string[] }>(
    `/api/e2e/devices/${encodeURIComponent(peerUserId)}`,
  );
}
