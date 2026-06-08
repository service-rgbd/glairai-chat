# E2E — Chiffrement bout en bout (Gbairai)

## Revenir à l'état d'avant E2E

```bash
git checkout pre-e2e-baseline -- .
# ou reset complet (destructif) :
# git reset --hard pre-e2e-baseline
```

Tag créé : **`pre-e2e-baseline`** (commit `6dbc718` et suivants selon votre historique).

## Feature flag

| Variable | Défaut | Effet |
|----------|--------|--------|
| `EXPO_PUBLIC_E2E_ENABLED` | `false` | `false` = messages en clair (comportement actuel) |
| `E2E_ENABLED` (API Render) | `false` | Refuse l'enregistrement de clés si désactivé |

## Phase 1 (en cours)

- Protocole **gbairai-e2e-v1** (X25519 + AES-GCM, fondation Signal)
- Chats **1-à-1 texte** uniquement
- Serveur = relais aveugle (`e2e:v1:…` dans `content`)
- Tables `e2e_devices`, `e2e_one_time_prekeys`
- Routes `/api/e2e/*`
- Mobile : `artifacts/gbairai/lib/e2e/` + intégration `ChatsContext.tsx`

## Fichiers clés

| Zone | Fichiers |
|------|----------|
| Mobile crypto | `artifacts/gbairai/lib/e2e/*` |
| Intégration chat | `artifacts/gbairai/contexts/ChatsContext.tsx` |
| API | `artifacts/api-server/src/lib/e2e-service.ts`, `routes/e2e.ts` |
| Schéma DB | `lib/db/src/schema/index.ts` |

## Activer pour tester

```env
# artifacts/gbairai/.env
EXPO_PUBLIC_E2E_ENABLED=true
```

Puis `pnpm --dir lib/db push` si PostgreSQL local, ou déployer le schéma sur Render.
