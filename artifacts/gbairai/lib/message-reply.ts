import type { GMessage, MessageType } from "@/contexts/chats-types";
import { getCallMessagePayloadFromContent } from "@/lib/call-messages";
import { getEmoji3dPayloadFromContent } from "@/lib/emoji-messages";
import { isE2ePayload } from "@/lib/e2e/config";
import { parseEditedTextMessage } from "@/lib/message-meta";
import {
  parseAudioMessagePayload,
  parseImageMessagePayload,
  parseVideoMessagePayload,
} from "@/lib/media";

export type MessageReplyRef = {
  messageId: string;
  senderId: string;
  senderName: string;
  preview: string;
  type: MessageType;
};

type TextMessageEnvelope = {
  kind: "text";
  body: string;
  editedAt?: string;
  replyTo?: MessageReplyRef;
};

export function getMessageReplyPreview(message: Pick<GMessage, "content" | "type">) {
  if (message.type === "image") return "Photo";
  if (message.type === "video") return "Vidéo";
  if (message.type === "audio") return "Message vocal";
  if (message.type === "text") {
    if (getEmoji3dPayloadFromContent(message.content)) return "Emoji";
    if (getCallMessagePayloadFromContent(message.content)) return "Appel";
    const envelope = parseTextMessageEnvelope(message.content);
    const body = envelope?.body ?? message.content;
    return body.replace(/\s+/g, " ").trim().slice(0, 120);
  }
  return "Message";
}

export function buildMessageReplyRef(
  message: GMessage,
  senderName: string,
): MessageReplyRef {
  return {
    messageId: message.id,
    senderId: message.senderId,
    senderName,
    preview: getMessageReplyPreview(message),
    type: message.type,
  };
}

export function encodeTextMessageContent(body: string, replyTo?: MessageReplyRef) {
  const trimmed = body.trim();
  if (!replyTo) return trimmed;
  const payload: TextMessageEnvelope = {
    kind: "text",
    body: trimmed,
    replyTo,
  };
  return JSON.stringify(payload);
}

export function parseTextMessageEnvelope(content: string): TextMessageEnvelope | null {
  if (isE2ePayload(content)) return null;
  try {
    const parsed = JSON.parse(content) as Partial<TextMessageEnvelope>;
    if (parsed?.kind !== "text" || typeof parsed.body !== "string") {
      return null;
    }
    const replyTo = parsed.replyTo;
    if (
      replyTo &&
      typeof replyTo === "object" &&
      typeof replyTo.messageId === "string" &&
      typeof replyTo.senderId === "string" &&
      typeof replyTo.senderName === "string" &&
      typeof replyTo.preview === "string" &&
      (replyTo.type === "text" ||
        replyTo.type === "image" ||
        replyTo.type === "audio" ||
        replyTo.type === "video")
    ) {
      return {
        kind: "text",
        body: parsed.body,
        editedAt: typeof parsed.editedAt === "string" ? parsed.editedAt : undefined,
        replyTo,
      };
    }
    return {
      kind: "text",
      body: parsed.body,
      editedAt: typeof parsed.editedAt === "string" ? parsed.editedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function extractReplyFromContent(content: string) {
  const edited = parseEditedTextMessage(content);
  if (edited?.body) {
    const nested = parseTextMessageEnvelope(
      JSON.stringify({ kind: "text", body: edited.body, replyTo: undefined }),
    );
    return { body: edited.body, replyTo: nested?.replyTo ?? null };
  }
  const envelope = parseTextMessageEnvelope(content);
  if (envelope) {
    return { body: envelope.body, replyTo: envelope.replyTo ?? null };
  }
  return { body: content, replyTo: null };
}

export function isStructuredMediaContent(content: string) {
  return Boolean(
    parseImageMessagePayload(content) ||
      parseVideoMessagePayload(content) ||
      parseAudioMessagePayload(content),
  );
}
