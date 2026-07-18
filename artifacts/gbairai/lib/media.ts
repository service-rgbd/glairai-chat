import { getApiBaseUrl } from "./api-config";
import { File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";
import type { UploadPhase } from "./upload-status";

function buildMediaProxyUrl(key: string) {
  return `${getApiBaseUrl()}/api/media/public?key=${encodeURIComponent(key)}`;
}

const MEDIA_KEY_PREFIX = /^(chat-media|stories|avatars|voice-notes)\//;

export function extractMediaStorageKey(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (MEDIA_KEY_PREFIX.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const keyParam = parsed.searchParams.get("key")?.trim();
    if (keyParam && MEDIA_KEY_PREFIX.test(keyParam)) {
      return decodeURIComponent(keyParam);
    }

    const pathname = parsed.pathname.replace(/^\/+/, "");
    if (MEDIA_KEY_PREFIX.test(pathname)) {
      return decodeURIComponent(pathname);
    }
  } catch {
    if (trimmed.startsWith("/api/media/public")) {
      try {
        const keyParam = new URL(trimmed, "https://gbairai.local").searchParams
          .get("key")
          ?.trim();
        if (keyParam && MEDIA_KEY_PREFIX.test(keyParam)) {
          return decodeURIComponent(keyParam);
        }
      } catch {
        // Ignore malformed proxy paths.
      }
    }
  }

  return null;
}

function extractMediaKeyFromPublicUrl(url?: string | null) {
  return extractMediaStorageKey(url);
}

export function isStableDisplayUrl(url?: string | null) {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  if (/^(file:|blob:|data:)/i.test(trimmed)) return true;
  if (trimmed.includes("/api/media/public")) return true;
  return false;
}

export function getDisplayMediaUrl(key: string, url?: string | null) {
  const mediaKey = key?.trim() || extractMediaStorageKey(url);
  if (mediaKey) {
    return buildMediaProxyUrl(mediaKey);
  }

  const trimmed = url?.trim();
  if (!trimmed) return "";

  if (/^(file:|blob:|data:|content:|ph:|assets-library:)/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

export async function getUploadDisplayUrl(
  _authToken: string,
  key: string,
  _publicUrl?: string | null,
) {
  return buildMediaProxyUrl(key);
}

export interface AudioUploadTarget {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  contentType: string;
}

export type MediaCategory =
  | "audio"
  | "avatar"
  | "chat-image"
  | "chat-video"
  | "story-image"
  | "story-video";

export interface AudioMessagePayload {
  url?: string;
  key: string;
  durationSeconds: number;
  mimeType: string;
}

export interface MediaUploadTarget {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  contentType: string;
  category: MediaCategory;
}

export interface ImageMessagePayload {
  url?: string;
  key: string;
  mimeType: string;
  width?: number;
  height?: number;
  viewOnce?: boolean;
}

export interface VideoMessagePayload {
  url?: string;
  key: string;
  mimeType: string;
  durationSeconds?: number;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  viewOnce?: boolean;
}

export interface StoryMediaPayload {
  url?: string;
  key: string;
  mimeType: string;
  type: "text" | "image" | "video";
  caption?: string;
  thumbnailUrl?: string;
}

export async function resolveMediaUrl(authToken: string, key: string) {
  const response = await fetch(
    `${getApiBaseUrl()}/api/media/resolve?key=${encodeURIComponent(key)}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${authToken}`,
        accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.trim() || "Impossible de résoudre le média");
  }

  const parsed = (await response.json()) as { url: string };
  return parsed.url;
}

function stripUriFragment(uri: string) {
  const hashIndex = uri.indexOf("#");
  return hashIndex >= 0 ? uri.slice(0, hashIndex) : uri;
}

function extensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("quicktime")) return ".mov";
  if (normalized.includes("mp4") || normalized.includes("mpeg")) return ".mp4";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  return ".bin";
}

function isPreparedUploadUri(uri: string) {
  return uri.includes("/upload-") && uri.startsWith(Paths.cache.uri);
}

async function resolveReadableSourceUri(sourceUri: string, assetId?: string | null) {
  let readableUri = stripUriFragment(sourceUri);

  if (Platform.OS === "ios" && assetId) {
    try {
      const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId, {
        shouldDownloadFromNetwork: true,
      });
      if (assetInfo.localUri) {
        readableUri = stripUriFragment(assetInfo.localUri);
      }
    } catch {
      // On continue avec l'URI fournie par le picker.
    }
  }

  return readableUri;
}

/** Copie un média de la photothèque iOS vers le cache app (lecture sandbox). */
export async function prepareLocalMediaUriForUpload(
  sourceUri: string,
  mimeType: string,
  assetId?: string | null,
) {
  if (isPreparedUploadUri(sourceUri)) {
    return sourceUri;
  }

  const readableUri = await resolveReadableSourceUri(sourceUri, assetId);
  const destination = new File(Paths.cache, `upload-${Date.now()}${extensionFromMimeType(mimeType)}`);

  if (Platform.OS === "ios") {
    await copyAsync({ from: readableUri, to: destination.uri });
    return destination.uri;
  }

  const source = new File(readableUri);
  source.copy(destination);
  return destination.uri;
}

