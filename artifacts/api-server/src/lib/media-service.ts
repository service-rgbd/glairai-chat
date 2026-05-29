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

function buildMediaKey(
  category: MediaCategory,
  userId: string,
  contentType: string,
  conversationId?: string,
) {
  const extension =
    contentType === "audio/aac"
      ? "aac"
      : contentType === "audio/mpeg"
        ? "mp3"
        : contentType === "audio/wav"
          ? "wav"
          : contentType === "video/mp4"
            ? "mp4"
            : contentType === "image/png"
              ? "png"
              : contentType === "image/webp"
                ? "webp"
                : "jpg";

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
