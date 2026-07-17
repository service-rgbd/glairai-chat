import * as ImagePicker from "expo-image-picker";

import {
  createMediaUploadTarget,
  getDisplayMediaUrl,
  uploadFileToSignedUrl,
} from "@/lib/media";

export function isLocalProfilePhotoUri(uri: string | null | undefined) {
  if (!uri?.trim()) return false;
  return /^(file:|content:|ph:|assets-library:)/i.test(uri.trim());
}

export function isRemoteProfilePhotoUri(uri: string | null | undefined) {
  if (!uri?.trim()) return false;
  const trimmed = uri.trim();
  return (
    trimmed.startsWith("avatars/") ||
    trimmed.includes("/api/media/public") ||
    /^https?:\/\//i.test(trimmed)
  );
}

export async function pickProfilePhotoFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { ok: false as const, reason: "permission" as const };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return { ok: false as const, reason: "cancelled" as const };
  }

  return { ok: true as const, asset: result.assets[0] };
}

export async function takeProfilePhotoWithCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { ok: false as const, reason: "permission" as const };
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return { ok: false as const, reason: "cancelled" as const };
  }

  return { ok: true as const, asset: result.assets[0] };
}

export async function uploadProfilePhoto(authToken: string, localUri: string, mimeType = "image/jpeg") {
  const target = await createMediaUploadTarget(authToken, {
    category: "avatar",
    mimeType,
  });
  await uploadFileToSignedUrl(target.uploadUrl, localUri, mimeType);
  return target.key;
}

export function getProfilePhotoDisplayUrl(avatar: string | null | undefined) {
  if (!avatar?.trim()) return null;
  return getDisplayMediaUrl(avatar, avatar);
}
