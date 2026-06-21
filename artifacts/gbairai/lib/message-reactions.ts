import { customFetch } from "@workspace/api-client-react";

export const CHAT_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type MessageReactionSummary = {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
};

export async function setMessageReaction(messageId: string, emoji: string | null) {
  try {
    return await customFetch<{ messageId: string; reactions: MessageReactionSummary[] }>(
      `/api/messages/${messageId}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ emoji }),
      },
    );
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number; message?: string };
      if (apiError.status === 404) {
        throw new Error(
          "Les réactions ne sont pas encore disponibles sur le serveur. Réessayez dans quelques minutes.",
        );
      }
    }
    throw error instanceof Error ? error : new Error("Impossible d'ajouter la réaction");
  }
}
