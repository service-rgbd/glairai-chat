import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface GUser {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  bio: string;
  status: string;
  lastSeen: string | null; // ISO or null = online
  initials: string;
  color: string;
}

export type MessageStatus = "sent" | "delivered" | "read";
export type MessageType = "text" | "image" | "audio";
export type ChatType = "direct" | "group";

export interface GMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  timestamp: string; // ISO
}

export interface GChat {
  id: string;
  type: ChatType;
  participantIds: string[];
  name?: string;
  unreadCount: number;
}

export interface GStory {
  id: string;
  userId: string;
  type: "text";
  content: string;
  backgroundColor: string;
  expiresAt: string;
  viewerIds: string[];
  createdAt: string;
}

export interface GCall {
  id: string;
  userId: string;
  type: "audio" | "video";
  direction: "incoming" | "outgoing";
  missed: boolean;
  timestamp: string;
  duration: string | null;
}

const MOCK_USERS: Record<string, GUser> = {
  u1: { id: "u1", name: "Aminata Diallo", phone: "+224 622 134 567", avatar: null, bio: "La vie est belle", status: "En ligne", lastSeen: null, initials: "AD", color: "#6D4AFF" },
  u2: { id: "u2", name: "Ibrahim Kouyaté", phone: "+224 625 987 321", avatar: null, bio: "Dev passionné", status: "Bonjour!", lastSeen: new Date(Date.now() - 25 * 60 * 1000).toISOString(), initials: "IK", color: "#00D4A4" },
  u3: { id: "u3", name: "Mariama Camara", phone: "+224 628 456 789", avatar: null, bio: "Entrepreneur | Manager", status: "Au travail", lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), initials: "MC", color: "#FF6B6B" },
  u4: { id: "u4", name: "Oumar Traoré", phone: "+224 621 234 567", avatar: null, bio: "Ingénieur, amateur de foot", status: "En ligne", lastSeen: null, initials: "OT", color: "#FFB347" },
  u5: { id: "u5", name: "Fatou Sow", phone: "+224 623 765 432", avatar: null, bio: "Médecin | Cardiologue", status: "Ne pas déranger", lastSeen: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), initials: "FS", color: "#4ECDC4" },
  u6: { id: "u6", name: "Mohamed Bah", phone: "+224 626 111 222", avatar: null, bio: "Artiste | Musicien", status: "En ligne", lastSeen: null, initials: "MB", color: "#45B7D1" },
  u7: { id: "u7", name: "Aissatou Koné", phone: "+224 629 333 444", avatar: null, bio: "Mère de famille | Enseignante", status: "Disponible", lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), initials: "AK", color: "#96CEB4" },
  u8: { id: "u8", name: "Djénéba Barry", phone: "+224 624 555 666", avatar: null, bio: "Business Woman", status: "En ligne", lastSeen: null, initials: "DB", color: "#DDA0DD" },
};

const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3600000).toISOString();

