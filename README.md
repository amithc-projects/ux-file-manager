# Sidekick File Manager

Sidekick is a local-first, browser-native file management interface designed to deliver professional-grade curation and file-browsing exclusively through the browser. 

Leveraging the **File System Access API**, Sidekick bypasses the need for local desktop electron bundles, providing deeply native file handling (read, write, delete, move, archive) entirely on the front end.

## Features

- **Master-Detail Gallery Engine:** Dynamically splits directories into a unified Filmstrip carousel beneath an expansive Master View Canvas.
- **Universal Previews:** Supports rigorous native rendering for arrays of filetypes, bypassing OS limitations via unified Abstract Engines:
  - Supports Markdown, JSON (with collapsible trees), CSS, Shell scripts, TypeScript, and HTML Sandboxes.
  - Generates ZIP extraction maps visually.
  - Mounts native vector PDFs directly over internal canvases.
  - Projects `jpg`, `png`, `webp`, `mp4`, `webm` live from native browser streams.
- **Native Context Bindings:** Bypasses limitations on traditional browsers by tapping into active Context Menus for features like `Copy File Contents`, piping text and binary Arrays directly into OS clipboards.
- **Sidecar Metadata Engine:** Seamlessly hides and integrates metadata sidecars (`.meta.json`, `filename.json`) automatically bridging EXIF arrays and system bounds back onto the primary nodes.
- **Selection Modifiers:** Emulates traditional macOS Finder / Windows Explorer cursor bindings (`Shift`, `Cmd`, `Alt` clicks).
- **Silent Bookmarking:** Mounts heavily restricted browser file handling states into `IndexedDB` memory, allowing cross-session "Continue Where You Left Off!" persistence without re-prompting users structurally!

## Target Environment

- **Browser-Based PWA:** Optimized for Chrome and Chromium-based engines (v86+) utilizing native File System Access capabilities. 
- *Note:* Firefox currently limits local directory mutations, therefore Chromium browsers are mandated for Write/Save functionalities.

## Installation & Startup

1. Run standard dependency checks:
   ```bash
   npm install
   ```

2. Activate the local Vite development instance:
   ```bash
   npm run dev
   ```

3. Route to your Localhost port, click **Select Local Directory**, and authorize browser permissions!

## Architecture Details

- Built entirely on **React 18** and **TailwindCSS**.
- Icons provided by **Lucide-React**.
- Archiving powered by **JSZip**.
- Persistent Storage handled natively by **idb-keyval**.
- Markdown renders natively initialized by **react-markdown**.

## Privacy

Everything runs completely locally within the browser sandbox state. No backend database or server storage mechanism is necessary, no files map to external cloud APIs. Data remains locked heavily on the initial hardware.
