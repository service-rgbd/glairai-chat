import {
  getCurrentUser,
  listSupportedCountries,
  registerDeviceToken,
  requestOtp,
  setAuthTokenGetter,
  setBaseUrl,
  setOtpDemoRequests,
  setUnauthorizedHandler,
  updateCurrentUser,
  verifyOtp,
  customFetch,
  type CountryOption,
  type UpdateProfileInput,
  type UserSettings,
} from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect, useState } from "react";

import { getApiBaseUrl, isOtpDemoDevMode } from "@/lib/api-config";
import {
  fetchSuggestedCountryCode,
  getDeviceRegionCode,
  resolvePreferredCountryCode,
} from "@/lib/geo-country";
import { clearQueryCache, queryClient } from "@/lib/query-client";
import { ensureCacheOwner, purgeOfflineCacheForUser } from "@/lib/offline-cache";
import { signalPresenceOffline } from "@/lib/presence-session";
import { logoutRemoteSession } from "@/lib/session-api";
import { getSecureItem, migrateLegacySecureItem, removeSecureItem, setSecureItem } from "@/lib/secure-storage";
import { setAuthTokenSnapshot } from "@/lib/auth-token";
import { resetE2eBootstrapCache } from "@/lib/e2e/bootstrap";
import { clearE2eStoreForUser } from "@/lib/e2e/store";
import { clearArchivedAccessPassword } from "@/lib/archived-access";
import { setMediaCachePolicy } from "@/lib/media-cache-policy";
import { syncAndroidNotificationVibration } from "@/lib/notifications";
import { clearTwoFactorPin } from "@/lib/two-factor-auth";
import {
  resetStorageWriteGuard,
  safeGetItem,
  safeMultiRemove,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/safe-storage";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  bio: string;
  statusText: string;
  countryCode: string;
  isOnboarded: boolean;
  settings: UserSettings;
  presence: {
    isOnline: boolean;
    lastSeenAt: string | null;
  };
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  needsProfileSetup: boolean;
  isLoading: boolean;
  pendingPhone: string;
  pendingCountryCode: string;
  pendingCallingCode: string;
  pendingOtpCode: string | null;
  countries: CountryOption[];
  requestOtpForPhone: (phone: string, countryCode: string) => Promise<void>;
  verifyPendingOtp: (code: string) => Promise<AuthUser>;
  setPendingPhone: (phone: string, countryCode?: string, callingCode?: string) => void;
  setupProfile: (name: string, avatar: string | null, bio?: string) => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  registerPushDevice: (pushToken: string, deviceName: string, voipPushToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_STORAGE_KEY = "@gbairai_user";
const TOKEN_STORAGE_KEY = "@gbairai_token";
const COUNTRIES_STORAGE_KEY = "@gbairai_countries";
const DEFAULT_COUNTRY_CODE = "US";

function pickCountrySelection(countriesList: CountryOption[], preferredCode: string) {
  const match =
    countriesList.find((country) => country.code === preferredCode) ?? countriesList[0];
  if (!match) {
    return null;
  }
  return {
    countryCode: match.code,
    callingCode: match.callingCode,
  };
}

function isUnauthorizedError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 401
  );
}

