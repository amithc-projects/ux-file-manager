# Product Requirements Document (PRD): Sidekick File Manager

## 1. Executive Summary
**Sidekick** is a local-first, browser-native file management interface engineered to execute professional-grade file operations directly within the client environment. By bypassing traditional full-stack backends and leveraging the **File System Access API**, Sidekick achieves extreme performance and complete data privacy, mutating files locally on the hard drive entirely through the browser sandbox.

## 2. Deployment Architectures
1. **Desktop Web App (Vite/React):** A standard Localhost implementation supporting fullscreen multi-panel layouts perfect for extensive UI layouts and split-pane previews.
2. **Chrome Extension (Manifest V3):** Configured specifically as a Chrome **Side Panel**. The extension injects the exact same interface directly alongside the user's primary browsing context, allowing true drag-and-drop file modifications concurrently with standard web reading.
3. **Web Component Integration:** Architecturally designed allowing the top-level container to compile into an internal Shadow DOM, behaving as a distributable native HTML `<sidekick-manager>` tag.

## 3. Core Functional Pillars

### 3.1 Unrestricted File System Access
- **Native Routing:** Reads massive data systems hierarchically generating live nested interfaces via `window.showDirectoryPicker`.
- **System Memory:** Mounts `IndexedDB` caching mechanics securing Folder Directory Handles persistently so that restarting the app or returning generates a highly aesthetic "Recent Workspaces" prompt, averting heavy authorization clicks upon return.
- **Recursive Generation:** Allow users to write full paths natively (e.g., `folder/sub/sub2`) dynamically cascading new Directory Handles internally into existence via the UI.

### 3.2 Viewports & Universal Renderers
- **Abstract Previews:** Employs an ultra-modern `FileViewer` rendering interface that structurally breaks down arbitrary File Extensions out of raw array streams without requiring backend processing:
  - Code Viewer: Casts `JS`, `TS`, `CSS`, and `TXT` neatly into syntax-blocked outputs.
  - JSON Viewer: Projects deep nested sidecar layers natively in a custom UI collapsing tree.
  - Markdown Viewers: Evaluates structural code mirroring heavily optimized dark-mode standard styling logic.
  - Media & PDFs: Native visual mounts intercept object URLs seamlessly.
  - HTML Sandbox: Uses precise `<iframe srcDoc>` boundaries to natively project source markup alongside evaluated sandboxed CSS states simultaneously.
  - ZIP Explorers: Mounts JSZip streams visually iterating archive arrays directly.

### 3.3 Silent Metadata Engine (Sidecars)
- **Pairing Engine:** Fuses primary assets (`adam-sandler.jpg`) to native localized JSON tracking files automatically. 
- **Atomic Migrations:** Deleting, moving, or dragging primary structural components automatically fires batch operations handling connected sub-meta documents simultaneously so that files are virtually unbreakable.

### 3.4 Advanced UX Matrix
- **Selection Sequences:** Replicates traditional OS paradigms intercepting `Shift`, `Alt`, and `Cmd/Ctrl` explicitly. Single clicks bypass arrays mapping individual resets elegantly.
- **Structural Folder Comparison:** Implements a localized Diff mechanism tracking overlapping hierarchical matrices to rapidly compare structural offsets between separate project directories.
- **Force Raw Text Evaluations:** Configured right-click Context hooks allowing OS level integrations like "Copy File Contents" (copying arbitrary chunks directly to system clipboards) and "View As Text," invoking extreme raw string parsing bounds capped at 500KB thresholds to prevent crash states.

## 4. Technical Constraints
- **Browser Compatibility:** Chrome, Edge, and Opera strictly. Chromium-specific environments are required as Apple’s Safari WebKit intrinsically blocks external File System modifications.
- **Component Stack:** Structured cleanly over React 18 & TailwindCSS.
- **Performance Limits:** Memory strictly clamped utilizing precise `.text()` slicing thresholds and tight `revokeObjectURL` triggers guaranteeing aggressive visual rendering speed.

## 5. Future Roadmap
Looking ahead, the following high-priority milestones are scoped to further expand Sidekick's deployability and embeddability across enterprise architectures:

1. **Standalone Web Component Bundling:** Formally detach the top-level React render sequence and wrap the entire application state into a single `.web` Custom Element (`<sidekick-manager>`) utilizing Shadow DOM logic to achieve impenetrable zero-leak CSS and robust agnosticism.
2. **Cross-Boundary Message Protocols:** Build and demonstrate event-driven architectures bridging the Chrome Extension wrapper layers with the internal Web Component directly. This will allow bi-directional telemetry (e.g., dispatching events outwards to let the Extension or any remote Host Web App securely know exactly which files are actively selected, moved, or deleted inside the file manager).
