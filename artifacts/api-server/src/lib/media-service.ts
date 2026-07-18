import { randomUUID } from "node:crypto";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env["R2_ACCOUNT_ID"]?.trim() ?? "";
const R2_ACCESS_KEY_ID = process.env["R2_ACCESS_KEY_ID"]?.trim() ?? "";
const R2_SECRET_ACCESS_KEY = process.env["R2_SECRET_ACCESS_KEY"]?.trim() ?? "";
const R2_BUCKET_NAME = process.env["R2_BUCKET_NAME"]?.trim() ?? "";
const R2_PUBLIC_BASE_URL = process.env["R2_PUBLIC_BASE_URL"]?.trim() ?? "";

function requireR2Config() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error("Configuration Cloudflare R2 manquante");
  }
}

function getR2Endpoint() {
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function getPublicUrl(key: string) {
  if (R2_PUBLIC_BASE_URL) {
    return `${R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`;
  }
  return "";
}

function createClient() {
  requireR2Config();
  return new S3Client({
    region: "auto",
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
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

export function normalizeAvatarStorageKey(value?: string | null) {
  if (!value?.trim()) return null;
  if (/^(file:|content:|ph:|assets-library:)/i.test(value.trim())) {
    return null;
  }

  const key = extractMediaStorageKey(value);
  if (key?.startsWith("avatars/")) {
    return key;
  }

  return null;
}

function extensionForContentType(contentType: string) {
  if (contentType === "audio/aac") return "aac";
  if (contentType === "audio/mpeg") return "mp3";
  if (contentType === "audio/wav") return "wav";
  if (contentType === "audio/mp4" || contentType === "audio/m4a" || contentType === "audio/x-m4a") {
    return "m4a";
  }
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  return "bin";
}

function buildMediaKey(
  category: MediaCategory,
  userId: string,
  contentType: string,
  conversationId?: string,
) {
  const extension = extensionForContentType(contentType);

  const baseDate = new Date().toISOString().slice(0, 10);
  const randomName = `${randomUUID()}.${extension}`;

  switch (category) {
    case "audio":
      return `voice-notes/${userId}/${baseDate}/${randomName}`;
    case "avatar":
      return `avatars/${userId}/${randomName}`;
    case "chat-image":
      return `chat-media/${conversationId ?? "shared"}/${userId}/images/${randomName}`;
    case "chat-video":
      return `chat-media/${conversationId ?? "shared"}/${userId}/videos/${randomName}`;
    case "story-image":
      return `stories/${userId}/images/${baseDate}/${randomName}`;
    case "story-video":
      return `stories/${userId}/videos/${baseDate}/${randomName}`;
  }
}

export async function createAudioUploadTarget(userId: string, mimeType: string) {
  const contentType = mimeType.trim() || "audio/mp4";
  const key = buildMediaKey("audio", userId, contentType);

  const client = createClient();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 10 });

  return {
    key,
    uploadUrl,
    publicUrl: getPublicUrl(key),
    contentType,
  } satisfies AudioUploadTarget;
}

export async function createMediaUploadTarget(input: {
  userId: string;
  category: MediaCategory;
  mimeType: string;
  conversationId?: string;
}) {
  const contentType = input.mimeType.trim() || "application/octet-stream";
  const key = buildMediaKey(input.category, input.userId, contentType, input.conversationId);
  const client = createClient();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 10 });
  return {
    key,
    uploadUrl,
    publicUrl: getPublicUrl(key),
    contentType,
    category: input.category,
  };
}

export function resolveMediaUrl(key: string) {
  requireR2Config();
  return getPublicUrl(key);
}

export async function getMediaReadUrl(key: string) {
  requireR2Config();
  const publicUrl = getPublicUrl(key);
  if (publicUrl) {
    return publicUrl;
  }
  return createSignedReadUrl(key);
}

function inferContentTypeFromKey(key: string) {
  if (key.startsWith("voice-notes/")) {
    return "audio/mp4";
  }
  if (key.endsWith(".m4a") || key.endsWith(".mp4")) {
    return "audio/mp4";
  }
  if (key.endsWith(".aac")) {
    return "audio/aac";
  }
  if (key.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (key.endsWith(".wav")) {
    return "audio/wav";
  }
  if (key.endsWith(".png")) {
    return "image/png";
  }
  if (key.endsWith(".webp")) {
    return "image/webp";
  }
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return null;
}

export async function openMediaObject(key: string) {
  requireR2Config();
  const client = createClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("Média introuvable");
  }

  return {
    body: response.Body,
    contentType: response.ContentType ?? inferContentTypeFromKey(key) ?? "application/octet-stream",
    contentLength: response.ContentLength,
  };
}

export async function createSignedReadUrl(key: string) {
  requireR2Config();

  const publicUrl = getPublicUrl(key);
  if (publicUrl) {
    return publicUrl;
  }

  const client = createClient();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 60 * 6 });
}
