export type MediaCachePolicy = {
  autoDownloadMedia: boolean;
  lowDataMode: boolean;
};

const DEFAULT_POLICY: MediaCachePolicy = {
  autoDownloadMedia: true,
  lowDataMode: false,
};

let currentPolicy: MediaCachePolicy = { ...DEFAULT_POLICY };

export function setMediaCachePolicy(policy: Partial<MediaCachePolicy>) {
  currentPolicy = { ...currentPolicy, ...policy };
}

export function getMediaCachePolicy(): MediaCachePolicy {
  return currentPolicy;
}

export function shouldPrefetchMedia() {
  const { autoDownloadMedia, lowDataMode } = currentPolicy;
  return autoDownloadMedia && !lowDataMode;
}

export function shouldResolveMediaToDisk() {
  return !currentPolicy.lowDataMode;
}
