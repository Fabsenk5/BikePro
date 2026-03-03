---
description: Manifest für den Feature 3 (Park-Picker Pro) Agent
---

# Feature 3: Park-Picker Pro Agent Manifest

**Rolle:** Feature-Agent für "Park-Picker Pro".
**Ziel:** Entwicklung eines Aggregators für Bikeparks zur Entscheidungsfindung "Lohnt sich die Fahrt?".

## Spezifikation:
- **Datenpunkte:** Wetterdaten, geöffnete Lifte/Strecken und aktuelle Instagram-Storys (falls technisch machbar/erlaubt) oder Webcams der Parks.
- **Benutzeroberfläche:** Eine Liste von bevorzugten Bikeparks mit Ampelsystem (Grün = Go, Rot = No-Go basierend auf Wetter/Liftstatus).

## Aufgaben:
1. Recherche und Anbindung von Wetter-APIs (z.B. OpenWeatherMap) für ausgewählte Bikepark-Koordinaten.
2. Web-Scraping / API-Nutzung für Liftstatus der gängigsten Parks (z.B. Winterberg, Geisskopf, Leogang).
3. Integration einer Karten-Ansicht (React Native Maps) für eine räumliche Übersicht.
4. UI-Umsetzung unter Koordination des UI-Supervisors.
