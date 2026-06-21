export const VIEW_ONCE_OPENED_LABEL = "Photo à vue unique";
export const VIEW_ONCE_ALREADY_OPENED_LABEL = "Fichier déjà ouvert";
export const VIEW_ONCE_SCREENSHOT_LABEL = "Capture d'écran effectuée";

export interface ViewOnceOpenedPayload {
  kind: "view_once_opened";
  mediaType: "image" | "video";
  screenshotted?: boolean;
}

export function encodeViewOnceOpenedContent(
  mediaType: "image" | "video" = "image",
  options?: { screenshotted?: boolean },
) {
  return JSON.stringify({
    kind: "view_once_opened",
    mediaType,
    ...(options?.screenshotted ? { screenshotted: true } : {}),
  } satisfies ViewOnceOpenedPayload);
}

export function isViewOnceOpenedContent(content: string) {
  try {
    const parsed = JSON.parse(content) as Partial<ViewOnceOpenedPayload>;
    return parsed?.kind === "view_once_opened";
  } catch {
    return false;
  }
}

export function parseViewOnceOpenedContent(content: string): ViewOnceOpenedPayload | null {
  try {
    const parsed = JSON.parse(content) as Partial<ViewOnceOpenedPayload>;
    if (parsed?.kind !== "view_once_opened") {
      return null;
    }
    return {
      kind: "view_once_opened",
      mediaType: parsed.mediaType === "video" ? "video" : "image",
      screenshotted: parsed.screenshotted === true ? true : undefined,
    };
  } catch {
    return null;
  }
}

export function isViewOnceImageContent(content: string) {
  try {
    const parsed = JSON.parse(content) as {
      kind?: string;
      viewOnce?: boolean;
      key?: string;
    };
    if (parsed?.kind === "view_once_opened" || parsed?.kind === "deleted") {
      return false;
    }
    return parsed?.viewOnce === true && typeof parsed.key === "string";
  } catch {
    return false;
  }
}

export function isViewOnceScreenshottedContent(content: string) {
  return parseViewOnceOpenedContent(content)?.screenshotted === true;
}
