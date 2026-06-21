const CONTACTS_SYNC_TTL_MS = 15 * 60 * 1000;

type SyncState = {
  lastSyncedAt: number;
  inFlight: Promise<unknown> | null;
  permissionDenied: boolean;
};

const syncState: SyncState = {
  lastSyncedAt: 0,
  inFlight: null,
  permissionDenied: false,
};

export function markContactsSynced() {
  syncState.lastSyncedAt = Date.now();
}

export function resetContactsSyncState() {
  syncState.lastSyncedAt = 0;
  syncState.inFlight = null;
}

export function resetContactsPermissionState() {
  syncState.permissionDenied = false;
}

export function markContactsPermissionDenied() {
  syncState.permissionDenied = true;
}

export function isContactsPermissionDenied() {
  return syncState.permissionDenied;
}

export function isContactsSyncFresh() {
  return syncState.lastSyncedAt > 0 && Date.now() - syncState.lastSyncedAt < CONTACTS_SYNC_TTL_MS;
}

export async function runContactsSyncOnce<T>(task: () => Promise<T>): Promise<T> {
  if (syncState.inFlight) {
    return syncState.inFlight as Promise<T>;
  }

  const promise = task()
    .then((result) => {
      markContactsSynced();
      return result;
    })
    .finally(() => {
      syncState.inFlight = null;
    });
  syncState.inFlight = promise;
  return promise;
}