const INITIAL_MESSAGES: Record<string, GMessage[]> = {
  c1: [
    { id: "m1_1", chatId: "c1", senderId: "u1", content: "Bonjour! Comment tu vas?", type: "text", status: "read", timestamp: h(0.6) },
    { id: "m1_2", chatId: "c1", senderId: "me", content: "Très bien merci! Et toi?", type: "text", status: "read", timestamp: h(0.5) },
    { id: "m1_3", chatId: "c1", senderId: "u1", content: "Super! Tu as vu le match hier soir?", type: "text", status: "read", timestamp: h(0.4) },
    { id: "m1_4", chatId: "c1", senderId: "me", content: "Oui! Incroyable ce but à la 90ème minute!", type: "text", status: "read", timestamp: h(0.35) },
    { id: "m1_5", chatId: "c1", senderId: "u1", content: "Haha oui! On fait quoi ce weekend?", type: "text", status: "delivered", timestamp: h(0.25) },
  ],
  c2: [
    { id: "m2_1", chatId: "c2", senderId: "me", content: "Ibrahim, tu es en route?", type: "text", status: "read", timestamp: h(0.8) },
    { id: "m2_2", chatId: "c2", senderId: "u2", content: "Oui j'arrive, il y a un bouchon", type: "text", status: "read", timestamp: h(0.6) },
    { id: "m2_3", chatId: "c2", senderId: "u2", content: "Ok je serai là dans 20 min", type: "text", status: "read", timestamp: h(0.4) },
    { id: "m2_4", chatId: "c2", senderId: "me", content: "Ok pas de problème, j'attends", type: "text", status: "read", timestamp: h(0.3) },
  ],
  c3: [
    { id: "m3_1", chatId: "c3", senderId: "u3", content: "La réunion de demain est confirmée à 10h", type: "text", status: "read", timestamp: h(26) },
    { id: "m3_2", chatId: "c3", senderId: "me", content: "Parfait, je serai là", type: "text", status: "read", timestamp: h(25) },
    { id: "m3_3", chatId: "c3", senderId: "u3", content: "N'oublie pas d'apporter les documents", type: "text", status: "delivered", timestamp: h(24) },
  ],
  c4: [
    { id: "m4_1", chatId: "c4", senderId: "u4", content: "On se retrouve au carrefour Kaloum", type: "text", status: "read", timestamp: h(30) },
    { id: "m4_2", chatId: "c4", senderId: "me", content: "Super! À quelle heure?", type: "text", status: "read", timestamp: h(29) },
    { id: "m4_3", chatId: "c4", senderId: "u4", content: "17h, ça te va?", type: "text", status: "read", timestamp: h(28.5) },
    { id: "m4_4", chatId: "c4", senderId: "me", content: "Super, on se retrouve là-bas!", type: "text", status: "read", timestamp: h(28) },
  ],
  c5: [
    { id: "m5_1", chatId: "c5", senderId: "u5", content: "J'ai envoyé les documents au cabinet", type: "text", status: "read", timestamp: h(72) },
    { id: "m5_2", chatId: "c5", senderId: "me", content: "Merci Fatou! Je les révise aujourd'hui", type: "text", status: "read", timestamp: h(71) },
    { id: "m5_3", chatId: "c5", senderId: "u5", content: "Dis-moi si tu as des questions", type: "text", status: "read", timestamp: h(70) },
  ],
  c6: [
    { id: "m6_1", chatId: "c6", senderId: "u6", content: "Écoute mon nouveau morceau!", type: "text", status: "read", timestamp: h(74) },
    { id: "m6_2", chatId: "c6", senderId: "me", content: "C'est vraiment de feu!", type: "text", status: "read", timestamp: h(73) },
    { id: "m6_3", chatId: "c6", senderId: "u6", content: "Tu peux appeler ce soir?", type: "text", status: "delivered", timestamp: h(72) },
  ],
  c7: [
    { id: "m7_1", chatId: "c7", senderId: "u4", content: "Bonne journée à tous!", type: "text", status: "read", timestamp: h(168) },
    { id: "m7_2", chatId: "c7", senderId: "u7", content: "Bonne journée Oumar!", type: "text", status: "read", timestamp: h(167) },
    { id: "m7_3", chatId: "c7", senderId: "u7", content: "Bonne nuit tout le monde", type: "text", status: "delivered", timestamp: h(156) },
  ],
  c8: [
    { id: "m8_1", chatId: "c8", senderId: "u8", content: "On repart pour une nouvelle semaine!", type: "text", status: "read", timestamp: h(170) },
    { id: "m8_2", chatId: "c8", senderId: "me", content: "Exact! Au boulot!", type: "text", status: "read", timestamp: h(169) },
  ],
};

const INITIAL_CHATS: GChat[] = [
  { id: "c1", type: "direct", participantIds: ["me", "u1"], unreadCount: 3 },
  { id: "c2", type: "direct", participantIds: ["me", "u2"], unreadCount: 0 },
  { id: "c3", type: "direct", participantIds: ["me", "u3"], unreadCount: 2 },
  { id: "c4", type: "direct", participantIds: ["me", "u4"], unreadCount: 0 },
  { id: "c5", type: "direct", participantIds: ["me", "u5"], unreadCount: 0 },
  { id: "c6", type: "direct", participantIds: ["me", "u6"], unreadCount: 1 },
  { id: "c7", type: "group", participantIds: ["me", "u7", "u4", "u2"], name: "Famille Koné", unreadCount: 5 },
  { id: "c8", type: "direct", participantIds: ["me", "u8"], unreadCount: 0 },
];

