# Implementation Plan: Sidekick File Manager (v2)

## Phase 1: Core Architecture & Data Modeling
### Objective: Define the "FilePair" primitive and the Scanning engine.
- [ ] Define TypeScript interface for `FilePair` (Main Handle + Sidecar Handle).
- [ ] Implement `ScannerService`:
    - Recursive directory walk.
    - Regex-based pairing logic.
    - Sidecar detection.
- [ ] Implement `StorageService`:
    - IndexedDB integration for handle persistence (essential for Chrome Extensions).

## Phase 2: Search & Indexing Engine
### Objective: Enable high-speed metadata search.
- [ ] Integrate **Fuse.js** or **FlexSearch**.
- [ ] Create `IndexingWorker`:
    - Offload sidecar reading (text/JSON) to a Web Worker to prevent UI jank.
    - Build the search index in memory.

## Phase 3: Reusable UI Component Library
### Objective: Create the "Finder-like" interface as a standalone module.
- [ ] **FileGrid / ListView:** Responsive container with Tailwind CSS.
- [ ] **Thumbnail Engine:** Intersection Observer-based `createObjectURL` generation.
- [ ] **Inspector Panel:** A slide-out panel to view and edit sidecar metadata.
- [ ] **Selection Engine:** Support for Shift+Click / Cmd+Click multi-select.
- [ ] **Action Interface:** Expose a standard callback API (e.g., `onExecuteAction(handles[])`).

## Phase 4: Reference App A - Web (PWA)
### Objective: Demonstrate re-use in a standard browser environment.
- [ ] **Layout:** Full-screen dashboard.
- [ ] **Integration:** Import the Core UI Component.
- [ ] **Action Implementation:** "Batch Metadata Update" — read selected sidecars and bulk-write new JSON values to the local file system.
- [ ] **Deployment:** Configure as a Vite-based Single Page Application.

## Phase 5: Reference App B - Chrome Extension
### Objective: Demonstrate re-use in a Manifest V3 environment.
- [ ] **Manifest:** Define `side_panel` and `permissions: ["storage", "fileSystem"]`.
- [ ] **Integration:** Import the exact same Core UI Component used in Phase 4.
- [ ] **Action Implementation:** "Package for Transfer" — Use `JSZip` to bundle selected main files and their paired sidecars into a .zip file for download.
- [ ] **Bridge:** Implement messaging between the Sidepanel UI and the Background Service Worker for heavy processing.

## Phase 6: Testing & Optimization
- [ ] **Boundary Check:** Verify that updating the Core UI automatically reflects in both the Web App and the Extension.
- [ ] **Memory Audit:** Ensure Object URLs are revoked when components unmount.
