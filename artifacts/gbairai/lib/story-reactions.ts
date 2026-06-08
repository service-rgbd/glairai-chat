import { getApiBaseUrl } from "./api-config";

export type StoryQuickReaction = {
  id: string;
  emoji: string;
  label: string;
  fluentName: string;
  assetPath?: string;
};

export type ChatEmoji3d = {
  id: string;
  emoji: string;
  label: string;
  fluentName: string;
  assetPath?: string;
};

export const STORY_QUICK_REACTIONS: StoryQuickReaction[] = [
  { id: "heart", emoji: "❤️", label: "J'aime", fluentName: "Red heart" },
  { id: "laugh", emoji: "😂", label: "Rire", fluentName: "Face with tears of joy" },
  { id: "wow", emoji: "😮", label: "Wow", fluentName: "Face with open mouth" },
  { id: "sad", emoji: "😢", label: "Triste", fluentName: "Crying face" },
  { id: "clap", emoji: "👏", label: "Bravo", fluentName: "Clapping hands" },
  { id: "pray", emoji: "🙏", label: "Merci", fluentName: "Folded hands" },
];

function fluentEmojiSlug(fluentName: string) {
  return fluentName
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function fluentEmojiAssetRelativePath(fluentName: string, assetPath?: string) {
  if (assetPath) return assetPath;
  return `${fluentName}/3D/${fluentEmojiSlug(fluentName)}_3d.png`;
}

function encodeAssetPath(relativePath: string) {
  return relativePath.split("/").map(encodeURIComponent).join("/");
}

export function fluentEmoji3dCdnUrl(fluentName: string, assetPath?: string) {
  const relative = fluentEmojiAssetRelativePath(fluentName, assetPath);
  return `https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/${encodeAssetPath(relative)}`;
}

export function fluentEmoji3dUrl(fluentName: string, assetPath?: string) {
  const useLocal = process.env.EXPO_PUBLIC_USE_LOCAL_EMOJIS === "true";
  if (useLocal) {
    const relative = fluentEmojiAssetRelativePath(fluentName, assetPath);
    return `${getApiBaseUrl()}/emojis/${encodeAssetPath(relative)}`;
  }
  return fluentEmoji3dCdnUrl(fluentName, assetPath);
}

export function getChatEmoji3dImageUrl(emoji: Pick<ChatEmoji3d, "fluentName" | "assetPath">) {
  return fluentEmoji3dUrl(emoji.fluentName, emoji.assetPath);
}

export const CHAT_EMOJI_3D: ChatEmoji3d[] = [
  ...STORY_QUICK_REACTIONS.map((item) => ({
    id: item.id,
    emoji: item.emoji,
    label: item.label,
    fluentName: item.fluentName,
    assetPath: item.assetPath,
  })),
  { id: "smile", emoji: "😊", label: "Sourire", fluentName: "Smiling face with smiling eyes" },
  { id: "fire", emoji: "🔥", label: "Feu", fluentName: "Fire" },
  { id: "party", emoji: "🎉", label: "Fête", fluentName: "Party popper" },
  {
    id: "thumbsup",
    emoji: "👍",
    label: "Top",
    fluentName: "Thumbs up",
    assetPath: "Thumbs up/Default/3D/thumbs_up_3d_default.png",
  },
  { id: "love", emoji: "😍", label: "Amour", fluentName: "Smiling face with heart-eyes" },
];

export function getStoryReaction3dUrl(reactionId: string) {
  const reaction = STORY_QUICK_REACTIONS.find((item) => item.id === reactionId);
  if (!reaction) return null;
  return fluentEmoji3dUrl(reaction.fluentName, reaction.assetPath);
}
