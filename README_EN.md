# Stash Suite (Free Edition)

A plugin suite that upgrades Stash's browsing, playback, library organization, and manga reading experience.  
No external Python packages (`pip`) or extra servers required — just copy the folders into your Stash `plugins` directory.

---

## Included Plugins (11)

- **Suite Core**: Shared foundation, 10 themes, unified tabbed settings panel, direct external media player launch
- **Server Store**: Syncs plugin settings to your Stash server across devices
- **Quick Genres**: 1-click sort bar, Unwatched/★4+/New switches, favorite boards, performer face strip, and Actress Drawer (photo-first filter, alias search, inline rating, random pick)
- **Light Scene Cards**: Fast, lightweight scene cards (Tall / Side / Cover layouts, 16 customizable fields, hover preview)
- **Scene Card Rarity**: Rating-based card visual effects & click-to-open performer cards
- **Grid Player**: Shift+Click scene cards to play up to 9 videos simultaneously
- **Click Popovers**: Changes card hover popovers to click-to-open
- **Search History**: Recent search dropdown in the search box
- **Auto Backup**: Automatic Stash database backup every 7 days
- **Sharp Covers**: High-quality Web Worker cover downscaling
- **View Mode**: Optional category mode switcher (OFF by default; enable in Settings)

> **Stash Mini Player**, **Split Parts** (multi-part seamless playback), **Library Hub** (batch auto-organizer), **Tag Weighted Recommendations**, and **Manga Viewer** are available in the **Premium Edition**.

---

## Installation (3 Steps)

1. Extract this ZIP archive.
2. Copy all **plugin folders** (`suiteCore`, `serverStore`, `lightCards`, etc.) into your Stash `plugins` directory:
   - **Windows (default)**: `C:\Users\<Username>\.stash\plugins\`
   - **macOS / Linux (default)**: `~/.stash/plugins/`
   - **Docker**: Host folder mapped to `/root/.stash/plugins`
3. Open Stash, go to **Settings → Plugins → Reload Plugins**, then refresh the page (F5).

---

## First Steps After Install

1. Click the new **Settings (gear)** button in the top navigation bar.
   - Switch between 10 dark/glass themes, card layouts (Tall / Side / Cover), and 16 toggleable card metadata items with 1-click presets.
   - Toggle optional features such as View Mode (disabled by default) and auto-edit tab.

2. **Grid Player**: **Shift + Click** any scene card to play up to 9 videos simultaneously.

---

## Notes for macOS / Linux / Docker & International Users

- All browser-based plugins work out of the box on Windows, macOS, Linux, and Docker.


---

## Notes

- **5 Languages Supported**: English, 日本語 (Japanese), 繁體中文 (Traditional Chinese), 简体中文 (Simplified Chinese), and 한국어 (Korean). Automatically detects your browser language and can be switched anytime in **Settings → Language**.
- Settings are automatically synced to your Stash server via `Server Store`, so they persist across browsers and devices.
- Individual plugins can be toggled in **Settings → Plugins** (keep `Suite Core` and `Server Store` enabled as shared dependencies).
