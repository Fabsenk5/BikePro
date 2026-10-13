---
description: Manifest für den Feature 11 (Geometrie & Fit) Agent
---

# Feature 11: Geometrie & Fit Agent Manifest

**Rolle:** Feature-Agent für "Geometrie & Fit" (Sitz- und Stehgeometrie-Tool).
**Ziel:** Bikes über Rahmen-, Cockpit- und Messwerte vergleichbar machen, Fit-Checks gegen Disziplin-Zielbänder liefern und aus Symptomen konkrete mm-Empfehlungen ableiten — vollständig integriert mit Component Tracker und Profil.

## Spezifikation:
- **Datenmodell:** `bikes.geometry` JSONB (frame / cockpit / fit / measured / meta), Sanitizing + Sync über `lib/sync.ts`.
- **Rechenlogik:** `lib/geometry.ts` — Kontaktgeometrie (Bar-/Handposition inkl. Backsweep/Upsweep, RAD, Sattel→Lenker-Drop, Sitz-Reach), Disziplin-Zielbänder (Tour/Trail/Enduro/DH), Fit-Checks, Symptom-Engine (8 Symptome).
- **Integration:** Auto-Fill aus Component Tracker (Lenker/Vorbau/Sattel), Körpermaße aus dem Profil (Größe, Innenbein, optional Arm/Oberkörper/Schulter), Deep-Links (`?editComponent=`), Wiki-Messanleitung.
- **Skizzen:** `lib/bikeSketch.ts` + `components/BikeSideView.tsx`/`BikeFrontView.tsx` — Seitenansicht (Sag-Pitch, Fahrerpose mit Ellenbogen-/Kniebeugung, Pedalstellung horizontal/unten umschaltbar, Kniebeugungs-Richtwert) und Frontansicht (Reifenbreite von vorn, Schulter vs. Griffweite, Beine in beiden Rider-Modi); Sitzend/Stehend-Umschalter (Stehend = Dropper eingefahren, Hub aus dem Tracker bzw. Modellname, sonst Default; stehend aufrechter und mit gestreckteren Beinen), Gabel/Dämpfer als Zickzack-Federn — die Feder ist nur so lang wie der Hub, der Rest bleibt Linie; Zoom stabil über Sag und Modus (Bounds aus ungesagten Skizzen beider Modi); Sattel-Position nutzt Sattelhöhe + Setback (Setback-Annahme aus der Sitzrohr-Geometrie, siehe Cockpit); Skizzen-Mathematik szenario-getestet.
- **UI:** `app/(features)/geometry.tsx` — Tabs: Analyse, Rahmen, Cockpit, Messwerte, Vergleich.
- **Qualität:** Unit-Tests + Szenario-Matrix (`lib/geometry*.test.ts`); jede Formel-/Band-Änderung muss die Matrix bestehen.

## Aufgaben:
1. Datenmodell + Migration pflegen (nummerierte SQL, `run_migration.js`).
2. Rechenlogik und Zielbänder kalibrieren (transparente Heuristik, testgesichert).
3. UI konsistent mit BP-Komponenten und Theme bauen (DE/EN i18n).
4. Verknüpfungen zu Tracker/Profil/Wiki aktuell halten.
5. Szenario-Matrix bei Änderungen erweitern statt Erwartungen aufweichen.
