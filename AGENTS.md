# BikePro — AGENTS.md

MTB setup & riding companion. Expo (React Native) + expo-router + TypeScript, web-first via Metro static export.

## Commands

- `npm run web` — dev server (web)
- `npm run build:web` — static export to `dist/`
- `npx tsc --noEmit` — type-check (no test suite, no lint script)
- `node supabase/run_migration.js` — apply DB migrations (needs `DATABASE_URL` in `supabase/.env`)

## Layout

- `app/(tabs)/` — Home (`index.tsx`), Profile, Admin; `app/(features)/` — one screen per feature
- `components/ui/` — shared BP* components (BPCard, BPButton, BPInput, BPSlider, BPModal, BPPicker, BPProgressBar), barrel `index.ts`
- `constants/Features.ts` — feature registry (id, route, accentColor, `ready` flag) — one tile = one entry
- `constants/Colors.ts` — `theme` object: colors/spacing/radius (dark theme only, system fonts)
- `lib/supabase.ts` — lazy client (`getSupabase()`), `loadFromStorage`/`saveToStorage` helpers, `ADMIN_EMAIL`
- `lib/sync.ts` — cloud-sync layer: `syncLoad*`/`syncSave*`/`syncDelete*`, falls back to AsyncStorage when unauthenticated; camelCase↔snake_case mapping in `mapRowToLocal`/`mapLocalToRow`
- `context/AuthContext.tsx` — auth state; `lib/i18n.ts` + `locales/{de,en}.json` — i18next, de fallback
- `.agents/` — per-feature agent manifests (f1–f10), coordinator, `rules/` (see below)

## Conventions

- Local-first: AsyncStorage keys `@bikepro_*`; always write through `lib/sync.ts` helpers, never raw Supabase calls in screens. Never destructive delete in save functions — explicit `syncDelete*` only.
- UI: BP* components + `theme` tokens; dark theme only; German UI copy, English code; every new user-facing string in **both** locale files.
- Supabase client must stay lazy (module-level init breaks static export).
- New feature = registry entry in `constants/Features.ts` + screen in `app/(features)/` + `.agents/` manifest.

## Deployment

- Vercel, auto-deploy from GitHub. `vercel.json`: build = `npm run build:web`, output = `dist`, SPA rewrite all → `index.html`.
- Env vars (local `.env` + Vercel project settings): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). App must work fully without them (offline mode).

## DB Schema (Supabase/Postgres, RLS on all tables, `auth.uid() = user_id` policies)

- `bikes` (id TEXT PK, name, type, model, year, size, weight)
- `components` (→ bikes CASCADE; setup_values/wear_items JSONB; wear tracking: current_km, service_interval_km, max_clicks, rebound/compression_mode)
- `suspension_setups` (Dialed-In; fork/shock/tires JSONB)
- `rides` (Ride-Log; data JSONB overflow)
- `user_preferences` (key/value JSONB, UNIQUE(user_id,key); favorites, tile order, shred-check, rider profile)
- `profiles` (auth.users trigger, `is_active` gate) + `wiki_overrides` (Setup-Guide admin content)
- Admin RPCs (`admin_get_users`, `admin_update_user_status`, `admin_delete_user`, `admin_update_user_password`), gated by `is_admin()` = `ADMIN_EMAIL`
- Migrations: numbered SQL in `supabase/`, run via `run_migration.js` (add new file there too); snake_case columns mapped in `lib/sync.ts`

## Rules (from .agents/rules)

- No agent-driven browser testing (token cost) — hand the user a manual test script instead.
- After validated changes: `git add . && git commit -m "..." && git push` (confirm with user first per session policy).
