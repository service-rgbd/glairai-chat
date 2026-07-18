import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import {
  endNativeCall,
  registerNativeCallHandlers,
  setupNativeCallUi,
} from "@/lib/call-system-ui";
import { clearIncomingCallIfMatches, getIncomingCall } from "@/lib/incoming-call";
import { useChats } from "@/contexts/chats-context-ref";
import { useAuthToken } from "@/hooks/useAuthToken";
import { signalConversationCall } from "@/lib/calls";
import { logConversationCall } from "@/lib/call-log";
import { afterAuthNativeDelay } from "@/lib/post-auth-native-delay";

/**
 * Pont CallKit / ConnectionService ↔ navigation in-app.
 * Avec VoIP actif : handlers seulement au login, CallKit s'initialise à l'appel entrant.
 */
export function NativeCallController() {
  const authToken = useAuthToken();
  const { recordCall } = useChats();
  const authTokenRef = useRef(authToken);
  const recordCallRef = useRef(recordCall);

  useEffect(() => {
    authTokenRef.current = authToken;
    recordCallRef.current = recordCall;
  }, [authToken, recordCall]);

  useEffect(() => {
    let cancelled = false;

    const handlers = {
      onAnswer: (callId: string) => {
        const incoming = getIncomingCall();
        if (!incoming || incoming.callId !== callId) return;

        const localCallId = recordCallRef.current({
          userId: incoming.callerUserId,
          conversationId: incoming.conversationId,
          type: incoming.callType,
          direction: "incoming",
          missed: false,
          failed: false,
          duration: null,
        });
        clearIncomingCallIfMatches(incoming.callId, { skipNativeEnd: true });
        endNativeCall(incoming.callId);
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
      onEnd: (callId: string) => {
        const incoming = getIncomingCall();
        if (!incoming || incoming.callId !== callId) return;

        void (async () => {
          const token = authTokenRef.current;
          if (token) {
            try {
              await signalConversationCall(incoming.callId, "decline", token, {
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
                token,
              );
            } catch {
              // Best effort.
            }
          }
          recordCallRef.current({
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
    };

    registerNativeCallHandlers(handlers);

    const cancelDelay = afterAuthNativeDelay(() => {
      if (cancelled || Platform.OS !== "ios") return;
      void setupNativeCallUi(handlers).then((ok) => {
        if (ok) {
          void import("@/lib/voip-push").then(({ requestVoipPushTokenAfterCallKit }) => {
            requestVoipPushTokenAfterCallKit();
          });
        }
      });
    });

    return () => {
      cancelled = true;
      cancelDelay();
    };
  }, []);

  return null;
}