function mapUser(user: {
  id: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  bio: string;
  statusText: string;
  countryCode: string;
  isOnboarded: boolean;
  settings: UserSettings;
  presence: { isOnline: boolean; lastSeenAt: string | null };
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatar: user.avatarUrl,
    bio: user.bio,
    statusText: user.statusText,
    countryCode: user.countryCode,
    isOnboarded: user.isOnboarded,
    settings: user.settings,
    presence: user.presence,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingCountryCode, setPendingCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [pendingCallingCode, setPendingCallingCode] = useState("+1");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingOtpCode, setPendingOtpCode] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      let storedToken: string | null = null;
      try {
        if (process.env.EXPO_PUBLIC_BOOT_RESET === "true") {
          resetStorageWriteGuard();
          await safeMultiRemove([
            USER_STORAGE_KEY,
            TOKEN_STORAGE_KEY,
            "@gbairai_outbox",
            "@gbairai_calls",
            "@gbairai_compose_contacts_cache",
            "@gbairai_loaded_conversations",
          ]);
          await clearQueryCache();
        }

        setBaseUrl(getApiBaseUrl());
        setOtpDemoRequests(isOtpDemoDevMode());

        const [rawStoredToken, storedUser] = await Promise.all([
          migrateLegacySecureItem(TOKEN_STORAGE_KEY),
          safeGetItem(USER_STORAGE_KEY),
        ]);
        storedToken = rawStoredToken;

        if (storedToken) {
          setAuthToken(storedToken);
          setAuthTokenSnapshot(storedToken);
          setAuthTokenGetter(() => storedToken);
        } else {
          setAuthTokenSnapshot(null);
          setAuthTokenGetter(() => null);
        }

        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser));
        }

        const storedCountries = await safeGetItem(COUNTRIES_STORAGE_KEY);
        let cachedCountries: CountryOption[] = [];
        if (storedCountries) {
          cachedCountries = JSON.parse(storedCountries) as CountryOption[];
          if (cachedCountries.length > 0) {
            setCountries(cachedCountries);
          }
        }

        try {
          const [countriesResponse, geoCountryCode] = await Promise.all([
            listSupportedCountries(),
            fetchSuggestedCountryCode(),
          ]);
          const countriesList = countriesResponse.countries;
          setCountries(countriesList);
          await safeSetItem(COUNTRIES_STORAGE_KEY, JSON.stringify(countriesList));

          const preferredCode = resolvePreferredCountryCode(countriesList, {
            geoCountryCode,
            deviceRegionCode: getDeviceRegionCode(),
          });
          const selection = pickCountrySelection(countriesList, preferredCode);
          if (selection) {
            setPendingCountryCode(selection.countryCode);
            setPendingCallingCode(selection.callingCode);
          }
        } catch {
          if (cachedCountries.length === 0) {
            setCountries([
              {
                code: DEFAULT_COUNTRY_CODE,
                name: "États-Unis",
                callingCode: "+1",
                flag: "🇺🇸",
              },
            ]);
            setPendingCountryCode(DEFAULT_COUNTRY_CODE);
            setPendingCallingCode("+1");
          }
        }

        if (storedToken) {
          try {
            const user = await getCurrentUser();
            const mapped = mapUser(user);
            await ensureCacheOwner(mapped.id);
            setCurrentUser(mapped);
            await safeSetItem(USER_STORAGE_KEY, JSON.stringify(mapped));
          } catch (error) {
            if (isUnauthorizedError(error)) {
              setAuthToken(null);
              setCurrentUser(null);
              setAuthTokenGetter(() => null);
              await Promise.all([
                safeRemoveItem(TOKEN_STORAGE_KEY),
                safeRemoveItem(USER_STORAGE_KEY),
              ]);
            }
          }
        }
      } catch (error) {
        if (isUnauthorizedError(error) || !storedToken) {
          setAuthToken(null);
          setCurrentUser(null);
          setAuthTokenGetter(() => null);
          await Promise.all([
            safeRemoveItem(TOKEN_STORAGE_KEY),
            safeRemoveItem(USER_STORAGE_KEY),
          ]);
        }
      } finally {
        setIsLoading(false);
        if (__DEV__) {
          console.log(
            "[Gbairai] auth prête — session:",
            storedToken ? "token stocké" : "anonyme",
          );
        }
      }
    };
    void load();
  }, []);

  useEffect(() => {
    setAuthTokenGetter(() => authToken);
    setAuthTokenSnapshot(authToken);
  }, [authToken]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void (async () => {
        const { resetContactsSyncState, resetContactsPermissionState } = await import(
          "@/lib/contacts-sync"
        );
        await Promise.all([removeSecureItem(TOKEN_STORAGE_KEY), safeRemoveItem(USER_STORAGE_KEY)]);
        queryClient.removeQueries({ queryKey: ["conversations"] });
        resetContactsSyncState();
        resetContactsPermissionState();
        setAuthToken(null);
        setCurrentUser(null);
        setAuthTokenGetter(() => null);
        setAuthTokenSnapshot(null);
      })();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setMediaCachePolicy({ autoDownloadMedia: true, lowDataMode: false });
      return;
    }
    setMediaCachePolicy({
      autoDownloadMedia: currentUser.settings.autoDownloadMedia,
      lowDataMode: currentUser.settings.lowDataMode,
    });
  }, [currentUser?.id, currentUser?.settings.autoDownloadMedia, currentUser?.settings.lowDataMode]);

  useEffect(() => {
    if (!currentUser) return;
    void syncAndroidNotificationVibration(currentUser.settings.vibrationEnabled ?? true);
  }, [currentUser?.id, currentUser?.settings.vibrationEnabled]);

  const setPendingPhoneSelection = (
    phone: string,
    countryCode = pendingCountryCode,
    callingCode = pendingCallingCode,
  ) => {
    setPendingPhone(phone);
    setPendingCountryCode(countryCode);
    setPendingCallingCode(callingCode);
  };

  const requestOtpForPhone = async (phone: string, countryCode: string) => {
    const result = await requestOtp({ phone, countryCode });
    const country = countries.find((item) => item.code === countryCode);
    setPendingPhone(phone);
    setPendingCountryCode(countryCode);
    setPendingCallingCode(country?.callingCode ?? pendingCallingCode);
    setPendingRequestId(result.requestId);
    setPendingOtpCode(result.demoCode);
    if (__DEV__ && isOtpDemoDevMode()) {
      console.log("[Gbairai OTP] demoCode:", result.demoCode ?? "(null — API Render pas à jour)");
    }
  };

  const verifyPendingOtp = async (code: string) => {
    if (!pendingRequestId) {
      throw new Error("Aucune demande OTP en cours");
    }

    const session = await verifyOtp({
      requestId: pendingRequestId,
      phone: pendingPhone,
      code,
    });
    const mapped = mapUser(session.user);
    setPendingRequestId(null);

    await ensureCacheOwner(mapped.id);
    setAuthTokenGetter(() => session.token);
    setAuthTokenSnapshot(session.token);
    setAuthToken(session.token);
    setCurrentUser(mapped);

    await Promise.all([
      setSecureItem(TOKEN_STORAGE_KEY, session.token),
      safeSetItem(USER_STORAGE_KEY, JSON.stringify(mapped)),
    ]);
    return mapped;
  };

  const setupProfile = async (name: string, avatar: string | null, bio = "") => {
    const updated = await updateCurrentUser({
      name,
      avatarUrl: avatar,
      bio,
      statusText: bio || "Disponible",
    });
    const mapped = mapUser(updated);
    setCurrentUser(mapped);
    await safeSetItem(USER_STORAGE_KEY, JSON.stringify(mapped));
    if (avatar) {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const updateProfile = async (updates: Partial<AuthUser>) => {
    if (!currentUser) return;

    const payload: UpdateProfileInput = {
      name: updates.name,
      avatarUrl: updates.avatar,
      bio: updates.bio,
      statusText: updates.statusText,
      notificationsEnabled: updates.settings?.notificationsEnabled,
      notificationSoundEnabled: updates.settings?.notificationSoundEnabled,
      vibrationEnabled: updates.settings?.vibrationEnabled,
      autoDownloadMedia: updates.settings?.autoDownloadMedia,
      lowDataMode: updates.settings?.lowDataMode,
      readReceiptsEnabled: updates.settings?.readReceiptsEnabled,
      lastSeenVisibility: updates.settings?.lastSeenVisibility,
      chatFontScale: updates.settings?.chatFontScale,
    };

    const updated = await updateCurrentUser(payload);
    const mapped = mapUser(updated);
    setCurrentUser(mapped);
    await safeSetItem(USER_STORAGE_KEY, JSON.stringify(mapped));
    if (updates.avatar !== undefined) {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  const registerPushDevice = async (
    pushToken: string,
    deviceName: string,
    voipPushToken?: string,
  ) => {
    if (!authToken) return;
    await registerDeviceToken({
      pushToken,
      deviceName,
      platform: "expo",
      ...(voipPushToken ? { voipPushToken } : {}),
    });
  };

  const logout = async () => {
    const { resetContactsSyncState, resetContactsPermissionState } = await import("@/lib/contacts-sync");
    const token = authToken;
    const userId = currentUser?.id;

    await signalPresenceOffline({ authToken: token });
    await logoutRemoteSession(token);

    if (userId) {
      await clearE2eStoreForUser(userId);
      resetE2eBootstrapCache();
    }

    await Promise.all([removeSecureItem(TOKEN_STORAGE_KEY), safeRemoveItem(USER_STORAGE_KEY)]);
    queryClient.removeQueries({ queryKey: ["conversations"] });
    queryClient.removeQueries({ queryKey: ["messages"] });
    queryClient.removeQueries({ queryKey: ["stories"] });
    queryClient.removeQueries({ queryKey: ["blocked-users"] });
    resetContactsSyncState();
    resetContactsPermissionState();
    setAuthTokenGetter(() => null);
    setAuthTokenSnapshot(null);
    setAuthToken(null);
    setCurrentUser(null);
  };

  const deleteAccount = async () => {
    if (!currentUser) return;
    const userId = currentUser.id;
    await customFetch<{ success: boolean }>("/api/me", { method: "DELETE" });
    await purgeOfflineCacheForUser(userId);
    clearQueryCache();
    await Promise.all([clearTwoFactorPin(userId), clearArchivedAccessPassword(userId)]);
    await logout();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(authToken && currentUser && !isLoading),
        needsProfileSetup: !!currentUser && !currentUser.isOnboarded,
        isLoading,
        pendingPhone,
        pendingCountryCode,
        pendingCallingCode,
        pendingOtpCode,
        countries,
        requestOtpForPhone,
        verifyPendingOtp,
        setPendingPhone: setPendingPhoneSelection,
        setupProfile,
        updateProfile,
        registerPushDevice,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
