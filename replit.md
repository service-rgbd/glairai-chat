# Gbairai

Application de messagerie instantanée mobile (inspirée de WhatsApp) — moderne, fluide et sécurisée, conçue pour les utilisateurs francophones d'Afrique de l'Ouest.

## Run & Operate

- `pnpm --filter @workspace/gbairai run dev` — run the Expo mobile app
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string (not yet provisioned)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) + Expo Router
- State: React Context (AuthContext, ChatsContext) + AsyncStorage
- API: Express 5 (api-server artifact)
- DB: PostgreSQL + Drizzle ORM (not yet provisioned — uses local mock data)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/gbairai/` — Expo mobile app
  - `app/` — Expo Router file-based routes
    - `(auth)/` — Auth flow: welcome, phone, otp, profile-setup
    - `(tabs)/` — Main tabs: index (chats), status, calls, settings
    - `chat/[id].tsx` — Chat detail screen
    - `story/[id].tsx` — Story/status viewer
    - `profile/[id].tsx` — User profile
  - `contexts/AuthContext.tsx` — Auth state (AsyncStorage-backed)
  - `contexts/ChatsContext.tsx` — Chat/message/story/call data (mock + AsyncStorage)
  - `components/` — Avatar, ChatItem, MessageBubble, ChatInput, StoryRing, SearchBar, CallItem
  - `constants/colors.ts` — Design tokens (light + dark, Gbairai brand)
- `artifacts/api-server/` — Express backend (shared API)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)

## Architecture decisions

- Frontend-first MVP: all data persisted locally via AsyncStorage with realistic mock data (8 West African users, 8 conversations, stories, calls)
- AuthContext checks AsyncStorage on mount for saved user session — instant re-auth on app relaunch
- ChatsContext provides MOCK_CALLS as exported constant to avoid prop drilling
- No real-time backend in V1 — mock data simulates a fully populated app for demo/testing
- Inverted FlatList for chat messages (native pattern, no scrollToEnd bugs)
- KeyboardAvoidingView from react-native-keyboard-controller for reliable keyboard handling

## Product

**Phase 1 (current):** Auth flow (phone + OTP + profile setup), Chats list with story rings, full messaging UI with message bubbles + read receipts, Stories/Status viewer, Calls history, Settings with logout.

**Phase 2 (planned):** Real-time backend (Socket.io), media uploads (Cloudinary), push notifications, audio/video calls (WebRTC), group creation.

## Brand

- Primary: `#6D4AFF` (violet)
- Accent: `#00D4A4` (teal)
- Dark bg: `#0F172A`
- Light bg: `#F8FAFC`
- Font: Inter (400/500/600/700)

## User preferences

- App name: Gbairai
- Language: French (UI strings in French)
- Target market: West Africa (Guinée-focused mock data)
- Design: inspired by spec (cartes arrondies, animations fluides, effet glass, micro-interactions)

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`
- Expo workflow uses HMR — only restart for dependency changes or Metro errors
- `shadow*` and `textShadow*` style props are deprecated in RN 0.81 — use `boxShadow`/`textShadow` in future iterations

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for Expo-specific patterns and guidelines
