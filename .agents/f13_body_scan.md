---
description: Manifest für den Feature 13 (Body Scan) Agent
---

# Feature 13: Body Scan Agent Manifest

**Rolle:** Feature-Agent für "Body Scan" (Foto-Körperanalyse).
**Ziel:** Aus 1 Frontfoto + Größenreferenz die Körpermaße für Profil und Geometrie-Fit ableiten — genauer als Selbstmessen, vollständig offline, Fotos bleiben lokal.

## Spezifikation:
- **Datenmodell:** Kein neues Supabase-Table (Coordinator-Regel). Maße → `rider_profile` via `syncSaveProfile` (`lib/sync.ts`); Verlauf (nur Maße, nie Bilddaten) → `user_preferences` Key `body_scans` (`@bikepro_body_scans`, max 10).
- **Rechenlogik:** `lib/bodyScan.ts` — Homographie aus 4 Referenz-Ecken (A4 210×297 / Karte 85,6×53,98) → perspektivkorrigierte mm; Fallback Skalierung über Körpergröße (ohne Korrektur, Konfidenz niedrig). Keypoints: Scheitel, Schultern, Ellenbogen/Handgelenk/Handballen (rechts), Hüfte, Knie, Knöchel, Schritt. Maße: Größe, Schulter, Innenbein, Oberkörper, Arm, Ober/Unterarm, Ober/Unterschenkel. Plausibilitätsbänder + Konfidenz je Maß (testgesichert).
- **Pose-Adapter:** `lib/pose.ts` — MVP manuell (liefert null), Interface stabil für P1 (On-Device MoveNet, Lazy-Import wegen statischem Web-Export).
- **UI:** `app/(features)/body-scan.tsx` — Wizard Foto → Referenz → Punkte → Ergebnis; `components/BodySkeletonOverlay.tsx` — seitenverhältnis-treues Tap-Overlay mit Skelett-Linien (SVG). BP-Komponenten + theme, DE/EN i18n (`bodyscan.*`).
- **Privacy:** Kein Upload-Pfad im MVP. Records enthalten `hasPhoto: false` per Typ — Bilddaten dürfen nie in Verlauf/Cloud landen.
- **Qualität:** Unit-Tests `lib/bodyScan.test.ts` (Homographie, Summen, Skalierung, Profil-Mapping); jede Formeländerung muss die Tests bestehen.

## Aufgaben:
1. Rechenlogik und Bänder kalibrieren (transparent, testgesichert).
2. P1: On-Device Pose-Verdrahtung in `lib/pose.ts` (UI bleibt unverändert, Punkte editierbar lassen).
3. P2 (Opt-in): Seitenfoto-Verifizierung + optionale Cloud-Verfeinerung.
4. UI konsistent mit BP-Komponenten und Theme bauen (DE/EN).
