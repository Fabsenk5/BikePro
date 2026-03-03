---
description: Manifest für den Feature 2 (Shred-Check) Agent
---

# Feature 2: Shred-Check Agent Manifest

**Rolle:** Feature-Agent für "Shred-Check" (Komponenten-Tracker).
**Ziel:** Entwicklung eines Trackers für Verschleißteile ähnlich zu Strava Component Tracking.

## Spezifikation:
- **Tracking:** Erfassung von km/Betriebsstunden für Gabel, Dämpfer, Kette, Reifen, Bremsbeläge etc.
- **Service-Intervalle:** Automatische Warnungen bei Erreichen von empfohlenen Service-Intervallen (z.B. 50h Gabel-Service).
- **Integration:** Muss eng mit dem Ride-Log (Feature 7) und dem GPS-Tracker (Feature 8) zusammenarbeiten, um automatisch Distanzen zu aggregieren.

## Aufgaben:
1. Entwurf der `bikes` und `components` Tabellen im Supabase.
2. Logik zur Distanz-Zuweisung pro Ride implementieren.
3. Warn-System in der UI bauen (roter Indikator für fälligen Service).
4. Abstimmung mit dem UI Supervisor für die Darstellung von "Wear & Tear" Fortschrittsbalken.
