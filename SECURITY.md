# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅         |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email: **fabiank5@hotmail.com**
3. Include: description, reproduction steps, potential impact
4. Expected response time: **48 hours**

## Current Architecture (v1.0.x)

- **Authentication:** Supabase Auth (email + password). New accounts require beta activation (`profiles.is_active = true`) by an admin before they can use cloud features.
- **Database:** Supabase/Postgres. Row-Level Security (RLS) is enabled on all tables; policies enforce both ownership (`auth.uid() = user_id`) and activation (`is_active_user()`).
- **Cloud Sync:** Authenticated + activated users sync data to Supabase; without login the app works fully offline via `AsyncStorage` (local-only fallback).
- **Admin RPCs:** User management (list, activate/deactivate, delete, set password) runs through `SECURITY DEFINER` functions gated by an `is_admin()` check, with a fixed `search_path`. Admin-set passwords must be at least 8 characters (enforced server-side).
- **Web headers:** CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy and HSTS are set via `vercel.json`.

## Data Privacy

- **PII collected:** Email address only (required for login). No name, location, or tracking data.
- **Data ownership:** All user-generated data (bikes, components, setups, rides) belongs to the user's account and is only readable/writable by that account (RLS).
- **Deletion:** Users can delete individual records in the app at any time. Account deletion (including all associated data) is available on request via the admin contact above.
- **Telemetry:** No analytics, crash reporting, or ad SDKs.
- **Third parties:** Data is stored on Supabase infrastructure; no other third parties receive data.

## Security Configuration

- Supabase credentials are injected via environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — only the public anon key, which is safe to expose with RLS enabled; no secrets in the repo.
- All `SECURITY DEFINER` functions use a fixed `search_path` (`public, auth, pg_temp`) to prevent search-path hijacking.
- Password minimum: 8 characters (client-side and server-side).

## Recommendations

1. Run `npm audit` regularly and update dependencies.
2. Keep Supabase RLS policies under review when adding new tables.
3. Rotate credentials immediately if the anon key handling model changes (e.g., introducing service-role keys anywhere client-adjacent).
