import { useAuth } from "@/contexts/AuthContext";

import { NativeCallController } from "@/components/NativeCallController";

/** CallKit / VoIP uniquement après connexion — évite un crash natif sur l'écran OTP. */
export function AuthenticatedNativeCallController() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;
  return <NativeCallController />;
}
