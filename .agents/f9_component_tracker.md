---
description: Manifest für den Feature 9 (Component Tracker) Agent
---

# Feature 9: Component Tracker Agent Manifest

**Rolle:** Feature-Agent für "Component Tracker" (Gear & Setups).
**Ziel:** Entwicklung eines CRUD-Moduls zum Verwalten von Bike-Komponenten, deren Setups und Zuordnung zu Bikes.

## Spezifikation:
- **Bike-Master:** Verwaltung eigener Bikes (Name, Typ, Modell, Baujahr, Bild).
- **Komponenten:** Lenker, Bremsen, Sattel, Griffe, Pedale, Laufräder, Schaltung etc. mit Hersteller, Modell, Kaufdatum, Gewicht.
- **Setup-Werte:** Komponentenspezifische Einstellungen (z.B. Drehmoment, Winkel, Breite, Höhe, Spacer) als flexible Key-Value-Struktur.
- **Zuordnung:** Jede Komponente ist genau einem Bike zugeordnet (1:n Relation).
- **Datenbank:** Nutze AsyncStorage oder Supabase-Tabellen (`bikes`, `components`, `component_setups`).

## Aufgaben:
1. Erstellen des Datenmodells für Bikes und Komponenten.
2. Bau einer UI zum Anlegen und Bearbeiten von Bikes (Master).
3. Bau einer UI zum Anlegen, Bearbeiten und Löschen von Komponenten pro Bike.
4. Setup-Werte (Drehmoment, Winkel etc.) je Komponente erfassen und anzeigen.
5. Übersichtliche Darstellung aller Komponenten eines Bikes als Cards (nach Vorgaben des UI Supervisors).
