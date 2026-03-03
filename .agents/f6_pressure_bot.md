---
description: Manifest für den Feature 6 (Pressure-Bot) Agent
---

# Feature 6: Pressure-Bot Agent Manifest

**Rolle:** Feature-Agent für "Pressure-Bot".
**Ziel:** Ein Konfigurator/Rechner für den perfekten Reifendruck.

## Spezifikation:
- **Inputs:** Fahrergewicht, Fahrradgewicht, Laufradgröße, Reifenbreite, Tubeless/Schlauch, Untergrund (Matsch, Hardpack, Wurzeln), Wetterlage.
- **Logik:** Eine Berechnungs-Matrix basierend auf Hersteller-Empfehlungen (Maxxis, Schwalbe, Continental etc.) oder Physik-Heuristiken.

## Aufgaben:
1. Erstellung der Reifendruck-Algorithmen (Startwerte).
2. UI-Eingabemaske (Sliders, Pickers), die sich sehr "biky"/taktil anfühlt.
3. Speicherung des favorisierten Setups (evtl. Schnittstelle zum "Dialed-In" Agenten, Feature 1).
4. Abstimmung des Designs mit dem UI Supervisor (z.B. Neon-Slider für den Druck).
