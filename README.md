# 🚵 BikePro — MTB Setup & Riding Companion

> Your personal mountain bike setup, maintenance, and riding companion app.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Fabsenk5/BikePro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Live Demo:** [bikepro-one.vercel.app](https://bikepro-one.vercel.app)

---

## ✨ Features

| # | Feature | Description | Status |
|---|---------|-------------|--------|
| 1 | ⚙️ **Dialed-In** | Suspension log with HSC/HSR/LSC/LSR, SAG%, travel, tire pressures | ✅ |
| 2 | 🔧 **Shred-Check** | Component wear tracker with 22 types, service intervals & progress bars | ✅ |
| 3 | 🏔️ **Park-Picker Pro** | Bikepark aggregator with 15 parks (DE/AT/CH/FR/IT), Go/No-Go scoring | ✅ |
| 4 | 🎬 **Trail-Video** | Curated YouTube trail video player | ✅ |
| 5 | 💨 **Pressure-Bot** | Tire pressure calculator with casing, riding style & smart notes | ✅ |
| 6 | 📖 **Ride-Log** | Ride journal with terrain, difficulty (S0–S3+), descent, max speed | ✅ |
| 7 | 🔩 **Component Tracker** | Bike master CRUD with 16 component types & dynamic setup fields | ✅ |
| 8 | 📚 **Setup Guide** | MTB setup wiki with 34 articles across 7 categories | ✅ |
| 9 | 🚀 **Jump-Analyzer** | Coming soon | 🔜 |
| 10 | 📍 **Track & Trace** | Coming soon | 🔜 |

---

## 🛠️ Tech Stack

- **Framework:** [Expo](https://expo.dev) (React Native) with [Expo Router](https://expo.github.io/router)
- **Language:** TypeScript
- **Styling:** React Native StyleSheet with dark theme
- **Storage:** AsyncStorage (local-first, Supabase-ready)
- **Web:** Metro bundler with static export
- **Deployment:** [Vercel](https://vercel.com) (automatic via GitHub integration)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- npm or yarn

### Installation

```bash
git clone https://github.com/Fabsenk5/BikePro.git
cd BikePro
npm install
```

### Development

```bash
# Start Expo dev server (web)
npm run web

# Start for iOS/Android
npm run ios
npm run android
```

### Production Build

```bash
# Export static web build
npm run build:web
```

The output will be in `dist/` — ready for deployment to Vercel, Netlify, or any static host.

---

## 📁 Project Structure

```
BikePro/
├── app/                    # Expo Router pages
│   ├── (tabs)/             # Tab navigation (Home, Profile)
│   ├── (features)/         # Feature screens
│   └── +html.tsx           # Web HTML template
├── components/ui/          # Shared UI components (BPCard, BPSlider, etc.)
├── constants/              # Colors, Features registry
├── lib/                    # Storage helpers (AsyncStorage / Supabase-ready)
├── assets/                 # Images, fonts
├── .agents/                # AI agent manifests per feature
└── vercel.json             # Deployment config
```

---

## 🔒 Security

See [SECURITY.md](SECURITY.md) for our security policy and vulnerability reporting.

**Summary:** All data is stored locally via AsyncStorage. No user data is transmitted to external servers. No authentication or PII is collected. See the full [Security Audit](#security-audit) for details.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
