import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  bio: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingPhone: string;
  setPendingPhone: (phone: string) => void;
  setupProfile: (name: string, avatar: string | null, bio?: string) => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "@gbairai_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPhone, setPendingPhone] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setCurrentUser(JSON.parse(raw));
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const setupProfile = async (name: string, avatar: string | null, bio = "") => {
    const user: AuthUser = {
      id: "me",
      name,
      phone: pendingPhone || "+224 620 000 000",
      avatar,
      bio,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setCurrentUser(user);
  };

  const updateProfile = async (updates: Partial<AuthUser>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setCurrentUser(updated);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        pendingPhone,
        setPendingPhone,
        setupProfile,
        updateProfile,
        logout,
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
