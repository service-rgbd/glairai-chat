import {
  AddConversationMembersBody,
  AddConversationMembersResponse,
  CreateConversationBody,
  CreateConversationResponse,
  CreateGroupInviteParams,
  CreateGroupInviteResponse,
  GetConversationResponse,
  GetGroupInvitePreviewParams,
  GetGroupInvitePreviewResponse,
  JoinGroupByInviteBody,
  JoinGroupByInviteResponse,
  LeaveConversationParams,
  LeaveConversationResponse,
  ListConversationMessagesResponse,
  ListConversationsResponse,
  MarkConversationReadBody,
  MarkConversationReadResponse,
  MarkMessageDeliveredResponse,
  RemoveConversationMemberParams,
  RemoveConversationMemberResponse,
  SendConversationMessageBody,
  SendConversationMessageResponse,
  UpdateConversationBody,
  UpdateConversationResponse,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { chatService } from "../lib/chat-service";

const router: IRouter = Router();

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

router.get("/conversations", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.listConversations(req.authToken!);
    res.json(ListConversationsResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Impossible de charger les conversations",
    });
  }
});

router.post("/conversations", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = CreateConversationBody.parse(req.body);
    const result = await chatService.createConversation(req.authToken!, input);
    res.json(CreateConversationResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de créer la conversation",
    });
  }
});

router.post("/conversations/join", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const input = JoinGroupByInviteBody.parse(req.body);
    const result = await chatService.joinGroupByInvite(req.authToken!, input.inviteToken);
    res.json(JoinGroupByInviteResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de rejoindre le groupe",
    });
  }
});

router.get("/group-member-invites", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await chatService.listGroupMemberInvites(req.authToken!);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Impossible de charger les invitations",
    });
  }
});

router.post(
  "/group-member-invites/:inviteId/accept",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await chatService.acceptGroupMemberInvite(
        req.authToken!,
        getSingleParam(req.params["inviteId"]),
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible d'accepter l'invitation",
      });
    }
  },
);

router.post(
  "/group-member-invites/:inviteId/decline",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await chatService.declineGroupMemberInvite(
        req.authToken!,
        getSingleParam(req.params["inviteId"]),
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible de refuser l'invitation",
      });
    }
  },
);

router.get(
  "/conversations/:conversationId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await chatService.getConversation(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
      );
      res.json(GetConversationResponse.parse(result));
    } catch (error) {
      res.status(404).json({
        message:
          error instanceof Error
            ? error.message
            : "Conversation introuvable",
      });
    }
  },
);

router.patch(
  "/conversations/:conversationId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = UpdateConversationBody.parse(req.body);
      const result = await chatService.updateConversation(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
        input,
      );
      res.json(UpdateConversationResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour la conversation",
      });
    }
  },
);

router.post(
  "/conversations/:conversationId/members",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = AddConversationMembersBody.parse(req.body);
      const result = await chatService.addConversationMembers(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
        input,
      );
      res.json(AddConversationMembersResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible d'ajouter des membres",
      });
    }
  },
);

router.delete(
  "/conversations/:conversationId/members/:userId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      RemoveConversationMemberParams.parse({
        conversationId: getSingleParam(req.params["conversationId"]),
        userId: getSingleParam(req.params["userId"]),
      });
      const result = await chatService.removeConversationMember(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
        getSingleParam(req.params["userId"]),
      );
      res.json(RemoveConversationMemberResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de retirer ce membre",
      });
    }
  },
);

router.post(
  "/conversations/:conversationId/leave",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      LeaveConversationParams.parse({
        conversationId: getSingleParam(req.params["conversationId"]),
      });
      const result = await chatService.leaveConversation(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
      );
      res.json(LeaveConversationResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de quitter le groupe",
      });
    }
  },
);

router.post(
  "/conversations/:conversationId/invite",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      CreateGroupInviteParams.parse({
        conversationId: getSingleParam(req.params["conversationId"]),
      });
      const result = await chatService.createGroupInvite(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
      );
      res.json(CreateGroupInviteResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de créer le lien d'invitation",
      });
    }
  },
);

