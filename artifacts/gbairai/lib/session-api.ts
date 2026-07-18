import { getApiBaseUrl } from "@/lib/api-config";
import { clearRegisteredPushToken, getRegisteredPushToken } from "@/lib/push-device";

export async function logoutRemoteSession(token: string | null) {
  const pushToken = getRegisteredPushToken();

  if (token) {
    try {
      await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Best effort.
    }

    if (pushToken) {
      try {
        await fetch(`${getApiBaseUrl()}/api/devices/unregister`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pushToken }),
        });
      } catch {
        // Best effort.
      }
    }
  }

  clearRegisteredPushToken();
}
