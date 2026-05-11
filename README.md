# Sidekick File Manager

Sidekick is a local-first, browser-native file manager that ships as a **distributable web component** (`<sidekick-manager>`). Built with React 18, TailwindCSS, and the File System Access API — no backend required.

---

## Quick Start (Standalone Dev App)

```bash
npm install
npm run dev
```

Open the local URL, click **Select Local Directory**, and grant browser permissions.

---

## Building the Web Component Bundle

```bash
npm run build
```

Output: `dist/sidekick-manager.iife.js` — a single self-contained IIFE that registers the `<sidekick-manager>` custom element.

---

## Embedding in a Host App

```html
<script src="/sidekick-manager.iife.js"></script>
<sidekick-manager style="display:block; width:100%; height:100%;"></sidekick-manager>
```

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for the full API reference.

---

## Features

### File Management
- Open any local directory via the File System Access API
- Grid, List, and Filmstrip view modes
- Multi-select with Shift / Cmd / Ctrl click
- Sort by name, type, date, size (ascending/descending)
- Group by type (Images, Videos, Documents, etc.)
- Type filter buttons (All / Images / Video / Audio / Documents / Other)
- Filter / fuzzy search across filenames and sidecar metadata content
- Context menu: Copy, Delete, Move, Add to Collection, Bookmark Folder
- Folder diff — compare two directories side by side
- ZIP export of selected files or entire collection

### Previews & Thumbnails
- Images: inline thumbnail grid + full-screen lightbox / slideshow
- Video: automatic first-frame thumbnail extraction, persisted as `.{name}.thumbnail.jpg` alongside the source file so subsequent opens are instant
- Audio: detected by extension (mp3, wav, ogg, m4a, flac, aac) with music-note icon
- Filmstrip view: large viewer panel + horizontal scrolling thumbnail strip
- Side-by-side file compare (`two-file` mode)
- Transform compare mode (`transform`) — for host apps that supply a render callback

### Sidecar Metadata
- Sidecar files use dot-prefix format: `.{filename}`
- Automatically paired during directory scan
- Delete / copy / move operations include the paired sidecar
- Sidecar content shown in the Properties panel and included in search

### Collection & Bookmarks
- **Collection**: virtual cross-folder item basket — add items via right-click from any folder, view them as a grid in the main window (with a "virtual view" banner distinguishing it from real filesystem folders), then ZIP / copy / move the batch
- **Bookmarks**: persist frequently-used folder shortcuts via IndexedDB; one-click to jump back
- Both accessible from icon buttons in the top bar

### Properties Panel
- Shows Kind, Size, Modified date, and raw sidecar metadata for the selected item
- Can be hidden in host apps that supply their own metadata UI via the `hide-inspector` attribute

### Navigation
- Clickable breadcrumb path
- Child-folder quick-jump dropdown (chevron next to folder name)
- Recent workspaces persisted in IndexedDB
- `..` folder entry to navigate up
- Deep-link via URL hash (disabled when `no-hash-routing` is set)

---

## Architecture

| Layer | Technology |
|---|---|
| UI framework | React 18 |
| Styling | TailwindCSS (injected into shadow DOM) |
| Icons | Lucide React |
| Archiving | JSZip |
| Persistent storage | idb-keyval (IndexedDB) |
| Build / bundle | Vite (IIFE library mode) |
| Web component | Native `HTMLElement` + `ReactDOM.createRoot` into shadow root |

---

## Browser Support

Requires a **Chromium-based browser** (Chrome 86+, Edge, Opera). The writable File System Access API is not supported in Firefox or Safari.

---

## Privacy

Everything runs locally in the browser sandbox. No files are uploaded. No analytics. No backend.
