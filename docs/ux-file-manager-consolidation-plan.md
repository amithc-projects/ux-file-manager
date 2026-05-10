# Plan: Unified File Manager (ux-file-manager)

## Context

Three codebases: **ux-file-manager** (source of `<sidekick-manager>` web component, React + TypeScript + Tailwind), **cx-tab-recorder-plus** (consumes compiled IIFE), **pic-machina** (own `media-browser.js`, vanilla JS).

**Goal:** Enhance ux-file-manager so it is a full superset of pic-machina's MediaBrowser. Replace media-browser.js in pic-machina with the shared component. cx-tab-recorder-plus continues unchanged.

**Guiding principle:** Pic-machina's implementation is the model for almost all UI/UX decisions. ux-file-manager's existing features (bookmarks, zip export, copy/paste, web worker search) are additive and remain.

---

## Architectural Decisions (locked)

| Topic | Decision |
|---|---|
| **Filmstrip view** | Port pic-machina's filmstrip (large viewer + scrolling strip + active tracking + scroll persistence) into ux-file-manager as the canonical implementation |
| **Compare: two-file** | Keep ux-file-manager's existing CompareModal for side-by-side file comparison (cx-tab-recorder-plus use case) |
| **Compare: transform** | Add a second compare mode (`compareMode='transform'`) using the ImageWorkspace callback pattern: `onCompareRender`, `onCompareInfo`, `customControlsHtml`, `onBindCustomControls` — for ned and bld |
| **Video scrubber** | Scrubber UI stays in host screens (ned.js/bld.js); ux-file-manager exposes `triggerProcess()` on its compare workspace so the host can call it when scrub position changes |
| **Sidecar format** | Switch to `.filename` prefix (ux-file-manager's existing format). pic-machina migrates existing `filename.json` → `.filename` via a one-time rename script. File operations (delete, copy, move) must also act on the paired sidecar |
| **Sidecar schema migration** | Stays in pic-machina; applied after receiving sidecar data |
| **All other UI models** | Pic-machina is the reference: selection, breadcrumbs, grid, list, tooltips, filters, sort, lightbox, audio/video types, keyboard nav |

---

## Full Feature Map

### What gets ADDED to ux-file-manager

| Feature | Detail | Used by | Status |
|---|---|---|---|
| Filmstrip view | Large viewer + scrolling thumbnail strip + active tracking + keyboard nav + scroll persistence | fld, cx-tab | ✅ Done |
| Transform compare mode | `compareMode='transform'` prop + `onCompareRender`/`onCompareInfo`/`customControlsHtml`/`onBindCustomControls` callbacks + `triggerProcess()` exposed on compare workspace | ned, bld | ⏳ Pending |
| Child folder dropdown | Quick-jump to immediate subfolders | fld, set | ⏳ Pending |
| Hidden files warning banner | Optional `hiddenFilesCount` + `hiddenFilesMessage` props; only activated in ned/bld context | ned, bld | ✅ Done |
| Type filter buttons | Optional alternative to grouping: show image/video/audio/doc/archive/other filter buttons with counts; hidden when count=0 | fld, set, cx-tab | ⏳ Pending |
| Custom sort function | `customSort` property (fn); runs after built-in sort | set (ordered recipe) + all | ✅ Done |
| Sidecar JSON search | Optional: when enabled, search also matches within sidecar JSON content | fld | ⏳ Pending |
| Dimension tooltip | Show image/video width × height on hover (lazy-loaded) | all | ⏳ Pending |
| Video thumbnail extraction | Async first-frame extraction → saved preview; play badge overlay | fld, set, bld, ned | ⏳ Pending |
| GlobalLightbox on double-click | Host provides callback; component fires it with `(entry, index, filteredList)` | fld, set, bld (non-compare) | ✅ Done (`onDoubleClick` on element) |
| Audio file type support | 6 formats (mp3/wav/ogg/m4a/flac/aac) with music icon | fld, cx-tab | ✅ Done |
| Sidecar-aware file ops | Delete/copy/move also acts on `.filename` sidecar | all | ✅ Done |
| `.filename` sidecar format | Read/write sidecar as `.filename` prefix (already ux-file-manager's format) | all | ✅ Done |
| `sidekick:file-focus` event | Fires when single file selected; includes `{ filename, handle, metadata, size, lastModified }` | fld (for EXIF panel) | ✅ Done |
| `triggerProcess()` API | Exposed on compare workspace for host to call when video seek time changes | ned, bld | ✅ Stub done; needs wiring to TransformCompareView |

### What stays in pic-machina (not moved into shared component)

| Item | Reason |
|---|---|
| Sidecar schema migration (`migrateSidecar()`) | pic-machina-specific versioned schema; applied by host on receipt |
| EXIF / vision panel (`sidecar-drawer.js`, `asset-panel.js`) | Too pic-machina-specific; host listens to `sidekick:file-focus` event and renders its own panel |
| Video scrubber UI | Mounted by ned.js/bld.js; calls `triggerProcess()` on the component |
| GlobalLightbox implementation | Stays in pic-machina; passed as `onDoubleClick` callback |
| Transform execution logic in `onCompareRender` | Stays in ned.js/bld.js; passed as callback |

### What ux-file-manager already has (keep, no changes needed)

Bookmarks, recent workspaces, zip export, copy/paste/move, collection basket, folder diff, slideshow, web worker fuzzy search, shadow DOM CSS isolation.

---

## Implementation Phases

### Phase 0 — Sidecar format migration (pic-machina) ✅ COMPLETE

**PR:** https://github.com/amithc-projects/pic-machina/pull/58

Migrate pic-machina's existing sidecar files on disk.

**Files changed:**
- `app/src/data/sidecar.js` — `readSidecar()` tries `.filename` first, falls back to `filename.json`; `writeSidecar()` always writes `.filename`; `listSidecarTags()` scans both formats
- `app/src/data/sidecarMigrate.js` _(new)_ — `migrateSidecarFiles(dirHandle)` renames `filename.json` → `.filename`, idempotent
- `app/src/screens/fld.js` — calls `migrateSidecarFiles()` on every folder load (no-op after first run)

---

### Phase 1 — Core ux-file-manager enhancements

**PR:** https://github.com/amithc-projects/ux-file-manager/pull/1

All changes in `ux-file-manager/src/`.

#### 1A. Filmstrip view ✅ COMPLETE

**File:** `src/ui/components/FilmstripView.tsx` _(new)_

- Large viewer panel + horizontal scroll strip
- Active item tracking, scroll persistence via ref
- Keyboard nav: Left/Right arrows change active file, Enter invokes double-click
- Integrated into App.tsx as fourth view mode (grid / **filmstrip** / gallery / list)
- Toolbar button: Play icon

#### 1B. Transform compare mode ⏳ PENDING

**File:** `src/ui/components/TransformCompareView.tsx` _(new)_

- Activated by `compareMode='transform'` attribute on `<sidekick-manager>`
- Renders: filmstrip strip at bottom for file selection + viewer area at top (before/after slider)
- Props/callbacks passed imperatively on the element:
  - `compareRender: async (file) => { beforeUrl, afterUrl }` — renders the before/after images
  - `compareInfo: async (file) => void` — info button handler
  - `compareControls: string` — optional custom toolbar HTML
  - `compareBindControls: (container) => void` — wires custom toolbar controls
- `triggerProcess()` on the element calls into this view to re-run `compareRender` on the current file

#### 1C. Child folder dropdown ⏳ PENDING

**File:** `src/apps/web/App.tsx` (breadcrumb area)

- Button in breadcrumb showing immediate child folders of the current directory
- Click navigates into the selected subfolder
- Populated from `ScannerService.scanDirectory()` folders list

#### 1D. Hidden files warning banner ✅ COMPLETE

**File:** `src/ui/components/HiddenFilesWarning.tsx` _(new)_

- Orange warning banner rendered at top of main content area
- Driven by `hidden-files-count` and `hidden-files-message` HTML attributes on `<sidekick-manager>`
- `attributeChangedCallback` triggers re-render automatically

#### 1E. Type filter buttons ⏳ PENDING

**File:** `src/ui/components/TypeFilters.tsx` _(new)_, `src/apps/web/App.tsx`

- Alternative to group-by; controlled by `filter-mode='buttons'` attribute
- Buttons: All / Images / Video / Audio / Documents / Archives / Other
- Each button shows a count badge; hidden when count = 0
- Selecting a type filters the file list to that type only

#### 1F. Custom sort function ✅ COMPLETE

**File:** `src/apps/web/App.tsx`, `src/main.tsx`

- `element.customSort = (a, b) => number` imperative property
- Applied after built-in sort in `processedGroups` useMemo
- Setter triggers React re-render so the new comparator is picked up immediately

#### 1G. Sidecar JSON search ⏳ PENDING

**File:** `src/apps/web/App.tsx`

- When `sidecar-search` attribute is present on `<sidekick-manager>`, search also matches against `JSON.stringify(pair.metadata)`
- Implemented by including a `metadataText` field in the searchable item list alongside the filename

#### 1H. Dimension tooltip ⏳ PENDING

**File:** `src/apps/web/App.tsx` (tooltip logic)

- When hovering an image/video file, lazy-load its natural dimensions
- Images: `new Image()` → `naturalWidth/naturalHeight` via blob URL
- Videos: `<video>` metadata load → `videoWidth/videoHeight`
- Displayed in the existing tooltip alongside name/size/date
- Debounced to avoid blocking on fast hover traversal

#### 1I. Video thumbnail extraction ⏳ PENDING

**Files:** `src/core/services/ThumbnailService.ts` _(new)_, `src/ui/components/FileGrid.tsx`, `src/ui/components/FilmstripView.tsx`

- Async first-frame extraction via `<video>` + canvas `drawImage`
- Cached in memory (keyed by file handle name + lastModified)
- Play badge overlay rendered on video items in all views
- Runs in background; updates thumbnails progressively as they complete

#### 1J. Audio file type support ✅ COMPLETE

**Files:** `src/ui/components/FileGrid.tsx`, `src/ui/components/FilmstripView.tsx`, `src/ui/components/GalleryView.tsx`

- Detect mp3/wav/ogg/m4a/flac/aac extensions
- Music icon (purple) in all views
- Also broadened image regex (heic/tiff) and video regex (avi/mkv)

#### 1K. Sidecar-aware file operations ✅ COMPLETE

**File:** `src/apps/web/App.tsx`

- Delete: removes `.filename` sidecar if present (was already implemented)
- Paste clipboard: writes sidecar as `.filename` dot-prefix (fixed from legacy `.json` suffix)
- Collection copy: uses existing sidecar handle name (correct)

#### 1L. `sidekick:file-focus` event ✅ COMPLETE

**File:** `src/apps/web/App.tsx`

- Dispatched when selection changes to exactly one file
- Detail: `{ filename, handle, metadata, size, lastModified }`
- Dispatched with `detail: null` when selection clears or becomes multi-file

#### 1M. `triggerProcess()` web component API ✅ STUB COMPLETE

**File:** `src/main.tsx`

- `element.triggerProcess()` is exposed; currently a stub
- Will be wired to `TransformCompareView` when Phase 1B is implemented

---

### Phase 2 — Build & distribute ✅ COMPLETE

```bash
cd ux-file-manager && npm run build
cp dist/sidekick-manager.iife.js ../cx-tab-recorder-plus/vendor/sidekick-manager.iife.js
```

cx-tab-recorder-plus continues to work with no breaking API changes.

---

### Phase 3 — Migrate pic-machina screens ⏳ PENDING

Tackle one screen at a time; keep `media-browser.js` in place until all four are migrated.
**Prerequisite:** Phase 1B (transform compare mode) must be complete before 3C and 3D.

#### 3A. fld.js ⏳ PENDING _(most complex — filmstrip, sidecar, lightbox, download/delete)_

- Replace `new MediaBrowser(...)` with `<sidekick-manager>`
- Set `filter-mode="buttons"` and `sidecar-search` attributes
- Wire `sidekick:selection` → selection state
- Wire `sidekick:file-focus` → `metaPanel.setFile(file, metadata)`
- Wire `sidekick:workspace` → breadcrumb state tracking
- Set `element.onDoubleClick` → GlobalLightbox
- Set `element.customSort` → existing custom sort logic
- Pass `onDownloadSelected`, `onDeleteSelected` via events/callbacks

#### 3B. set.js ⏳ PENDING _(ordered selection, hidden files)_

- Replace `new MediaBrowser(...)` with `<sidekick-manager>`
- Set `isOrderedSelection` → ordered selection display (numbered badges)
- Set `hidden-files-count` + `hidden-files-message` attributes
- Wire `sidekick:selection` → slot assignment + run button validation

#### 3C. ned.js ⏳ PENDING _(transform compare, video scrubber, sidecar context)_

- Replace `new MediaBrowser(...)` with `<sidekick-manager compareMode="transform">`
- Set `element.compareRender` = async fn that calls ned's transform pipeline
- Set `element.compareInfo` = async fn for info panel
- Mount video scrubber in host; call `element.triggerProcess()` on seek

#### 3D. bld.js ⏳ PENDING _(transform compare + custom toolbar)_

- Replace `new MediaBrowser(...)` with `<sidekick-manager compareMode="transform">`
- Set `element.compareControls` = HTML string for "Original / Prev Step" toolbar
- Set `element.compareBindControls` = fn to wire toolbar clicks → bld state + `triggerProcess()`
- Set `element.compareRender`, `element.compareInfo` callbacks

---

## Web Component API Surface

### Attributes (strings/presence)

| Attribute | Values | Status |
|---|---|---|
| `hidden-files-count` | number string | ✅ Implemented |
| `hidden-files-message` | string | ✅ Implemented |
| `filter-mode` | `groups` (default) \| `buttons` | ⏳ Pending |
| `compare-mode` | `two-file` (default) \| `transform` | ⏳ Pending |
| `sidecar-search` | presence flag | ⏳ Pending |

### Properties (set imperatively on the element)

| Property | Type | Status |
|---|---|---|
| `customSort` | `(a, b) => number \| null` | ✅ Implemented |
| `onDoubleClick` | `(entry, index, filtered[]) => void` | ✅ Property declared; needs wiring in App |
| `compareRender` | `async (file) => { beforeUrl, afterUrl }` | ⏳ Pending (Phase 1B) |
| `compareInfo` | `async (file) => void` | ⏳ Pending (Phase 1B) |
| `compareControls` | `string` | ⏳ Pending (Phase 1B) |
| `compareBindControls` | `(container) => void` | ⏳ Pending (Phase 1B) |

### Methods

| Method | Status |
|---|---|
| `navigate(path, options)` | ✅ Existing |
| `setRoot(handle)` | ✅ Existing |
| `triggerProcess()` | ✅ Stub; needs wiring (Phase 1B) |

### Events

| Event | Detail | Status |
|---|---|---|
| `sidekick:ready` | `{ version }` | ✅ Existing |
| `sidekick:workspace` | `{ folderName, pathLength }` | ✅ Existing |
| `sidekick:selection` | `{ items: string[] }` | ✅ Existing |
| `sidekick:action` | `{ action, target }` | ✅ Existing |
| `sidekick:error` | `{ code, message }` | ✅ Existing |
| `sidekick:file-focus` | `{ filename, handle, metadata, size, lastModified }` \| null | ✅ Implemented |

---

## Critical Files

**ux-file-manager (changes):**
- `src/main.tsx` — attributes, properties, events, `triggerProcess()`
- `src/apps/web/App.tsx` — filter mode, custom sort, sidecar search, file-focus dispatch, compare mode routing
- `src/ui/components/FilmstripView.tsx` ✅ — filmstrip view
- `src/ui/components/TransformCompareView.tsx` ⏳ — transform compare (Phase 1B)
- `src/ui/components/TypeFilters.tsx` ⏳ — type filter buttons (Phase 1E)
- `src/ui/components/HiddenFilesWarning.tsx` ✅ — hidden files banner
- `src/core/services/ScannerService.ts` — child folders, sidecar-aware ops
- `src/core/services/ThumbnailService.ts` ⏳ — video thumbnail extraction (Phase 1I)

**pic-machina (Phase 0 — complete):**
- `app/src/data/sidecar.js` ✅
- `app/src/data/sidecarMigrate.js` ✅
- `app/src/screens/fld.js` ✅

**pic-machina (Phase 3 — pending):**
- `app/src/screens/fld.js`, `set.js`, `ned.js`, `bld.js`

---

## Open Questions Resolved

| Question | Resolution |
|---|---|
| Compare modal confusion | Two distinct modes: `two-file` (existing CompareModal, keeps) and `transform` (new, ImageWorkspace-style callbacks) |
| Video scrubber | Not a two-video sync problem — it's a seek-to-frame + re-run-transform loop. Scrubber stays in host; `triggerProcess()` is the bridge |
| Sidecar format | `.filename` prefix wins; pic-machina migrates on-disk files via one-time rename script |
| Sidecar schema migration | Stays in pic-machina; host applies it after receiving data via `sidekick:file-focus` |
| EXIF/vision panel | Slot/event pattern; pic-machina listens to `sidekick:file-focus` |
