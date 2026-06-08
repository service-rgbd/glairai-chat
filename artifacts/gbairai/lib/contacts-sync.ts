const CONTACTS_SYNC_TTL_MS = 15 * 60 * 1000;

type SyncState = {
  lastSyncedAt: number;
  inFlight: Promise<unknown> | null;
};

const syncState: SyncState = {
  lastSyncedAt: 0,
  inFlight: null,
};

export function markContactsSynced() {
  syncState.lastSyncedAt = Date.now();
}

export function resetContactsSyncState() {
  syncState.lastSyncedAt = 0;
  syncState.inFlight = null;
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
