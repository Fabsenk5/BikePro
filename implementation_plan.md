# BikePro – Entwicklungsplanung / Development Roadmap

## ✅ Implemented (Ready)

| # | Feature | Agent | Status |
|---|---------|-------|--------|
| 1 | Dialed-In – Fahrwerks-Log | `f1_dialed_in.md` | ✅ Ready |
| 2 | Shred-Check – Komponenten-Tracker | `f2_shred_check.md` | ✅ Ready |
| 6 | Pressure-Bot – Reifendruck-Rechner | `f6_pressure_bot.md` | ✅ Ready |
| 7 | Ride-Log – Fahrtenbuch | `f7_ride_log.md` | ✅ Ready |

## 🚧 In Development / Planned

| # | Feature | Agent | Status |
|---|---------|-------|--------|
| 3 | Park-Picker Pro – Bikepark-Aggregator | `f3_park_picker.md` | 🔜 Planned |
| 4 | Trail-Video – Edits of the Week | `f4_trail_video.md` | 🔜 Planned |
| 5 | Jump-Analyzer – Airtime & Stil | `f5_jump_analyzer.md` | 🔜 Planned |
| 8 | Track & Trace – GPS Tracker | `f8_gps_tracker.md` | 🔜 Planned |
| **9** | **Component Tracker – Gear & Setups** | `f9_component_tracker.md` | 🆕 New |
| **10** | **Setup Guide – MTB Setup Wiki** | `f10_setup_guide.md` | 🆕 New |

## Next Milestones

### Component Tracker (F9)
1. Define data models for Bikes (master) and Components (gear items).
2. Build Bike-Master CRUD UI (name, type, model, year, image).
3. Build Component CRUD UI per Bike (handlebars, brakes, seats, grips, etc.).
4. Add setup values per component (torque, angle, width, spacers).
5. Overview screen showing all components of a selected bike.

### Setup Guide (F10)
1. Design wiki data structure (categories, articles, tags).
2. Build category navigation with search.
3. Implement article detail view with typography and images.
4. Add favorites for quick access.
5. Contextual links from Component Tracker to relevant wiki articles.
