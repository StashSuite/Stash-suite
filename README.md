# Stash Suite (Free Edition)

**English** | [日本語](./README_JA.md) | [繁體中文](./README_ZH_TW.md) | [简体中文](./README_ZH_CN.md) | [한국어](./README_KO.md)

A drop-in plugin suite that upgrades [StashApp](https://stashapp.cc/)'s browsing, playback, library organization, and reading experience — optimized for large **JAV, local video, and manga / doujinshi** collections.  
No external Python packages (`pip`) or extra servers required — just copy **1 folder (`stashSuite`)** into your Stash `plugins` directory.

- **5 Languages Built-in**: English, 日本語 (Japanese), 繁體中文 (Traditional Chinese), 简体中文 (Simplified Chinese), 한국어 (Korean)
- **Cross-platform**: Windows, macOS, Linux, and Docker

![Before and After: Default Stash vs Stash Suite](./docs/images/00_compare_grid_before_after.jpg)

![Stash Suite Live Demo](./docs/images/demo_preview.gif)

*All videos, comics, and portraits shown in screenshots and demos are sample media for demonstration only. No media files are included.*

---

## Screenshots

| Overview (Free + Premium) | Stash Mini Player (Premium) |
| :---: | :---: |
| ![Overview](./docs/images/01_overview.jpg) | ![Mini Player](./docs/images/02_mini_player.jpg) |

| Performer Drawer & Face Strip (Free) | 9-Screen Grid Player (Free) |
| :---: | :---: |
| ![Performer Drawer](./docs/images/04_performer_drawer.jpg) | ![Grid Player](./docs/images/07_grid_player.jpg) |

| Manga Viewer (Premium) | Library Hub — Batch Organizer (Premium) |
| :---: | :---: |
| ![Manga Viewer](./docs/images/05_manga_viewer.jpg) | ![Library Hub](./docs/images/08_library_hub.jpg) |

| Unified Settings (5 Languages & 10 Themes) |
| :---: |
| ![Unified Settings](./docs/images/03_settings.jpg) |

> **Instant Inline Playback**: Compare Default Stash vs. Stash Mini Player  
> ![Before and After Player](./docs/images/00_compare_player_before_after.jpg)

---

## Included Modules in Free Edition (All-in-One `stashSuite` Folder)

All 11 Free modules are bundled into a single **`stashSuite`** plugin folder for effortless installation:

- **Suite Core**: Shared foundation, 10 dark/glass themes (default: Midnight), unified tabbed settings panel, direct external media player launch
- **Server Store**: Automatically syncs plugin settings to your Stash server across browsers and devices
- **Quick Genres**: 1-click sort bar, open-history drawer, favorite boards, performer face strip, and enhanced Performer Drawer (photo-first filter, alias search, inline rating, random pick)
- **Light Scene Cards**: Custom scene cards built for smooth browsing even at 100–500 items/page with zero extra per-card API requests (Tall / Side / Cover layouts, 16 customizable fields, **direct source digest hover preview with no pre-generation required** by default)
- **Scene Card Rarity**: Click-to-open performer cards & performer rating highlight (optional scene card glow effects with 6 themes — OFF by default, toggle anytime in Settings)
- **Grid Player**: `Shift + Click` scene cards to play up to 9 videos simultaneously (with Smooth mode & fullscreen)
- **Click Popovers**: Changes card hover popovers to click-to-open
- **Search History**: Recent search dropdown in the search box
- **Auto Backup**: Automatic Stash database backup every 7 days
- **Sharp Covers**: High-quality Web Worker cover downscaling
- **View Mode**: Optional category mode switcher (OFF by default; enable in Settings)

---

## Free vs. Premium Edition

| Feature | Free Edition | Premium Edition |
| :--- | :---: | :---: |
| 10 Themes, Unified Settings & 5 Languages (`Suite Core`) | ✅ | ✅ |
| Server-side Settings Sync & 7-Day Auto DB Backup | ✅ | ✅ |
| Custom Scene Cards (Zero Extra API Calls), Sharp Covers & Rarity Effects | ✅ | ✅ |
| Quick Genres (Face Strip, Favorite Boards, Performer Drawer) | ✅ | ✅ |
| 9-Screen `Grid Player`, Search History & Click Popovers | ✅ | ✅ |
| **Stash Mini Player** (Instant inline playback, rating, tagging, scraping & Watch Later) | — | ✅ |
| **Split Parts** (Auto-group `-A/-B`, `_1/_2` multi-part videos & seamless playback) | — | ✅ |
| **Library Hub** (Completion dashboard & safe 5-step batch auto-organizer with rollback) | — | ✅ |
| **Tag Weighted Recommendations** (Smart sort by tag weights + performers + unwatched boost) | — | ✅ |
| **Manga Viewer** (Dedicated RTL / double-page spread / inertial scroll / wall viewer) | — | ✅ |

> **Get Premium Edition**: [BOOTH (Japan / International)](https://booth.pm/ja/items/9209264) *(Payhip global storefront coming soon)*  
> **Updates & News**: [Official X (@stashsuite)](https://x.com/stashsuite)  
> Upgrading from Free to Premium is seamless: simply overwrite the plugin folders with the Premium Edition files. All settings stored via `Server Store` are automatically preserved.

---

## Installation (3 Steps)

1. Download the latest release ZIP (or click **Code → Download ZIP** on this repository) and extract it.
2. Copy the **`stashSuite`** folder into your Stash `plugins` directory *(Premium Edition uses 3 folders: `stashSuite`, `libraryHub`, `splitParts`)*:
   - **Windows (default)**: `C:\Users\<Username>\.stash\plugins\`
   - **macOS / Linux (default)**: `~/.stash/plugins/`
   - **Docker**: Host folder mapped to `/root/.stash/plugins`
   - *(You can check your `plugins` path in Stash under **Settings → System** or `config.yml`.)*
3. Open Stash, go to **Settings → Plugins → Reload Plugins**, then refresh the page (`F5`).

> **Upgrading from an older multi-folder version?** Delete the old individual folders (`suiteCore`, `serverStore`, `lightCards`, `quickGenres`, etc.) from `plugins` before copying `stashSuite`. Your saved settings are automatically migrated.

---

## First Steps After Install

1. Click the new **Settings (gear)** button in the top navigation bar.
   - Switch between 10 themes, 5 languages, card layouts (Tall / Side / Cover), and 16 toggleable card metadata items in real time.
2. **Grid Player**: `Shift + Click` any scene card to open up to 9 simultaneous playback windows.

---

## FAQ & Notes

- **Where are settings saved?**  
  `Server Store` saves your settings directly to your Stash server, so they persist across browsers and devices.
- **Can I toggle individual features?**  
  Yes — open the **Settings (gear)** button in the top navigation bar to toggle Light Scene Cards, hover preview mode, Card Rarity glow, Grid Player, Actress Panel, View Mode, and more in real time.
- **License**  
  Personal use only. Redistribution or re-uploading is prohibited. See [LICENSE.txt](./LICENSE.txt) and [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt) for details.
