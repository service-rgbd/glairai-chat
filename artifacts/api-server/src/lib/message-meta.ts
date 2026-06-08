export const DELETED_MESSAGE_LABEL = "Message supprimé";

export interface DeletedMessagePayload {
  kind: "deleted";
}

export interface EditedTextMessagePayload {
  kind: "text";
  body: string;
  editedAt: string;
}

export function encodeDeletedMessageContent() {
  return JSON.stringify({ kind: "deleted" } satisfies DeletedMessagePayload);
}

export function isDeletedMessageContent(content: string) {
  try {
    const parsed = JSON.parse(content) as Partial<DeletedMessagePayload>;
    return parsed?.kind === "deleted";
  } catch {
    return false;
  }
}

export function parseEditedTextMessage(content: string): EditedTextMessagePayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<EditedTextMessagePayload>;
    if (
      parsed?.kind !== "text" ||
      typeof parsed.body !== "string" ||
      typeof parsed.editedAt !== "string"
    ) {
      return null;
    }
    return {
      kind: "text",
      body: parsed.body,
      editedAt: parsed.editedAt,
    };
  } catch {
    return null;
  }
}

export function encodeEditedTextMessageContent(body: string, editedAt: string) {
  return JSON.stringify({ kind: "text", body, editedAt } satisfies EditedTextMessagePayload);
}
