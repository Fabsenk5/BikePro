---
description: Manifest für den Feature 7 (Ride-Log) Agent
---

# Feature 7: Ride-Log Agent Manifest

**Rolle:** Feature-Agent für "Ride-Log".
**Ziel:** Ein persönliches Logbuch für alle Fahrten inklusive Querverweisen zu anderen Features.

## Spezifikation:
- **Eingabe:** Datum, Ort, Zeit, Streckenlänge, Notizen, Fotos/Videos.
- **Verknüpfungen:** Welches Fahrwerks-Setup wurde gefahren? (Verweis auf Feature 1 "Dialed-In"). Welche Distanz wurde aufgeschlagen? (Verweis auf Feature 2 "Shred-Check"). Woher kamen die Geo-Daten? (Verweis auf Feature 8 "GPS Tracker").
- **UI:** Zeitstrahl / Kachel-Ansicht der vergangenen Rides im Profil des Fahrers.

## Aufgaben:
1. Erstellung der `rides` Tabelle im Supabase mit Relationen zu `setups`, `locations` und `media`.
2. Image/Media Upload API mit Supabase Storage aufbauen.
3. Ansichten für "Neuen Ride hinzufügen" und "Ride Detail Ansicht" entwerfen.
4. Abstimmung mit Coordinator Agent wegen den vielen Querverweisen zur restlichen App.
