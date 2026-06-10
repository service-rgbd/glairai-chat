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
) {
  const target = await createMediaUploadTarget(authToken, { category, mimeType });
  await uploadFileToSignedUrl(target.uploadUrl, localUri, mimeType);
  return (
    target.publicUrl ||
    (await resolveMediaUrl(authToken, target.key)) ||
    getDisplayMediaUrl(target.key, target.publicUrl)
  );
}
