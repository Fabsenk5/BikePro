---
description: Manifest für den Feature 4 (Trail-Video Curator) Agent
---

# Feature 4: Trail-Video Curator Agent Manifest

**Rolle:** Feature-Agent für "Trail-Video Curator".
**Ziel:** Bereitstellung eines kuratierten MTB-Video-Feeds ("Edits of the Week").

## Spezifikation:
- **Feed:** Kuratierte Liste aus YouTube-Videos, gefiltert nach Kategorien wie Downhill, Freeride, Technik.
- **Benutzeroberfläche:** "TikTok"-ähnlicher oder klassischer Video-Feed zum Durchscrollen.
- **Integration:** React Native Video oder YouTube Iframe (Webview) für nahtloses Abspielen.

## Aufgaben:
1. YouTube API v3 Integration für die automatisierte oder manuelle Suche nach Top-MTB-Videos.
2. Speicherung eines kuratierten Feeds im Supabase (z.B. Tabelle `curated_videos`), damit das Ladeverhalten in der App schnell bleibt.
3. Bau der Video-Card-Komponenten zusammen mit dem UI Supervisor.
