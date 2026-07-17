import {
  createMediaUploadTarget,
  getUploadDisplayUrl,
  uploadFileToSignedUrl,
  type MediaCategory,
} from "@/lib/media";

export async function uploadChannelImage(
  authToken: string,
  localUri: string,
  mimeType: string,
  category: Extract<MediaCategory, "avatar" | "chat-image">,
  assetId?: string | null,
) {
  const target = await createMediaUploadTarget(authToken, { category, mimeType });
  await uploadFileToSignedUrl(target.uploadUrl, localUri, mimeType, assetId);
  return getUploadDisplayUrl(authToken, target.key, target.publicUrl);
}
