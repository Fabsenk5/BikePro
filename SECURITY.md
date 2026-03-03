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

## Security Audit Results (v1.0.0)

**Audit Date:** 2026-03-04
**Auditor:** Automated + Manual Review
**Result:** ✅ No critical vulnerabilities found

### Dependency Audit

| Check | Result |
|-------|--------|
| `npm audit` | 0 vulnerabilities |
| Known CVEs in dependencies | None |
| Outdated packages with security patches | None |

### Code Security Analysis

| Area | Status | Details |
|------|--------|---------|
| **Code Injection** | ✅ Safe | No `eval()`, `exec()`, `spawn()` usage |
| **XSS** | ✅ Safe | Single `dangerouslySetInnerHTML` in `+html.tsx` uses a static CSS string — no user input involved |
| **External Requests** | ✅ Safe | Zero `fetch()`, `XMLHttpRequest`, or HTTP requests in application code |
| **Data Storage** | ✅ Local only | All data stored via `AsyncStorage` (device-local). No data leaves the device |
| **Authentication** | ✅ N/A | No auth system — no credentials to leak |
| **PII Collection** | ✅ None | No personal data collected (name, email, location, etc.) |
| **External Links** | ⚠️ Curated | `Linking.openURL()` used for bikepark websites and YouTube — all URLs are hardcoded/curated |
| **Third-party SDKs** | ✅ Minimal | Only Expo SDK + AsyncStorage — no analytics, tracking, or ad SDKs |

### Data Privacy

- **Storage:** All user data (setups, rides, components) is stored locally on the device via `AsyncStorage`
- **Network:** The app makes **zero** network requests (except loading the app itself on web)
- **Telemetry:** No analytics, crash reporting, or telemetry is collected
- **Third-party:** No data is shared with third parties
- **GDPR:** No personal data processing — GDPR compliance is not required at current scope

### Supabase Migration Note

The codebase contains placeholder Supabase credentials in `lib/supabase.ts`:
```
SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'
```
These are **non-functional placeholders**. When Supabase integration is activated:
- Use environment variables (`EXPO_PUBLIC_*`) — never commit real keys
- Implement Row-Level Security (RLS) policies
- Add authentication before enabling cloud storage
- Review the Supabase security checklist

### Recommendations

1. **Before production with user accounts:** Add authentication (e.g., Supabase Auth)
2. **Before storing PII:** Implement encryption-at-rest for sensitive data
3. **Before cloud sync:** Enable Supabase RLS and audit database policies
4. **Ongoing:** Run `npm audit` regularly and update dependencies
