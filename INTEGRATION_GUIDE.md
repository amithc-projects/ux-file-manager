# Sidekick Web Component — Integration Guide

Embed `<sidekick-manager>` into any HTML page, SPA, or browser extension. The component uses Shadow DOM, so its React app and Tailwind styles are fully isolated — it will not interfere with your host application's CSS, and vice versa.

---

## 1. Installation

Copy the compiled bundle into your project and load it with a `<script>` tag:

```html
<script src="/path/to/sidekick-manager.iife.js"></script>
```

Then place the element wherever you want the file manager to mount. It fills `100%` of its parent container:

```html
<main style="width: 100vw; height: 100vh;">
  <sidekick-manager></sidekick-manager>
</main>
```

---

## 2. HTML Attributes

Attributes are observed — changing them after mount triggers a re-render.

| Attribute | Type | Default | Description |
|---|---|---|---|
| `no-hash-routing` | boolean (presence) | off | Prevents sidekick from reading or writing `window.location.hash`. **Required** when the host app uses the hash for its own routing (e.g. `#fld`, `#set`) — otherwise sidekick treats the hash as a subfolder deep-link and clears it on failure, which fires the host router. |
| `hide-inspector` | boolean (presence) | off | Hides the right-side Properties panel. Use when your host app provides its own metadata UI driven by `sidekick:file-focus`. |
| `hidden-files-count` | string (number) | `"0"` | When > 0, shows an orange warning banner. Set this when you have filtered files out before passing a directory to sidekick. |
| `hidden-files-message` | string | — | Custom message text for the hidden files banner, e.g. `"3 files hidden — this recipe only accepts Images."` |
| `compare-mode` | `two-file` \| `transform` | `two-file` | `two-file` shows a side-by-side compare modal for two selected files. `transform` activates the ImageWorkspace-style callback compare used by processing screens. |

---

## 3. Imperative Properties

Set these as JavaScript properties on the element *after* it is in the DOM:

```javascript
const sk = document.querySelector('sidekick-manager');
```

| Property | Type | Description |
|---|---|---|
| `customSort` | `(a: GridItem, b: GridItem) => number \| null` | Custom sort function applied after the built-in sort. Return `null` to disable. |
| `onDoubleClick` | `(entry, index, filteredList) => void` | Called when a file is double-clicked. Receives the item, its index in the filtered list, and the full filtered list — use to open a host lightbox. |
| `compareRender` | `async (file: File) => { beforeUrl, afterUrl, beforeLabel?, afterLabel? }` | Required for `compare-mode="transform"`. Returns object URLs for before/after preview. |
| `compareInfo` | `async (file: File) => void` | Optional info-button callback in transform compare. |
| `compareControls` | `string` | HTML string for a custom toolbar rendered inside the transform compare view. |
| `compareBindControls` | `(container: HTMLDivElement) => void` | Called once the custom controls HTML is inserted into the DOM — wire up event listeners here. |

---

## 4. Methods

```javascript
const sk = document.querySelector('sidekick-manager');
```

| Method | Description |
|---|---|
| `sk.setRoot(handle)` | Programmatically open a `FileSystemDirectoryHandle` as the root workspace. |
| `sk.navigate(path, options?)` | Navigate to a subfolder path. `options`: `{ filename?, viewMode?, sortBy?, sortAsc? }` |
| `sk.getDirectoryHandle()` | Returns the current `FileSystemDirectoryHandle`, or `null` if no folder is open. Useful for host apps that need to enumerate or write files in the active folder. |
| `sk.triggerProcess()` | Re-runs `compareRender` on the currently active file. Call this from a video scrubber when the seek position changes. |

---

## 5. Events

All events bubble from the element as standard `CustomEvent`s; payload is in `event.detail`.

```javascript
sk.addEventListener('sidekick:selection', (e) => {
  console.log('selected files:', e.detail.items);
});
```

| Event | `event.detail` | When it fires |
|---|---|---|
| `sidekick:ready` | `{ version: '1.0' }` | React app has mounted and is ready |
| `sidekick:workspace` | `{ folderName, pathLength }` | User navigates into or out of a folder |
| `sidekick:selection` | `{ items: string[] }` | Selection changes — ordered array of selected filenames |
| `sidekick:file-focus` | `{ filename, handle, metadata, size, lastModified }` or `null` | Exactly one file is selected (or selection clears). Use to drive a host metadata panel. |
| `sidekick:action` | `{ action, target }` | A file operation completes (copy, delete, etc.) |
| `sidekick:error` | `{ code, message }` | A file operation or FSA permission request fails |

---

## 6. Sidecar Format

Sidecars use dot-prefix + `.json` extension, in the same directory as the source file:

```
my-video.mp4
.my-video.mp4.json           ← sidecar (JSON metadata)
.my-video.mp4.thumbnail.jpg  ← persisted video thumbnail (auto-generated)
```

Sidecars are JSON objects. Content is surfaced in the Properties panel and included in the search index when fuzzy-searching.

File operations (delete, copy, move) automatically include the paired sidecar.

---

## 7. Full Example — pic-machina fld.js pattern

```javascript
// Mount
main.innerHTML = `<sidekick-manager id="sk" no-hash-routing hide-inspector
  style="display:block;width:100%;height:100%"></sidekick-manager>`;
const sk = main.querySelector('#sk');

// Open folder on ready
sk.addEventListener('sidekick:ready', () => {
  sk.setRoot(myDirectoryHandle);
});

// Track current folder (for writing files, etc.)
let currentHandle = null;
sk.addEventListener('sidekick:workspace', () => {
  currentHandle = sk.getDirectoryHandle();
});

// Drive host metadata panel from single-file selection
sk.addEventListener('sidekick:file-focus', (e) => {
  if (e.detail) {
    metaPanel.setFile(e.detail.filename, e.detail.handle, e.detail.metadata);
  } else {
    metaPanel.clear();
  }
});

// React to selection for batch operations
sk.addEventListener('sidekick:selection', (e) => {
  runButton.disabled = e.detail.items.length === 0;
});
```
