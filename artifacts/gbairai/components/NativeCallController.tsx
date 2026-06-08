import { router } from "expo-router";
import { useEffect } from "react";

import {
  endNativeCall,
  setupNativeCallUi,
} from "@/lib/call-system-ui";
import { clearIncomingCallIfMatches, getIncomingCall } from "@/lib/incoming-call";
import { useChats } from "@/contexts/chats-context-ref";
import { useAuth } from "@/contexts/AuthContext";
import { signalConversationCall } from "@/lib/calls";
import { logConversationCall } from "@/lib/call-log";

/**
 * Pont CallKit / ConnectionService ↔ navigation in-app.
 * No-op en Expo Go (stub Metro).
 */
export function NativeCallController() {
  const { authToken } = useAuth();
  const { recordCall } = useChats();

  useEffect(() => {
    return void setupNativeCallUi({
      onAnswer: (callId) => {
        const incoming = getIncomingCall();
        if (!incoming || incoming.callId !== callId) return;

        const localCallId = recordCall({
          userId: incoming.callerUserId,
          conversationId: incoming.conversationId,
          type: incoming.callType,
          direction: "incoming",
          missed: false,
          failed: false,
          duration: null,
        });
        clearIncomingCallIfMatches(incoming.callId);
        router.push({
          pathname: "/call/[conversationId]",
          params: {
            conversationId: incoming.conversationId,
            type: incoming.callType,
            callId: localCallId,
            callSessionId: incoming.callId,
            incoming: "1",
          },
        });
      },
      onEnd: (callId) => {
        const incoming = getIncomingCall();
        if (!incoming || incoming.callId !== callId) return;

        void (async () => {
          if (authToken) {
            try {
              await signalConversationCall(incoming.callId, "decline", authToken, {
                conversationId: incoming.conversationId,
                callType: incoming.callType,
                callerUserId: incoming.callerUserId,
              });
            } catch {
              // Best effort.
            }
            try {
              await logConversationCall(
                {
                  callId: incoming.callId,
                  conversationId: incoming.conversationId,
                  callerUserId: incoming.callerUserId,
                  callType: incoming.callType,
                  outcome: "declined",
                },
                authToken,
              );
            } catch {
              // Best effort.
            }
          }
          recordCall({
            id: `calllog_${incoming.callId}`,
            userId: incoming.callerUserId,
            conversationId: incoming.conversationId,
            type: incoming.callType,
            direction: "incoming",
            missed: true,
            failed: false,
            duration: null,
          });
          endNativeCall(callId);
          clearIncomingCallIfMatches(callId);
        })();
      },
    });
  }, [authToken, recordCall]);

  return null;
}
