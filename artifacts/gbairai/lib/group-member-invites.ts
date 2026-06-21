import type { ConversationSummary } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";

export type GroupMemberInvite = {
  id: string;
  conversationId: string;
  conversationTitle: string | null;
  conversationAvatarUrl: string | null;
  invitedByUserId: string;
  invitedByName: string;
  createdAt: string;
};

export async function listGroupMemberInvites() {
  return customFetch<{ invites: GroupMemberInvite[] }>("/api/group-member-invites");
}

export async function acceptGroupMemberInvite(inviteId: string) {
  return customFetch<{ conversation: ConversationSummary }>(
    `/api/group-member-invites/${inviteId}/accept`,
    { method: "POST" },
  );
}

export async function declineGroupMemberInvite(inviteId: string) {
  return customFetch<{ success: boolean }>(`/api/group-member-invites/${inviteId}/decline`, {
    method: "POST",
  });
}