router.get("/group-invites/:token", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    GetGroupInvitePreviewParams.parse({
      token: getSingleParam(req.params["token"]),
    });
    const result = await chatService.getGroupInvitePreview(
      req.authToken!,
      getSingleParam(req.params["token"]),
    );
    res.json(GetGroupInvitePreviewResponse.parse(result));
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Invitation introuvable",
    });
  }
});

router.get(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const rawLimit = req.query["limit"];
      const limit =
        typeof rawLimit === "string" && rawLimit !== ""
          ? Number(rawLimit)
          : undefined;
      const cursor =
        typeof req.query["cursor"] === "string" ? req.query["cursor"] : undefined;

      const result = await chatService.listConversationMessages(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
        {
          cursor,
          limit,
        },
      );
      res.json(ListConversationMessagesResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible de charger les messages",
      });
    }
  },
);

router.post(
  "/conversations/:conversationId/messages",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = SendConversationMessageBody.parse(req.body);
      const result = await chatService.sendConversationMessage(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
        input,
        req.authUserId,
      );
      res.json(SendConversationMessageResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible d'envoyer le message",
      });
    }
  },
);

router.post(
  "/messages/:messageId/reactions",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const emoji =
        typeof req.body?.emoji === "string"
          ? req.body.emoji
          : req.body?.emoji === null
            ? null
            : undefined;
      if (emoji === undefined) {
        throw new Error("Réaction invalide");
      }
      const result = await chatService.setMessageReaction(
        req.authToken!,
        getSingleParam(req.params["messageId"]),
        emoji,
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible d'ajouter la réaction",
      });
    }
  },
);

router.post(
  "/messages/:messageId/view-once/screenshot",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await chatService.reportViewOnceScreenshot(
        req.authToken!,
        getSingleParam(req.params["messageId"]),
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible de signaler la capture d'écran",
      });
    }
  },
);

router.post(
  "/messages/:messageId/view-once/consume",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await chatService.consumeViewOnceMessage(
        req.authToken!,
        getSingleParam(req.params["messageId"]),
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible d'ouvrir cette photo",
      });
    }
  },
);

router.delete(
  "/messages/:messageId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await chatService.deleteConversationMessage(
        req.authToken!,
        getSingleParam(req.params["messageId"]),
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible de supprimer le message",
      });
    }
  },
);

router.patch(
  "/messages/:messageId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const content =
        typeof req.body?.content === "string" ? req.body.content : "";
      const result = await chatService.updateConversationMessage(
        req.authToken!,
        getSingleParam(req.params["messageId"]),
        { content },
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error ? error.message : "Impossible de modifier le message",
      });
    }
  },
);

router.post(
  "/conversations/:conversationId/read",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = MarkConversationReadBody.parse(req.body);
      const result = await chatService.markConversationRead(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
        input,
      );
      res.json(MarkConversationReadResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour le statut de lecture",
      });
    }
  },
);

router.post(
  "/messages/:messageId/delivered",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await chatService.markMessageDelivered(
        req.authToken!,
        getSingleParam(req.params["messageId"]),
      );
      res.json(MarkMessageDeliveredResponse.parse(result));
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de marquer le message comme livré",
      });
    }
  },
);

router.patch(
  "/conversations/:conversationId/archive",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const archived = req.body?.archived === true;
      const result = await chatService.setConversationArchived(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
        archived,
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour l'archivage",
      });
    }
  },
);

router.patch(
  "/conversations/:conversationId/mute",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const muted = req.body?.muted === true;
      const result = await chatService.setConversationMuted(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
        muted,
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour le mode silencieux",
      });
    }
  },
);

router.delete(
  "/conversations/:conversationId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await chatService.deleteConversationForUser(
        req.authToken!,
        getSingleParam(req.params["conversationId"]),
      );
      res.json(result);
    } catch (error) {
      res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Impossible de supprimer la conversation",
      });
    }
  },
);

export default router;
