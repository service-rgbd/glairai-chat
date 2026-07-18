import { Directory, File, Paths } from "expo-file-system";

import { getMediaAuthHeaders, isProtectedMediaUrl } from "@/lib/auth-token";

const CACHE_FOLDER = "gbairai-media";
const MAX_CACHE_BYTES = 500 * 1024 * 1024;
const inFlight = new Map<string, Promise<string>>();

function getCacheDirectory() {
  return new Directory(Paths.cache, CACHE_FOLDER);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extensionFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const keyParam = parsed.searchParams.get("key");
    if (keyParam) {
      const decoded = decodeURIComponent(keyParam);
      const keyMatch = decoded.match(/(\.[a-z0-9]{2,5})$/i);
      if (keyMatch?.[1]) {
        return keyMatch[1].toLowerCase();
      }
    }

    const pathname = parsed.pathname;
    const match = pathname.match(/(\.[a-z0-9]{2,5})$/i);
    return match?.[1]?.toLowerCase() ?? ".bin";
  } catch {
    return ".bin";
  }
}

function cacheFileForUrl(remoteUrl: string) {
  const directory = getCacheDirectory();
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }

  const cacheKey = `${hashString(remoteUrl)}${extensionFromUrl(remoteUrl)}`;
  return new File(directory, cacheKey);
}

async function getDirectorySizeBytes(directory: Directory) {
  if (!directory.exists) return 0;

  let total = 0;
  for (const entry of directory.list()) {
    if (entry instanceof File) {
      total += entry.size ?? 0;
    }
  }
  return total;
}

async function trimCacheIfNeeded() {
  const directory = getCacheDirectory();
  if (!directory.exists) return;

  const files = directory
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .sort((left, right) => (left.modificationTime ?? 0) - (right.modificationTime ?? 0));

  let totalBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  if (totalBytes <= MAX_CACHE_BYTES) return;

  for (const file of files) {
    if (totalBytes <= MAX_CACHE_BYTES) break;
    totalBytes -= file.size ?? 0;
    if (file.exists) {
      file.delete();
    }
  }
}

async function downloadToCache(remoteUrl: string) {
  const target = cacheFileForUrl(remoteUrl);
  if (target.exists) {
    return target.uri;
  }

  if (isProtectedMediaUrl(remoteUrl)) {
    const response = await fetch(remoteUrl, { headers: getMediaAuthHeaders() });
    if (!response.ok) {
      throw new Error("Impossible de télécharger le média");
    }
    const bytes = await response.arrayBuffer();
    target.write(new Uint8Array(bytes));
    await trimCacheIfNeeded();
    return target.uri;
  }

  const downloaded = await File.downloadFileAsync(remoteUrl, target, { idempotent: true });
  await trimCacheIfNeeded();
  return downloaded.uri;
}

export async function resolveCachedMediaUri(remoteUrl: string | null | undefined) {
  if (!remoteUrl?.trim()) return null;

  const trimmed = remoteUrl.trim();
  if (trimmed.startsWith("file://")) {
    return trimmed;
  }

  const existing = inFlight.get(trimmed);
  if (existing) {
    return existing;
  }

  const promise = downloadToCache(trimmed).finally(() => {
    inFlight.delete(trimmed);
  });
  inFlight.set(trimmed, promise);
  return promise;
}

export function peekCachedMediaUri(remoteUrl: string | null | undefined) {
  if (!remoteUrl?.trim()) return null;
  const trimmed = remoteUrl.trim();
  if (trimmed.startsWith("file://")) return trimmed;

  const target = cacheFileForUrl(trimmed);
  return target.exists ? target.uri : null;
}

export async function prefetchMediaUri(remoteUrl: string | null | undefined) {
  if (!remoteUrl?.trim()) return;
  try {
    await resolveCachedMediaUri(remoteUrl);
  } catch {
    // Best effort only.
  }
}

export async function clearMediaCache() {
  const directory = getCacheDirectory();
  if (!directory.exists) {
    return { bytesFreed: 0, filesRemoved: 0 };
  }

  const files = directory.list().filter((entry): entry is File => entry instanceof File);
  const bytesFreed = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
  directory.delete();
  inFlight.clear();
  return { bytesFreed, filesRemoved: files.length };
}

export async function getMediaCacheStats() {
  const directory = getCacheDirectory();
  if (!directory.exists) {
    return { bytes: 0, files: 0 };
  }

  const files = directory.list().filter((entry): entry is File => entry instanceof File);
  return {
    bytes: await getDirectorySizeBytes(directory),
    files: files.length,
  };
}
