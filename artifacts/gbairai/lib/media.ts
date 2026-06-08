import { getApiBaseUrl } from "./api-config";
import { File } from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";
import type { UploadPhase } from "./upload-status";

function buildMediaProxyUrl(key: string) {
  return `${getApiBaseUrl()}/api/media/public?key=${encodeURIComponent(key)}`;
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
}

export interface VideoMessagePayload {
  url?: string;
  key: string;
  mimeType: string;
  durationSeconds?: number;
  thumbnailKey?: string;
  thumbnailUrl?: string;
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

export function getDisplayMediaUrl(key: string, url?: string | null) {
  if (url && url.trim()) {
    return url;
  }
  return buildMediaProxyUrl(key);
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
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(text.trim() || "Impossible d'envoyer le fichier audio");
  }
}

export async function uploadFileToSignedUrl(
  uploadUrl: string,
  fileUri: string,
  mimeType: string,
) {
  const file = new File(fileUri);
  const buffer = await file.arrayBuffer();
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": mimeType,
    },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(text.trim() || "Impossible d'envoyer le média");
  }
}

export async function generateVideoThumbnailUri(videoUri: string) {
  const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
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
    onPhase?: (phase: UploadPhase) => void;
  },
) {
  input.onPhase?.("preparing");

  const thumbnailUri = await generateVideoThumbnailUri(input.videoUri);
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
  await uploadFileToSignedUrl(videoTarget.uploadUrl, input.videoUri, input.videoMimeType);
  await uploadFileToSignedUrl(thumbnailTarget.uploadUrl, thumbnailUri, "image/jpeg");

  input.onPhase?.("finalizing");

  return {
    url: getDisplayMediaUrl(videoTarget.key, videoTarget.publicUrl),
    key: videoTarget.key,
    mimeType: input.videoMimeType,
    thumbnailKey: thumbnailTarget.key,
    thumbnailUrl: getDisplayMediaUrl(thumbnailTarget.key, thumbnailTarget.publicUrl),
  };
}

export async function uploadStoryMediaWithThumbnail(
  authToken: string,
  input: {
    mediaUri: string;
    mimeType: string;
    type: "image" | "video";
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
  await uploadFileToSignedUrl(target.uploadUrl, input.mediaUri, input.mimeType);

  let thumbnailUrl: string | undefined;
  if (input.type === "video") {
    const thumbnailUri = await generateVideoThumbnailUri(input.mediaUri);
    const thumbnailTarget = await createMediaUploadTarget(authToken, {
      category: "story-image",
      mimeType: "image/jpeg",
    });
    await uploadFileToSignedUrl(thumbnailTarget.uploadUrl, thumbnailUri, "image/jpeg");
    thumbnailUrl = getDisplayMediaUrl(thumbnailTarget.key, thumbnailTarget.publicUrl);
  }

  input.onPhase?.("finalizing");

  return {
    url: getDisplayMediaUrl(target.key, target.publicUrl),
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

export function encodeImageMessagePayload(payload: ImageMessagePayload) {
  return JSON.stringify(payload);
}

export function parseImageMessagePayload(content: string): ImageMessagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<ImageMessagePayload>;
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
    const parsed = JSON.parse(content) as Partial<VideoMessagePayload>;
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