const INITIAL_STORIES: GStory[] = [
  { id: "s1", userId: "u1", type: "text", content: "Bonne journée à tous!", backgroundColor: "#6D4AFF", expiresAt: new Date(now + 20 * 3600000).toISOString(), viewerIds: [], createdAt: h(4) },
  { id: "s2", userId: "u4", type: "text", content: "Allez les Lions!", backgroundColor: "#FF6B6B", expiresAt: new Date(now + 18 * 3600000).toISOString(), viewerIds: ["me"], createdAt: h(6) },
  { id: "s3", userId: "u6", type: "text", content: "Nouveau son disponible maintenant", backgroundColor: "#00D4A4", expiresAt: new Date(now + 15 * 3600000).toISOString(), viewerIds: [], createdAt: h(8) },
  { id: "s4", userId: "u8", type: "text", content: "Journée productive!", backgroundColor: "#45B7D1", expiresAt: new Date(now + 10 * 3600000).toISOString(), viewerIds: ["me"], createdAt: h(10) },
];

export const MOCK_CALLS: GCall[] = [
  { id: "call1", userId: "u1", type: "audio", direction: "incoming", missed: false, timestamp: h(0.5), duration: "3:42" },
  { id: "call2", userId: "u3", type: "video", direction: "outgoing", missed: false, timestamp: h(2), duration: "12:05" },
  { id: "call3", userId: "u6", type: "audio", direction: "incoming", missed: true, timestamp: h(26), duration: null },
  { id: "call4", userId: "u2", type: "audio", direction: "outgoing", missed: false, timestamp: h(48), duration: "1:23" },
  { id: "call5", userId: "u4", type: "video", direction: "incoming", missed: true, timestamp: h(72), duration: null },
  { id: "call6", userId: "u8", type: "audio", direction: "outgoing", missed: false, timestamp: h(96), duration: "8:14" },
];

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Hier";
  if (days < 7) return date.toLocaleDateString("fr-FR", { weekday: "short" });
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

interface ChatsContextType {
  chats: GChat[];
  messages: Record<string, GMessage[]>;
  users: Record<string, GUser>;
  stories: GStory[];
  sendMessage: (chatId: string, content: string) => void;
  markChatAsRead: (chatId: string) => void;
  addStoryView: (storyId: string) => void;
  getOtherUser: (chat: GChat) => GUser | undefined;
}

const ChatsContext = createContext<ChatsContextType | null>(null);
const MSG_KEY = "@gbairai_messages";
const CHATS_KEY = "@gbairai_chats";

export function ChatsProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<GChat[]>(INITIAL_CHATS);
  const [messages, setMessages] = useState<Record<string, GMessage[]>>(INITIAL_MESSAGES);
  const [stories, setStories] = useState<GStory[]>(INITIAL_STORIES);
  const users = MOCK_USERS;

  useEffect(() => {
    const load = async () => {
      try {
        const [rawMsg, rawChats] = await Promise.all([
          AsyncStorage.getItem(MSG_KEY),
          AsyncStorage.getItem(CHATS_KEY),
        ]);
        if (rawMsg) setMessages(JSON.parse(rawMsg));
        if (rawChats) setChats(JSON.parse(rawChats));
      } catch {}
    };
    load();
  }, []);

  const persist = async (msgs: Record<string, GMessage[]>, cs: GChat[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(MSG_KEY, JSON.stringify(msgs)),
        AsyncStorage.setItem(CHATS_KEY, JSON.stringify(cs)),
      ]);
    } catch {}
  };

  const sendMessage = (chatId: string, content: string) => {
    const newMsg: GMessage = {
      id: `msg_${Date.now()}`,
      chatId,
      senderId: "me",
      content,
      type: "text",
      status: "sent",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => {
      const updated = { ...prev, [chatId]: [...(prev[chatId] || []), newMsg] };
      persist(updated, chats);
      return updated;
    });
  };

  const markChatAsRead = (chatId: string) => {
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c));
      persist(messages, updated);
      return updated;
    });
  };

  const addStoryView = (storyId: string) => {
    setStories((prev) =>
      prev.map((s) =>
        s.id === storyId && !s.viewerIds.includes("me")
          ? { ...s, viewerIds: [...s.viewerIds, "me"] }
          : s,
      ),
    );
  };

  const getOtherUser = (chat: GChat) => {
    const otherId = chat.participantIds.find((id) => id !== "me");
    return otherId ? users[otherId] : undefined;
  };

  return (
    <ChatsContext.Provider value={{ chats, messages, users, stories, sendMessage, markChatAsRead, addStoryView, getOtherUser }}>
      {children}
    </ChatsContext.Provider>
  );
}

export function useChats() {
  const ctx = useContext(ChatsContext);
  if (!ctx) throw new Error("useChats must be used within ChatsProvider");
  return ctx;
}
