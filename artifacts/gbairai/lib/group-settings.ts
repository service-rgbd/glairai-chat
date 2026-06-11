export type GroupAccessMode = "closed" | "invite" | "open";

export interface GroupSettings {
  membersCanSendMedia: boolean;
  accessMode: GroupAccessMode;
}

export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  membersCanSendMedia: true,
  accessMode: "invite",
};

export function parseGroupSettings(raw: unknown): GroupSettings {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_GROUP_SETTINGS;
  }
  const value = raw as Partial<GroupSettings>;
  const accessMode =
    value.accessMode === "closed" || value.accessMode === "invite" || value.accessMode === "open"
      ? value.accessMode
      : DEFAULT_GROUP_SETTINGS.accessMode;
  return {
    membersCanSendMedia:
      typeof value.membersCanSendMedia === "boolean"
        ? value.membersCanSendMedia
        : DEFAULT_GROUP_SETTINGS.membersCanSendMedia,
    accessMode,
  };
}

export function groupAccessModeLabel(mode: GroupAccessMode) {
  switch (mode) {
    case "closed":
      return "Fermé — seul l'admin ajoute des membres";
    case "open":
      return "Ouvert — les membres peuvent inviter";
    case "invite":
    default:
      return "Sur invitation — rejoindre via lien";
  }
}
