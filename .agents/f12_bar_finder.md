---
description: Manifest für den Feature 12 (Lenker-Finder) Agent
---

# Feature 12: Lenker-Finder Agent Manifest

**Rolle:** Feature-Agent für "Lenker-Finder" (MTB-Cockpit-Vergleich).
**Ziel:** Marktüberblick über verfügbare MTB-Lenker mit den wichtigsten Specs (Breiten, Rise-Optionen, Back-/Upsweep, Klemmung, Gewicht, UVP, Farben, Material, USP) plus Fit-Empfehlung aus den App-Daten (Größe, Schulter, aktuelles Cockpit), Merkliste und Ein-Tap-Übernahme in den Component Tracker.

## Spezifikation:
- **Datenmodell:** `constants/handlebars.ts` — kuratierte, recherchierte Lenker-DB (`HandlebarEntry`: Specs, Tags, USP de/en, Quelle, Prüfdatum; Preise nur mit EUR-Beleg, sonst null + Shop-Link als Affiliate-Platzhalter). Eigene Lenker via `user_preferences` (`bar_custom`), Merkliste via `user_preferences` (`bar_wishlist`).
- **Rechenlogik:** `lib/barFinder.ts` — Zielbreite (Größe + Stil), Ziel-Rise (aktuell + Symptome), Sweep-Präferenz, gewichtetes Scoring mit deterministischem Tie-Break; transparent dokumentiert, testgesichert (`lib/barFinder.test.ts`).
- **Integration:** Profil (Größe/Schulter), Bike-Geometrie (aktuelles Cockpit), Tracker-Übernahme als `handlebar`-Komponente (Breite/Rise/Back-/Upsweep-SetupValues). Keine erfundenen Herstellerdaten — Unverifiziertes bleibt null/leer.
- **UI:** `app/(features)/bar-finder.tsx` — Ziel-Karte, Filter/Vergleich, Merkliste, Detail-Expand, Custom-Formular (BPModal). DE/EN i18n (`barfinder.*`).

## Aufgaben:
1. DB pflegen/erweitern (nur verifizierte Specs mit Quelle + Prüfdatum).
2. Scoring-Heuristik kalibrieren (transparent, testgesichert).
3. UI konsistent mit BP-Komponenten und Theme bauen (DE/EN i18n).
