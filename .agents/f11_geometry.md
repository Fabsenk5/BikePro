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
- **Annahmen (grau + „Annahmen übernehmen" im Cockpit):** Sattelhöhe (0,883 × Innenbein), Sattel-Setback (Sitzrohr-Geometrie − Sattel-Offset), Cockpit-Standards je Disziplin (`cockpitDefaults`: Lenker-Rise/-Breite, Back-/Upsweep, Vorbaulänge/-winkel, Kurbellänge); fließen in `displayGeometry` (Skizze, Fit-Checks, RAD) ein, werden aber nur auf Wunsch in die Felder übernommen.
- **Messkonventionen (eindeutig):** Sattelhöhe = Tretlager-Mitte → Satteloberkante, direkt entlang des Sitzrohrs (Modell projiziert ×sin(Sitzwinkel) ins Vertikale); Setback = Sattelspitze → Lot durch die Tretlager-Mitte (horizontal); Lenkerhöhe/-vor = Tretlager-Mitte → Mitte Lenkerklemmung (vertikal/horizontal); Sattelspitze → Griff = direkte Strecke zur Griffmitte des echten Griffs; Sattel→Lenker = Satteloberkante → Lenkerklemmung (vertikal); Tretlagerhöhe = Boden → Tretlager-Mitte. UI-Hinweise + Wiki (Messanleitung) beschreiben die Punkte.
- **Körpermodell (validiert):** Bein = Oberschenkel 0,53 × Innenbein + Unterschenkel inkl. Fuß 0,67 × Innenbein (Summe 1,20 × Innenbein = Hüftgelenk→Pedal; reproduziert die 25–35°-Kniebeugung bei LeMond-Sattelhöhe); Arm = Oberarm 0,48 + Unterarm inkl. Hand bis Handballen 0,52 (Summe = Armlänge, Profilfeld „Schulter–Handballen"). Tests sichern Summen, Verhältnisse und die Sattelhöhen-Konsistenz ab.
- **Animation (Seitenansicht):** Play-Button — Räder rollen auf der Stelle (Speichen drehen), ein Stein läuft durch: Phase 1 kleiner Stein (min(Gabel-/Dämpfer-Hub)) → nur die Federung arbeitet; Phase 2 größerer Stein (1,25× Gabel-Hub) → Federung am Limit, Bike hebt sich, Fahrer absorbiert (Hüfte/Schulter sinken im rahmenfesten Bild, Rückenwinkel stabil, Arme/Beine beugen per IK). Dämpfer-Kompression über Übersetzungsverhältnis (Radweg × Hub/Federweg).
- **Skizzen:** `lib/bikeSketch.ts` + `components/BikeSideView.tsx`/`BikeFrontView.tsx` — Seitenansicht (Sag-Pitch, Fahrerpose mit Ellenbogen-/Kniebeugung, Pedalstellung horizontal/unten umschaltbar, Kniebeugungs-Richtwert, abgeleiteter Rückenwinkel aus Torso-/Armlänge und Lenkerposition) und Frontansicht (Reifenbreite von vorn, Schulter vs. Griffweite, Beine in beiden Rider-Modi); Vier Rider-Modi: Sitzend / Stehend / Attack flach / Attack steil (Stehend und Attack = Dropper eingefahren; Attack flach/steil = Hip-Hinge: Po hinter und über dem (abgesenkten) Sattel, Oberkörper flach (steil: ~19°, Beine gestreckter), stark angewinkelte Arme); Dropper-Hub und Sattelstützen-Auszug als Cockpit-Felder (Hub auch aus Tracker/Modellname; Sattelhöhe aus Sitzrohr + Auszug + Hub + Sattelaufbau ableitbar), Gabel/Dämpfer als Zickzack-Federn — die Feder ist nur so lang wie der Hub, der Rest bleibt Linie (Dämpfer ~3× Hub mit Körper/Schaft, Gabel-Krone = halber Hub); Fixes Ansichtsfenster für alle Bikes/Modi: BB horizontal zentriert, Boden auf fester Höhe (Bike hebt sich im Hindernis-Fall, nicht der Boden), 10-cm-Grid mit BB als Nullpunkt, fixer Maßstab → Geometrien überlagern sich direkt; Sattel-Position nutzt Sattelhöhe + Setback (Setback-Annahme aus der Sitzrohr-Geometrie, siehe Cockpit); Skizzen-Mathematik szenario-getestet.
- **UI:** `app/(features)/geometry.tsx` — Tabs: Analyse, Rahmen, Cockpit, Messwerte, Vergleich.
- **Qualität:** Unit-Tests + Szenario-Matrix (`lib/geometry*.test.ts`); jede Formel-/Band-Änderung muss die Matrix bestehen.

## Aufgaben:
1. Datenmodell + Migration pflegen (nummerierte SQL, `run_migration.js`).
2. Rechenlogik und Zielbänder kalibrieren (transparente Heuristik, testgesichert).
3. UI konsistent mit BP-Komponenten und Theme bauen (DE/EN i18n).
4. Verknüpfungen zu Tracker/Profil/Wiki aktuell halten.
5. Szenario-Matrix bei Änderungen erweitern statt Erwartungen aufweichen.
