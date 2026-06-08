import { fluentEmoji3dUrl } from "./story-reactions";

export interface Emoji3dMessagePayload {
  kind: "emoji3d";
  id: string;
  emoji: string;
  imageUrl: string;
  fluentName?: string;
  assetPath?: string;
  label?: string;
}

export function encodeEmoji3dMessagePayload(payload: Emoji3dMessagePayload) {
  return JSON.stringify(payload);
}

export function parseEmoji3dMessagePayload(content: string): Emoji3dMessagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<Emoji3dMessagePayload>;
    if (
      parsed?.kind !== "emoji3d" ||
      typeof parsed.id !== "string" ||
      typeof parsed.emoji !== "string" ||
      typeof parsed.imageUrl !== "string"
    ) {
      return null;
    }
    return {
      kind: "emoji3d",
      id: parsed.id,
      emoji: parsed.emoji,
      imageUrl: parsed.imageUrl,
      fluentName: typeof parsed.fluentName === "string" ? parsed.fluentName : undefined,
      assetPath: typeof parsed.assetPath === "string" ? parsed.assetPath : undefined,
      label: typeof parsed.label === "string" ? parsed.label : undefined,
    };
  } catch {
    return null;
  }
}

export function getEmoji3dDisplayUrl(payload: Pick<Emoji3dMessagePayload, "imageUrl" | "fluentName" | "assetPath">) {
  if (payload.fluentName) {
    return fluentEmoji3dUrl(payload.fluentName, payload.assetPath);
  }
  return payload.imageUrl;
}

export function getEmoji3dPayloadFromContent(content: string): Emoji3dMessagePayload | null {
  return parseEmoji3dMessagePayload(content);
}