export async function createAudioUploadTarget(authToken: string, mimeType: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/media/audio/upload-target`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${authToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ mimeType }),
  });
  if (!response.ok) {
    throw new Error("Impossible de préparer l'upload audio");
  }
  return (await response.json()) as AudioUploadTarget;
}

export async function createMediaUploadTarget(
  authToken: string,
  input: { category: MediaCategory; mimeType: string; conversationId?: string },
) {
  const response = await fetch(`${getApiBaseUrl()}/api/media/upload-target`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${authToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(input),
  });
  const rawText = await response.text();
  if (!response.ok) {
    try {
      const parsed = JSON.parse(rawText) as { message?: string };
      throw new Error(parsed.message || "Impossible de préparer l'upload média");
    } catch {
      throw new Error(rawText.trim() || "Impossible de préparer l'upload média");
    }
  }
  return JSON.parse(rawText) as MediaUploadTarget;
}

export async function uploadAudioToSignedUrl(
  uploadUrl: string,
  fileUri: string,
  mimeType: string,
) {
  const file = new File(fileUri);
  const buffer = await file.arrayBuffer();
  await uploadBytesToSignedUrl(uploadUrl, buffer, mimeType);
}

const MEDIA_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

function uploadBytesToSignedUrl(
  uploadUrl: string,
  body: ArrayBuffer,
  mimeType: string,
  timeoutMs = MEDIA_UPLOAD_TIMEOUT_MS,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("content-type", mimeType);
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(xhr.responseText?.trim() || "Impossible d'envoyer le média"));
    };
    xhr.onerror = () => {
      reject(new TypeError("Connexion interrompue pendant l'envoi du média"));
    };
    xhr.ontimeout = () => {
      reject(
        new TypeError(
          "L'envoi a pris trop de temps. Vérifiez votre connexion ou essayez une vidéo plus courte.",
        ),
      );
    };
    xhr.send(body);
  });
}

export async function uploadFileToSignedUrl(
  uploadUrl: string,
  fileUri: string,
  mimeType: string,
  assetId?: string | null,
) {
  const readableUri = await prepareLocalMediaUriForUpload(fileUri, mimeType, assetId);
  const file = new File(readableUri);
  const buffer = await file.arrayBuffer();
  await uploadBytesToSignedUrl(uploadUrl, buffer, mimeType);
}

export async function generateVideoThumbnailUri(videoUri: string) {
  const readableUri = stripUriFragment(videoUri);
  const { uri } = await VideoThumbnails.getThumbnailAsync(readableUri, {
    time: 0,
    quality: 0.72,
  });
  return uri;
}

export async function uploadChatVideoWithThumbnail(
  authToken: string,
  input: {
    videoUri: string;
    videoMimeType: string;
    conversationId: string;
    thumbnailUri?: string;
    assetId?: string | null;
    onPhase?: (phase: UploadPhase) => void;
  },
) {
  input.onPhase?.("preparing");

  const videoUri = await prepareLocalMediaUriForUpload(
    input.videoUri,
    input.videoMimeType,
    input.assetId,
  );
  const thumbnailUri =
    input.thumbnailUri ?? (await generateVideoThumbnailUri(videoUri));
  const videoTarget = await createMediaUploadTarget(authToken, {
    category: "chat-video",
    mimeType: input.videoMimeType,
    conversationId: input.conversationId,
  });
  const thumbnailTarget = await createMediaUploadTarget(authToken, {
    category: "chat-image",
    mimeType: "image/jpeg",
    conversationId: input.conversationId,
  });

  input.onPhase?.("uploading");
  await uploadFileToSignedUrl(videoTarget.uploadUrl, videoUri, input.videoMimeType);
  await uploadFileToSignedUrl(thumbnailTarget.uploadUrl, thumbnailUri, "image/jpeg");

  input.onPhase?.("finalizing");

  return {
    url: await getUploadDisplayUrl(authToken, videoTarget.key, videoTarget.publicUrl),
    key: videoTarget.key,
    mimeType: input.videoMimeType,
    thumbnailKey: thumbnailTarget.key,
    thumbnailUrl: await getUploadDisplayUrl(authToken, thumbnailTarget.key, thumbnailTarget.publicUrl),
  };
}

export async function uploadStoryMediaWithThumbnail(
  authToken: string,
  input: {
    mediaUri: string;
    mimeType: string;
    type: "image" | "video";
    assetId?: string | null;
    onPhase?: (phase: UploadPhase) => void;
  },
) {
  input.onPhase?.("preparing");
  const category = input.type === "image" ? "story-image" : "story-video";
  const target = await createMediaUploadTarget(authToken, {
    category,
    mimeType: input.mimeType,
  });

  input.onPhase?.("uploading");
  const mediaUri = await prepareLocalMediaUriForUpload(
    input.mediaUri,
    input.mimeType,
    input.assetId,
  );
  await uploadFileToSignedUrl(target.uploadUrl, mediaUri, input.mimeType);

  let thumbnailUrl: string | undefined;
  if (input.type === "video") {
    const thumbnailUri = await generateVideoThumbnailUri(mediaUri);
    const thumbnailTarget = await createMediaUploadTarget(authToken, {
      category: "story-image",
      mimeType: "image/jpeg",
    });
    await uploadFileToSignedUrl(thumbnailTarget.uploadUrl, thumbnailUri, "image/jpeg");
    thumbnailUrl = await getUploadDisplayUrl(authToken, thumbnailTarget.key, thumbnailTarget.publicUrl);
  }

  input.onPhase?.("finalizing");

  return {
    url: await getUploadDisplayUrl(authToken, target.key, target.publicUrl),
    key: target.key,
    mimeType: input.mimeType,
    thumbnailUrl,
  };
}

export function encodeAudioMessagePayload(payload: AudioMessagePayload) {
  return JSON.stringify(payload);
}

export function parseAudioMessagePayload(content: string): AudioMessagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<AudioMessagePayload>;
    if (
      typeof parsed?.key !== "string" ||
      typeof parsed?.durationSeconds !== "number" ||
      typeof parsed?.mimeType !== "string"
    ) {
      return null;
    }
    return {
      url: typeof parsed.url === "string" ? parsed.url : undefined,
      key: parsed.key,
      durationSeconds: parsed.durationSeconds,
      mimeType: parsed.mimeType,
    };
  } catch {
    return null;
  }
}

export function resolveAudioMessageUrl(payload: Pick<AudioMessagePayload, "key" | "url">) {
  const resolved = getDisplayMediaUrl(payload.key, payload.url);
  return resolved || null;
}

export function encodeImageMessagePayload(payload: ImageMessagePayload) {
  return JSON.stringify(payload);
}

export function parseImageMessagePayload(content: string): ImageMessagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<ImageMessagePayload> & { kind?: string };
    if (parsed?.kind === "view_once_opened" || parsed?.kind === "deleted") {
      return null;
    }
    if (
      typeof parsed?.key !== "string" ||
      typeof parsed?.mimeType !== "string"
    ) {
      return null;
    }
    return {
      url: typeof parsed.url === "string" ? parsed.url : undefined,
      key: parsed.key,
      mimeType: parsed.mimeType,
      width: typeof parsed.width === "number" ? parsed.width : undefined,
      height: typeof parsed.height === "number" ? parsed.height : undefined,
      viewOnce: parsed.viewOnce === true ? true : undefined,
    };
  } catch {
    return null;
  }
}

export function encodeVideoMessagePayload(payload: VideoMessagePayload) {
  return JSON.stringify(payload);
}

export function parseVideoMessagePayload(content: string): VideoMessagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<VideoMessagePayload> & { kind?: string };
    if (parsed?.kind === "view_once_opened" || parsed?.kind === "deleted") {
      return null;
    }
    if (
      typeof parsed?.key !== "string" ||
      typeof parsed?.mimeType !== "string"
    ) {
      return null;
    }
    return {
      url: typeof parsed.url === "string" ? parsed.url : undefined,
      key: parsed.key,
      mimeType: parsed.mimeType,
      durationSeconds:
        typeof parsed.durationSeconds === "number" ? parsed.durationSeconds : undefined,
      thumbnailKey: typeof parsed.thumbnailKey === "string" ? parsed.thumbnailKey : undefined,
      thumbnailUrl: typeof parsed.thumbnailUrl === "string" ? parsed.thumbnailUrl : undefined,
      viewOnce: parsed.viewOnce === true ? true : undefined,
    };
  } catch {
    return null;
  }
}

export function encodeStoryMediaPayload(payload: StoryMediaPayload) {
  return JSON.stringify(payload);
}

export function parseStoryMediaPayload(content: string): StoryMediaPayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<StoryMediaPayload>;
    if (
      typeof parsed?.key !== "string" ||
      typeof parsed?.mimeType !== "string" ||
      (parsed?.type !== "text" && parsed?.type !== "image" && parsed?.type !== "video")
    ) {
      return null;
    }
    return {
      url: typeof parsed.url === "string" ? parsed.url : undefined,
      key: parsed.key,
      mimeType: parsed.mimeType,
      type: parsed.type,
      caption: typeof parsed.caption === "string" ? parsed.caption : undefined,
      thumbnailUrl: typeof parsed.thumbnailUrl === "string" ? parsed.thumbnailUrl : undefined,
    };
  } catch {
    return null;
  }
}
