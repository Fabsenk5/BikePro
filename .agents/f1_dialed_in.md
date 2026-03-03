---
description: Manifest für den Feature 1 (Dialed-In) Agent
---

# Feature 1: Dialed-In Agent Manifest

**Rolle:** Feature-Agent für "Dialed-In" (Fahrwerks-Log).
**Ziel:** Entwicklung eines CRUD-Moduls zum Speichern von Fahrwerks-Setups je Bikepark/Trail.

## Spezifikation:
- **Eingabemodell:** Rebound (Klicks), Compression (Klicks), Luftdruck (PSI), Volume Spacers (Tokens). Unterscheidung zwischen Gabel und Dämpfer.
- **Lokationen:** Zuweisung eines Setups zu einem definierten Ort (Trail/Bikepark).
- **Datenbank:** Nutze Supabase für das Speichern der Setups (`setups` Tabelle referenziert `users` und `locations`).

## Aufgaben:
1. Erstellen des DB-Schemas für Setups.
2. Bau einer UI zum schnellen Erfassen eines neuen Setups (auch offline-fähig oder mit gutem Caching, da im Wald oft schlechtes Netz ist).
3. Integration in das Ride-Log (Feature 7) als Referenz.
4. Anzeige der Setups als übersichtliche Cards (nach Vorgaben des UI Supervisors).
