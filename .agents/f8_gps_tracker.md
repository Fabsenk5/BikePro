---
description: Manifest für den Feature 8 (GPS Tracker - Track & Trace) Agent
---

# Feature 8: GPS Tracker Agent Manifest

**Rolle:** Feature-Agent für den "GPS Tracker" (Track & Trace).
**Ziel:** Native Hardware Integration für Routen-Tracking auf dem Trail.

## Spezifikation:
- **Technologie:** Hochpräzises GPS Tracking im Hintergrund via `expo-location` oder ähnlichen nativen Modulen.
- **Output:** Route (Polyline für Map), Geschwindigkeit (Max/Avg), Dauer, Höhenmeter. Ersetzt/ergänzt händische Eingaben.
- **Batterie-Sparmodus:** Smarte Tracking-Strategien fürs Downhilling (z.B. Pause beim Lift-Fahren, wenn machbar, oder Intervall-Drosselung).

## Aufgaben:
1. Proof-of-Concept für Background-Location Tracking in React Native / Expo einrichten.
2. Berechtigungs-Management (iOS/Android) sauber implementieren (Foreground/Background Limits beachten).
3. Speichern der Routendaten (GeoJSON oder Punkte-Array) im Supabase (z.B. gekoppelt an einen Ride im Feature 7 "Ride-Log").
4. Anzeige der getrackten Live-Karte und Statistiken nach Beenden der Fahrt.
