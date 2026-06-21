import {
  createMediaUploadTarget,
  getDisplayMediaUrl,
  resolveMediaUrl,
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
  return (
    target.publicUrl ||
    (await resolveMediaUrl(authToken, target.key)) ||
    getDisplayMediaUrl(target.key, target.publicUrl)
  );
}
