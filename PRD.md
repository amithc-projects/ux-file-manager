# Product Requirements Document (PRD): Sidekick File Manager

## 1. Executive Summary
**Sidekick** is a local-first, browser-native file management interface. It leverages the File System Access API to provide a professional-grade file browsing experience (similar to macOS Finder or Windows Explorer) while introducing specialized logic for **Silent Sidecar Pairing**.

## 2. Target Environments
1.  **Browser-Based PWA:** A standalone web application for processing local project folders.
2.  **Chrome Extension:** A sidepanel-based utility that allows users to manage files while browsing other sites.

## 3. Functional Requirements

### 3.1 File System Interaction
- **FR-01: Directory Picking:** Users must be able to select a local folder via `window.showDirectoryPicker()`.
- **FR-02: Persistent Access:** (Extension Only) Use `indexedDB` to store file handles so permissions can be re-requested or remembered across sessions.
- **FR-03: CRUD Operations:** Support for Rename, Delete, and Copy/Move.
- **FR-04: Atomic Pairing:** If a file is deleted, its associated sidecar MUST be deleted simultaneously.

### 3.2 Sidecar Logic (The "Silent Partner")
- **SR-01: Pattern Matching:** Automatically pair `[filename].[ext]` with `.[prefix][filename].[ext]` (e.g., `image.jpg` + `.meta_image.jpg`).
- **SR-02: Hidden by Default:** Sidecars should be filtered out of the main UI view unless a "Show Hidden Files" toggle is active.
- **SR-03: Metadata Extraction:** Read the content of sidecars (JSON or Text) to populate the UI "Inspector" panel.

### 3.3 Search & Discovery
- **DR-01: Indexing:** On folder load, the app must parse all sidecars and index their text content.
- **DR-02: Hybrid Search:** Search queries must return results matching the filename OR the content found inside the sidecar.
- **DR-03: Thumbnails:** Generate lazy-loaded previews using `URL.createObjectURL()`.

### 3.4 Action Delegate System
- **AR-01: Parent Callback:** The UI component must emit events containing an array of `FileSystemHandle` pairs.
- **AR-02: Environment-Specific Actions:** - *Extension:* "Generate ZIP", "Export to Cloud".
    - *Web App:* "Batch Rename", "Metadata Edit".

## 4. Technical Constraints
- **Browser Compatibility:** Chromium-based browsers only (v86+).
- **Memory Management:** For "hundreds of files," memory usage must be optimized by revoking Object URLs and using virtualized lists.
