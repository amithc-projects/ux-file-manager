import React, { useState, useMemo, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { GridItem, WorkspaceFolder } from '../../core/models/FilePair';
import { ScannerService } from '../../core/services/ScannerService';
import { StorageService } from '../../core/services/StorageService';
import { FileGrid, ViewMode } from '../../ui/components/FileGrid';
import { FilmstripView } from '../../ui/components/FilmstripView';
import { TransformCompareView, CompareRenderResult } from '../../ui/components/TransformCompareView';
import { HiddenFilesWarning } from '../../ui/components/HiddenFilesWarning';
import { SettingsModal, loadStcConfig, StcConfig } from '../../ui/components/SettingsModal';
import { SendToCloudModal } from '../../ui/components/SendToCloudModal';
import { TypeFilters, TypeFilter, getTypeFilter } from '../../ui/components/TypeFilters';
import { InspectorPanel } from '../../ui/components/InspectorPanel';
import { PreviewModal } from '../../ui/components/PreviewModal';
import { CompareModal } from '../../ui/components/CompareModal';
import { FolderDiffModal } from '../../ui/components/FolderDiffModal';
import { ConfirmModal } from '../../ui/components/ConfirmModal';
import { PathPromptModal } from '../../ui/components/PathPromptModal';
import { SlideshowModal } from '../../ui/components/SlideshowModal';
import { useSelection } from '../../ui/hooks/useSelection';
import { FolderOpen, FolderPlus, Search, SearchX, LayoutGrid, List, Columns as CompareIcon, SortAsc, SortDesc, History, Copy, Trash2, ClipboardPaste, BoxSelect, Bookmark, FileText, X, Play, GalleryHorizontal, ChevronDown, Settings, Cloud, Download } from 'lucide-react';

type SortBy = 'name' | 'type' | 'date' | 'size';
type GroupBy = 'none' | 'type';
type ActionType = 'copy' | 'cut' | null;

interface ContextMenuState { x: number; y: number; item: GridItem; }

export interface SelectionAction {
  label: string;
  icon?: string;          // emoji / text icon shown before the label
  onClick: (selectedIds: string[]) => void;
}

export interface AppProps {
  onTelemetry?: (event: string, payload: any) => void;
  customSort?: ((a: GridItem, b: GridItem) => number) | null;
  hiddenFilesCount?: number;
  hiddenFilesMessage?: string;
  compareMode?: 'two-file' | 'transform';
  onCompareRender?: (file: File) => Promise<CompareRenderResult>;
  onCompareInfo?: (file: File) => Promise<void>;
  customControlsHtml?: string;
  onBindCustomControls?: (container: HTMLDivElement) => void;
  triggerProcessRef?: React.MutableRefObject<(() => void) | null>;
  selectionActions?: SelectionAction[];
  /**
   * When true, ignore window.location.hash when computing the initial
   * directory path. Required when the component is embedded in a host
   * app (e.g. pic-machina) that uses the hash for its own routing —
   * otherwise sidekick would treat the host's route name as a sub-folder
   * deep-link, fail to find it, and then clear the hash (causing the
   * host router to navigate away).
   */
  noHashRouting?: boolean;
  /** When true, hides the right-side inspector panel (Props/Marks/Collection tabs).
   *  Use this when the host app provides its own metadata panel. */
  hideInspector?: boolean;
  /** When non-null, restrict displayed files to those whose `pair.id` appears in this list.
   *  Folders are always shown. Used by hosts to filter to e.g. a single recipe-run's outputs. */
  allowedFiles?: string[] | null;
  /** When non-null, switches the type-filter chips to recipe mode: only chips for these
   *  types are shown (even with count=0), all are active by default, multi-select toggles,
   *  and files of disallowed types are hidden unconditionally. */
  allowedTypes?: TypeFilter[] | null;
}

export interface NavigateOptions {
  filename?: string;
  sortBy?: SortBy;
  sortAsc?: boolean;
  viewMode?: ViewMode;
}

export interface AppRef {
  navigate: (pathStr: string, options?: NavigateOptions) => Promise<void>;
  setRoot: (handle: FileSystemDirectoryHandle) => Promise<void>;
  getCurrentDirectoryHandle: () => FileSystemDirectoryHandle | null;
}

const App = React.forwardRef<AppRef, AppProps>(({ onTelemetry, customSort, hiddenFilesCount = 0, hiddenFilesMessage, compareMode = 'two-file', onCompareRender, onCompareInfo, customControlsHtml, onBindCustomControls, triggerProcessRef, selectionActions = [], noHashRouting = false, hideInspector = false, allowedFiles = null, allowedTypes = null }, ref) => {
  const [items, setItems] = useState<GridItem[]>([]);
  const [pathStack, setPathStack] = useState<FileSystemDirectoryHandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Storage states
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceFolder[]>([]);
  const [bookmarks, setBookmarks] = useState<WorkspaceFolder[]>([]);
  
  // UX State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  
  // Modals & Popups
  const [previewItem, setPreviewItem] = useState<{ item: GridItem, forceText?: boolean } | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pathPromptOpen, setPathPromptOpen] = useState(false);
  const [gapPrompt, setGapPrompt] = useState<{ id: string, resolve: (res: boolean) => void } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [globalTooltip, setGlobalTooltip] = useState<{ item: GridItem, x: number, y: number } | null>(null);
  
  // Advanced Selectors
  const [leftCompareItem, setLeftCompareItem] = useState<GridItem | null>(null);
  const [compareActive, setCompareActive] = useState<{ left: GridItem, right: GridItem } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  
  // Collection & Clipboard
  const [clipboardItems, setClipboardItems] = useState<GridItem[]>([]);
  const [_clipboardAction, _setClipboardAction] = useState<ActionType>(null);
  
  const [slideshowItems, setSlideshowItems] = useState<GridItem[] | null>(null);
  const [collection, setCollection] = useState<GridItem[]>([]);
  const [collectionViewOpen, setCollectionViewOpen] = useState(false); // show collection in main window
  const [collectionPanelOpen, setCollectionPanelOpen] = useState(false); // top-bar dropdown
  const [bookmarksPanelOpen, setBookmarksPanelOpen] = useState(false); // top-bar dropdown
  const [childFolderMenuOpen, setChildFolderMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stcConfig, setStcConfig] = useState<StcConfig | null>(() => loadStcConfig());
  const [stcFiles, setStcFiles] = useState<File[]>([]);
  const [stcModalOpen, setStcModalOpen] = useState(false);
  // Active type filter chips. Empty Set = no filter (show all). In recipe mode,
  // initialised to the full allowedTypes list.
  const [typeFilter, setTypeFilter] = useState<Set<TypeFilter>>(
    () => new Set(allowedTypes ?? [])
  );

  // When the host changes allowedTypes (recipe context switch), reset to the new set.
  React.useEffect(() => {
    setTypeFilter(new Set(allowedTypes ?? []));
  }, [allowedTypes ? allowedTypes.join(',') : null]);

  const allowedTypesSet = React.useMemo(
    () => (allowedTypes && allowedTypes.length ? new Set(allowedTypes) : null),
    [allowedTypes ? allowedTypes.join(',') : null]
  );

  const { selectedIdsArray, setSelectedIdsArray, selectedIds, toggleSelection, clearSelection } = useSelection<GridItem>(items, true);

  // Track last-clicked item for Shift+Click range selection
  const lastClickedIdRef = React.useRef<string | null>(null);

  useEffect(() => {
     if (onTelemetry) onTelemetry('sidekick:ready', { version: '1.0' });
     StorageService.getWorkspaces().then(setRecentWorkspaces);
     StorageService.getBookmarks().then(setBookmarks);
  }, []);

  useEffect(() => {
     if (onTelemetry) {
        const targets = items.filter(i => selectedIds.has(i.type === 'file' ? i.pair.id : i.name));
        onTelemetry('sidekick:selection', { items: targets.map(t => t.type === 'file' ? t.pair.id : t.name) });

        // sidekick:file-focus — fires when exactly one file is selected
        const fileTargets = targets.filter(t => t.type === 'file');
        if (fileTargets.length === 1) {
           const item = fileTargets[0];
           if (item.type === 'file') {
              const pair = item.pair;
              pair.mainHandle.getFile().then((f) => {
                onTelemetry('sidekick:file-focus', {
                   filename:     pair.id,
                   handle:       pair.mainHandle,
                   metadata:     pair.metadata ?? null,
                   size:         f.size,
                   lastModified: f.lastModified,
                });
              }).catch(() => {});
           }
        } else {
           onTelemetry('sidekick:file-focus', null);
        }
     }
  }, [selectedIds, items, onTelemetry]);

  useEffect(() => {
     if (onTelemetry && pathStack.length > 0) {
        onTelemetry('sidekick:workspace', { folderName: pathStack[pathStack.length - 1].name, pathLength: pathStack.length, pathNames: pathStack.map(h => h.name) });
     }
  }, [pathStack, onTelemetry]);

  const closeContext = () => setContextMenu(null);
  const currentDir = pathStack.length > 0 ? pathStack[pathStack.length - 1] : null;

  // childFolderMenuRef kept for potential future use but click-outside is handled via backdrop overlay

  const childFolders = useMemo(
    () => items.filter((i): i is Extract<typeof i, { type: 'folder' }> => i.type === 'folder' && i.name !== '..'),
    [items]
  );

  const loadHandleContentsToUI = useCallback(async (targetHandle: FileSystemDirectoryHandle) => {
      const { pairs, folders } = await ScannerService.scanDirectory(targetHandle);
      const populatedPairs = await Promise.all(pairs.map(async (pair) => {
        if (pair.sidecarHandle) pair.metadata = await ScannerService.readSidecarMetadata(pair.sidecarHandle);
        return pair;
      }));
      setItems([
        ...folders.map(f => ({ type: 'folder' as const, handle: f, name: f.name, lastModified: 0, size: 0 })),
        ...populatedPairs.map(p => ({ type: 'file' as const, pair: p }))
      ]);
      clearSelection();
      setTypeFilter(new Set(allowedTypes ?? []));
  }, [clearSelection, allowedTypes ? allowedTypes.join(',') : null]);

  useEffect(() => {
     if (pendingSelection && items.length > 0) {
        const target = items.find(i => (i.type === 'file' ? i.pair.id : i.name) === pendingSelection);
        if (target) {
           const finalId = target.type === 'file' ? target.pair.id : target.name;
           setSelectedIdsArray([finalId]);
           setPendingSelection(null);
        }
     }
  }, [items, pendingSelection, setSelectedIdsArray]);

  const refreshCurrentDirectory = useCallback(async () => {
    if (currentDir) {
       setLoading(true);
       await loadHandleContentsToUI(currentDir);
       setLoading(false);
    }
  }, [currentDir, loadHandleContentsToUI]);

  // Background thumbnail persistence — extracts first-frame from videos that don't yet have a .thumbnail.jpg sidecar
  // and writes it to the directory. Runs whenever currentDir changes (new folder opened).
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!currentDir) return;
    const dirHandle = currentDir; // capture for async use

    const THUMB_MAX = 320; // max dimension for saved thumbnails

    function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
      return new Promise((resolve) => {
        // Use rAF to ensure the browser has painted the decoded frame
        requestAnimationFrame(() => {
          const w = video.videoWidth || THUMB_MAX;
          const h = video.videoHeight || Math.round(THUMB_MAX * 9 / 16);
          const scale = Math.min(1, THUMB_MAX / Math.max(w, h));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(resolve, 'image/jpeg', 0.8);
          } else {
            resolve(null);
          }
        });
      });
    }

    function extractFirstFrame(file: File): Promise<Blob | null> {
      return new Promise((resolve) => {
        const videoObjectUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        const cleanup = async (capture: boolean) => {
          const blob = capture ? await captureFrame(video) : null;
          URL.revokeObjectURL(videoObjectUrl);
          video.src = '';
          resolve(blob);
        };
        video.addEventListener('error', () => cleanup(false), { once: true });
        video.addEventListener('loadeddata', () => {
          // loadeddata fires when the first frame is available — capture immediately
          cleanup(true);
        }, { once: true });
        video.src = videoObjectUrl;
        video.load();
      });
    }

    (async () => {
      const videoItems = itemsRef.current.filter(
        (item): item is Extract<typeof item, { type: 'file' }> =>
          item.type === 'file' &&
          /\.(mp4|webm|mov|avi|mkv)$/i.test(item.pair.id) &&
          !item.pair.thumbnailHandle
      );
      console.log(`[thumbnails] ${videoItems.length} video(s) need thumbnails in ${dirHandle.name}`);
      for (const item of videoItems) {
        const pair = item.pair;
        try {
          const file = await pair.mainHandle.getFile();
          const blob = await extractFirstFrame(file);
          if (!blob) { console.warn('[thumbnails] no blob for', pair.id); continue; }
          const thumbName = `.${pair.id}.thumbnail.jpg`;
          const thumbHandle = await dirHandle.getFileHandle(thumbName, { create: true });
          const writable = await (thumbHandle as any).createWritable();
          await writable.write(blob);
          await writable.close();
          pair.thumbnailHandle = thumbHandle;
          console.log('[thumbnails] saved', thumbName);
        } catch (e) {
          console.warn('[thumbnails] failed for', pair.id, e);
        }
      }
    })();
  }, [currentDir]);

  const scanAndSetDirectory = useCallback(async (handle: FileSystemDirectoryHandle, isNewRoot: boolean = false) => {
    try {
      setLoading(true);
      if (isNewRoot) {
         await StorageService.saveWorkspace(handle);
         StorageService.getWorkspaces().then(setRecentWorkspaces);

         let finalTargetHandle = handle;
         let resolvedStack: FileSystemDirectoryHandle[] = [handle];
         const rawHash = noHashRouting
            ? ''
            : window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
         if (rawHash) {
            const segments = rawHash.split('/').filter(Boolean);
            try {
               for (const segment of segments) {
                   const deeperHandle = await finalTargetHandle.getDirectoryHandle(segment);
                   finalTargetHandle = deeperHandle;
                   resolvedStack.push(deeperHandle);
               }
            } catch (deepLinkErr) { window.location.hash = ''; }
         }
         await loadHandleContentsToUI(finalTargetHandle);
         setPathStack(resolvedStack);
      } else {
         await loadHandleContentsToUI(handle);
         setPathStack(prev => {
           if (prev.length > 0 && prev[prev.length - 1].name === handle.name) return prev;
           return [...prev, handle];
         });
      }
    } catch (err) { } finally { setLoading(false); }
  }, [loadHandleContentsToUI]);

  const handleOpenRootFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      await scanAndSetDirectory(handle, true);
    } catch (err: any) {
      // AbortError means the user cancelled the picker — not an error worth reporting
      if (err?.name === 'AbortError') return;
      if (onTelemetry) onTelemetry('sidekick:error', { code: 'FSA_DENIED', message: err?.message || 'Access Denied' });
    }
  };

  const handleResumeWorkspace = async (ws: WorkspaceFolder) => {
     const hasPerm = await StorageService.verifyPermission(ws.handle, 'readwrite');
     if (hasPerm) await scanAndSetDirectory(ws.handle, true);
  };

  const handleOpenBookmark = async (ws: WorkspaceFolder) => {
     const hasPerm = await StorageService.verifyPermission(ws.handle, 'readwrite');
     if (hasPerm) await scanAndSetDirectory(ws.handle, false);
  };

  const handleNavigateUp = useCallback(() => {
    if (pathStack.length <= 1) return; 
    const newStack = [...pathStack];
    newStack.pop(); 
    const parentHandle = newStack[newStack.length - 1];
    setPathStack(newStack);
    
    setLoading(true);
    loadHandleContentsToUI(parentHandle).finally(() => setLoading(false));
    if (!noHashRouting) window.location.hash = '';
  }, [pathStack, loadHandleContentsToUI, noHashRouting]);

  const handleItemDoubleClick = useCallback((item: GridItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'folder') {
       if (item.name === '..') handleNavigateUp();
       else scanAndSetDirectory(item.handle, false);
    } else {
       setPreviewItem({ item });
    }
  }, [handleNavigateUp, scanAndSetDirectory]);

  const handleItemClick = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      closeContext();
      if (id === '..') return;

      // Shift+Click: extend selection range from last clicked item to this one
      if (e.shiftKey && lastClickedIdRef.current) {
        const allItems = processedGroups.flatMap(g => g.items);
        const flatIds = allItems.map(i => i.type === 'file' ? i.pair.id : i.name);
        const fromIdx = flatIds.indexOf(lastClickedIdRef.current);
        const toIdx = flatIds.indexOf(id);
        if (fromIdx !== -1 && toIdx !== -1) {
          const start = Math.min(fromIdx, toIdx);
          const end = Math.max(fromIdx, toIdx);
          setSelectedIdsArray(flatIds.slice(start, end + 1));
          return;
        }
      }

      // Ctrl/Cmd+Click: add/remove individual item without clearing others
      if (e.metaKey || e.ctrlKey) {
        lastClickedIdRef.current = id;
        toggleSelection(id, false, true, e.altKey, () => {
          return new Promise<boolean>((resolve) => { setGapPrompt({ id, resolve }); });
        });
        return;
      }

      // Plain click: select only this item
      lastClickedIdRef.current = id;
      toggleSelection(id, false, false, e.altKey, () => {
        return new Promise<boolean>((resolve) => { setGapPrompt({ id, resolve }); });
      });
  };

  // Build the Send to Cloud selection action when config is present
  const handleSendToCloud = useCallback(async (selectedIds: string[]) => {
    if (!stcConfig) { setSettingsOpen(true); return; }
    const fileItems = items.filter(i => i.type === 'file' && selectedIds.includes(i.pair.id));
    const files: File[] = [];
    for (const item of fileItems) {
      if (item.type === 'file') files.push(await item.pair.mainHandle.getFile());
    }
    if (files.length === 0) return;
    setStcFiles(files);
    setStcModalOpen(true);
  }, [stcConfig, items]);

  const builtInSelectionActions: SelectionAction[] = stcConfig
    ? [{ label: 'Send to Cloud', icon: '☁', onClick: (ids) => handleSendToCloud(ids) }]
    : [];

  const allSelectionActions = [...builtInSelectionActions, ...selectionActions];

  const tooltipTimeout = React.useRef<number | null>(null);
  const tooltipDimCache = React.useRef<Record<string, string>>({});

  const loadDimensions = useCallback(async (item: GridItem): Promise<string> => {
    if (item.type !== 'file') return '';
    const id = item.pair.id;
    if (tooltipDimCache.current[id]) return tooltipDimCache.current[id];

    // Fast path: sidecar already has widthPx / heightPx
    const meta = item.pair.metadata as any;
    if (meta?.widthPx && meta?.heightPx) {
      const dim = `${meta.widthPx} × ${meta.heightPx}`;
      tooltipDimCache.current[id] = dim;
      return dim;
    }
    // Also check common alternative keys (width/height, imageWidth/imageHeight)
    const w = meta?.width ?? meta?.imageWidth;
    const h = meta?.height ?? meta?.imageHeight;
    if (w && h) {
      const dim = `${w} × ${h}`;
      tooltipDimCache.current[id] = dim;
      return dim;
    }

    // Slow path: decode via offscreen element
    const isImage = /\.(jpe?g|png|gif|webp|bmp)$/i.test(id);
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(id);
    if (!isImage && !isVideo) return '';

    try {
      const file = await item.pair.mainHandle.getFile();
      const url = URL.createObjectURL(file);
      return await new Promise<string>((resolve) => {
        if (isImage) {
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            const dim = `${img.naturalWidth} × ${img.naturalHeight}`;
            tooltipDimCache.current[id] = dim;
            resolve(dim);
          };
          img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
          img.src = url;
        } else {
          const vid = document.createElement('video');
          vid.preload = 'metadata';
          vid.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            const dim = `${vid.videoWidth} × ${vid.videoHeight}`;
            tooltipDimCache.current[id] = dim;
            resolve(dim);
          };
          vid.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
          vid.src = url;
        }
      });
    } catch { return ''; }
  }, []);

  const handleItemHover = useCallback((item: GridItem, e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      const x = rect.right + 10;
      const y = Math.max(10, rect.top + (rect.height / 2) - 40);
      tooltipTimeout.current = window.setTimeout(() => {
          setGlobalTooltip({ item, x, y });
          // Lazily load dimensions and re-update the tooltip once available
          loadDimensions(item).then(dim => {
            if (dim) setGlobalTooltip(prev => prev?.item === item ? { ...prev } : prev);
          });
      }, 500);
  }, [loadDimensions]);

  const handleItemLeave = useCallback(() => {
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      setGlobalTooltip(null);
  }, []);

  const pathStackRef = React.useRef(pathStack);
  pathStackRef.current = pathStack; // Synchronous bind during render pipeline before effects!

  React.useImperativeHandle(ref, () => ({
      navigate: async (pathStr: string, options?: NavigateOptions) => {
          if (options?.sortBy) setSortBy(options.sortBy);
          if (options?.sortAsc !== undefined) setSortAsc(options.sortAsc);
          if (options?.viewMode) {
              setViewMode(options.viewMode);
          }

          // Allow modifying pure UI params if root isn't even active
          if (pathStackRef.current.length === 0) {
             if (pathStr && onTelemetry) {
                 onTelemetry('sidekick:error', { code: 'NAV_DENIED', message: 'Cannot navigate deep path before Root Folder is authorized.' });
             }
             return;
          }

          if (pathStr) {
             await handleCreatePath(pathStr);
          }

          if (options?.filename) {
             setPendingSelection(options.filename);
          }
      },
      setRoot: async (handle: FileSystemDirectoryHandle) => {
          await scanAndSetDirectory(handle, true);
      },
      getCurrentDirectoryHandle: () => {
          const stack = pathStackRef.current;
          return stack.length > 0 ? stack[stack.length - 1] : null;
      }
  }));

  const handleCreatePath = async (pathStr: string) => {
     setPathPromptOpen(false);
     const stack = pathStackRef.current;
     if (stack.length === 0 || !pathStr) return;
     try {
       setLoading(true);
       const chunks = pathStr.split('/').filter(Boolean);
       let curr = stack[stack.length - 1];
       const newStack: FileSystemDirectoryHandle[] = [];
       for (const chunk of chunks) {
          curr = await curr.getDirectoryHandle(chunk, { create: false });
          newStack.push(curr);
       }
       setPathStack([...stack, ...newStack]);
       await scanAndSetDirectory(curr, false);
     } catch (e) {
         console.error(e);
     } finally {
         setLoading(false);
     }
  };

  const executeDeleteMode = async (targetedItems: GridItem[]) => {
    setDeleteModalOpen(false);
    if (!currentDir) return;
    try {
      setLoading(true);
      for (const item of targetedItems) {
        if (item.type === 'file') {
           await currentDir.removeEntry(item.pair.id);
           if (item.pair.sidecarHandle) await currentDir.removeEntry(item.pair.sidecarHandle.name);
        } else if (item.type === 'folder' && item.name !== '..') {
           await currentDir.removeEntry(item.name, { recursive: true });
        }
      }
      if (onTelemetry) onTelemetry('sidekick:action', { action: 'delete', targetCount: targetedItems.length });
      await refreshCurrentDirectory();
    } catch (error: any) { 
        if (onTelemetry) onTelemetry('sidekick:error', { code: 'DELETE_ABORTED', message: error?.message });
    } finally { setLoading(false); }
  };

  const handleCollectionBatch = async (action: string) => {
      if (action === 'clear') {
         setCollection([]);
      } else if (action === 'zip') {
         const zip = new JSZip();
         for (const item of collection) {
            if (item.type === 'file') {
               const rawFile = await item.pair.mainHandle.getFile();
               zip.file(item.pair.id, rawFile);
               if (item.pair.sidecarHandle) {
                  const sidecar = await item.pair.sidecarHandle.getFile();
                  zip.file(item.pair.sidecarHandle.name, sidecar);
               }
            }
         }
         const blob = await zip.generateAsync({ type: 'blob' });
         const dlUrl = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = dlUrl;
         a.download = 'sidekick_collection.zip';
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(dlUrl);

      } else if (action === 'copy' || action === 'move') {
         if (!currentDir) return;
         setLoading(true);
         for (const item of collection) {
             if (item.type === 'file') {
                const sourceFile = await item.pair.mainHandle.getFile();
                const targetFileHandle = await currentDir.getFileHandle(item.pair.id, { create: true });
                const writable = await targetFileHandle.createWritable();
                await writable.write(sourceFile);
                await writable.close();
      
                if (item.pair.sidecarHandle) {
                   const sidecarSourceFile = await item.pair.sidecarHandle.getFile();
                   const targetSidecarHandle = await currentDir.getFileHandle(item.pair.sidecarHandle.name, { create: true });
                   const wSidecar = await targetSidecarHandle.createWritable();
                   await wSidecar.write(sidecarSourceFile);
                   await wSidecar.close();
                }
             }
         }
         setLoading(false);
         await refreshCurrentDirectory();
      }
  };

  const generateUniqueName = async (dirHandle: FileSystemDirectoryHandle, originalName: string): Promise<string> => {
     try {
         await dirHandle.getFileHandle(originalName, { create: false });
     } catch (e: any) {
         if (e.name === 'NotFoundError') return originalName;
     }
     
     const dotIdx = originalName.lastIndexOf('.');
     const base = dotIdx !== -1 ? originalName.substring(0, dotIdx) : originalName;
     const ext = dotIdx !== -1 ? originalName.substring(dotIdx) : '';
     
     let n = 1;
     while (true) {
         const testName = n === 1 ? `${base} (Copy)${ext}` : `${base} (Copy ${n})${ext}`;
         try {
             await dirHandle.getFileHandle(testName, { create: false });
             n++;
         } catch (e: any) {
             if (e.name === 'NotFoundError') return testName;
             throw e;
         }
     }
  };

  const executePasteClipboard = async () => {
         const targetDir = pathStack[pathStack.length - 1];
         if (!targetDir || clipboardItems.length === 0) return;
         setLoading(true);
         try {
             for (const item of clipboardItems) {
                 if (item.type === 'file') {
                    const uniqueId = await generateUniqueName(targetDir, item.pair.id);
                    const sourceFile = await item.pair.mainHandle.getFile();
                    const targetFileHandle = await targetDir.getFileHandle(uniqueId, { create: true });
                    const writable = await (targetFileHandle as any).createWritable();
                    await writable.write(sourceFile);
                    await writable.close();
          
                    if (item.pair.sidecarHandle) {
                       const sidecarSourceFile = await item.pair.sidecarHandle.getFile();
                       const targetSidecarHandle = await targetDir.getFileHandle('.' + uniqueId, { create: true });
                       const wSidecar = await (targetSidecarHandle as any).createWritable();
                       await wSidecar.write(sidecarSourceFile);
                       await wSidecar.close();
                    }
                 }
             }
             if (onTelemetry) onTelemetry('sidekick:action', { action: 'paste', count: clipboardItems.length });
         } catch (err: any) {
             if (onTelemetry) onTelemetry('sidekick:error', { message: 'Paste interrupted: ' + err?.message });
         } finally {
             setClipboardItems([]);
             _setClipboardAction(null);
             setLoading(false);
             await refreshCurrentDirectory();
         }
  };

  const handleCopyContents = async (item: GridItem) => {
     if (item.type !== 'file') return;
     try {
       const file = await item.pair.mainHandle.getFile();
       const ext = item.pair.id.split('.').pop()?.toLowerCase();
       const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
       if (isImage) {
           const buffer = await file.arrayBuffer();
           const blob = new Blob([buffer], { type: file.type || 'image/png' });
           let type = blob.type;
           if (!type.includes('image/')) type = 'image/png';
           if (type === 'image/jpeg') type = 'image/png'; // ClipboardItem mandates PNG heavily for images on raw copy in Chrome/Safari securely
           const cbItem = new ClipboardItem({ [type]: blob });
           await navigator.clipboard.write([cbItem]);
       } else {
           const text = await file.text();
           await navigator.clipboard.writeText(text);
       }
       if (onTelemetry) onTelemetry('sidekick:action', { action: 'copy-contents', target: item.pair.id });
     } catch (e: any) {
        if (onTelemetry) onTelemetry('sidekick:error', { code: 'COPY_FAILED', message: e?.message });
     }
  };

  const selectedItem = items.find(i => {
     const id = i.type === 'file' ? i.pair.id : i.name;
     return id === selectedIdsArray.find(x => x !== null);
  });



  const allowedFilesSet = useMemo(
    () => (allowedFiles && allowedFiles.length ? new Set(allowedFiles) : null),
    [allowedFiles]
  );

  const processedGroups = useMemo(() => {
    let processable = (pathStack.length <= 1 ? items : [{ type: 'folder' as const, name: '..', handle: {} as any, lastModified: 0, size: 0 }, ...items]).filter(i => {
      const name = i.type === 'file' ? i.pair.id : i.name;
      const q = searchQuery.toLowerCase();
      const nameMatch = name.toLowerCase().includes(q);
      const sidecarMatch = i.type === 'file' && i.pair.metadata
        ? JSON.stringify(i.pair.metadata).toLowerCase().includes(q)
        : false;
      if (!nameMatch && !sidecarMatch) return false;
      // Type filter:
      //   - Recipe mode (allowedTypesSet): hide files of disallowed types
      //     unconditionally, and within the allowed set apply the active toggles.
      //   - Legacy single-select mode: a non-empty set narrows; empty = show all.
      // Folders are always shown so the user can still navigate.
      if (i.type === 'file') {
        const cat = getTypeFilter(i.pair.id);
        if (allowedTypesSet && !allowedTypesSet.has(cat)) return false;
        if (typeFilter.size > 0 && !typeFilter.has(cat)) return false;
      }
      // allowedFiles whitelist: when active, only show files whose name is in the set.
      if (allowedFilesSet && i.type === 'file' && !allowedFilesSet.has(i.pair.id)) return false;
      return true;
    });

    processable.sort((a, b) => {
      const nameA = a.type === 'file' ? a.pair.id : a.name;
      const nameB = b.type === 'file' ? b.pair.id : b.name;
      // '..' (parent navigation) always pinned to top
      if (nameA === '..') return -1;
      if (nameB === '..') return 1;
      // Real folders sort AFTER files, regardless of sort key / direction
      if (a.type !== b.type) return a.type === 'folder' ? 1 : -1;

      let result = 0;
      if (sortBy === 'type') {
         if (a.type === 'file' && b.type === 'file') result = (nameA.split('.').pop() || '').localeCompare(nameB.split('.').pop() || '');
      } else if (sortBy === 'date') {
         result = (a.type === 'file' ? (a.pair.lastModified || 0) : 0) - (b.type === 'file' ? (b.pair.lastModified || 0) : 0);
      } else if (sortBy === 'size') {
         result = (a.type === 'file' ? (a.pair.size || 0) : 0) - (b.type === 'file' ? (b.pair.size || 0) : 0);
      } else result = nameA.localeCompare(nameB);

      return sortAsc ? result : -result;
    });

    // Apply optional custom sort after the built-in sort
    if (customSort) processable.sort(customSort);

    if (groupBy === 'none') return [{ groupName: '', items: processable }];

    // Group order: Navigation → files (by type) → Folders (at end)
    const groupsMap: Record<string, GridItem[]> = { 'Navigation': [], 'Images': [], 'Documents': [], 'Videos': [], 'Other Files': [], 'Folders': [] };
    processable.forEach(item => {
      if (item.type === 'folder' && item.name === '..') groupsMap['Navigation'].push(item);
      else if (item.type === 'folder') groupsMap['Folders'].push(item);
      else if (item.type === 'file') {
         const ext = item.pair.id.split('.').pop()?.toLowerCase();
         if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext || '')) groupsMap['Images'].push(item);
         else if (['txt', 'json', 'md', 'pdf', 'html', 'csv'].includes(ext || '')) groupsMap['Documents'].push(item);
         else if (['mp4', 'mov', 'webm', 'ogg'].includes(ext || '')) groupsMap['Videos'].push(item);
         else groupsMap['Other Files'].push(item);
      }
    });

    return Object.entries(groupsMap).filter(([_, arr]) => arr.length > 0).map(([groupName, items]) => ({ groupName, items }));
  }, [items, pathStack, searchQuery, sortBy, sortAsc, groupBy, customSort, typeFilter, allowedFilesSet, allowedTypesSet]);

  return (
    <div className="w-full h-full flex flex-col bg-dark-900 text-gray-100 font-sans overflow-hidden" onClick={closeContext}>
      {/* ── Two-row header ───────────────────────────────────────────────────── */}
      <header className="border-b border-dark-700 bg-dark-800 shrink-0 relative z-40 shadow-sm select-none">

        {/* Row 1: Logo + breadcrumb + filter input + workspace button */}
        <div className="flex items-center gap-2 px-3 h-11 border-b border-dark-700/60">
          {/* Logo / open workspace */}
          <button
            onClick={handleOpenRootFolder}
            title={pathStack.length > 0 ? 'Open different workspace' : 'Open workspace'}
            className="w-7 h-7 rounded-lg bg-blue-500 hover:bg-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0 transition-colors"
          >
            <FolderOpen size={14} className="text-white" />
          </button>

          {/* Breadcrumb + subfolder chevron — shares a flex-1 zone */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {/* Scrollable breadcrumb path */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar font-medium text-sm tracking-tight scroll-smooth min-w-0">
              {pathStack.length === 0 ? (
                 <span className="text-base font-semibold text-gray-300 whitespace-nowrap">Sidekick</span>
              ) : (
                 pathStack.map((handle, idx) => (
                   <React.Fragment key={idx + handle.name}>
                     {idx > 0 && <span className="text-gray-600 mx-0.5">/</span>}
                     <button
                       onClick={async () => {
                          if (idx === pathStack.length - 1) return;
                          const targetStack = pathStack.slice(0, idx + 1);
                          setPathStack(targetStack);
                          setLoading(true);
                          await loadHandleContentsToUI(handle);
                          setLoading(false);
                       }}
                       className={`hover:text-blue-400 transition-colors whitespace-nowrap px-1.5 py-0.5 rounded-md ${idx === pathStack.length - 1 ? 'text-gray-100 font-semibold cursor-default' : 'text-gray-400 hover:bg-dark-700'}`}
                     >
                       {handle.name}
                     </button>
                   </React.Fragment>
                 ))
              )}
            </div>

            {/* Child folder dropdown chevron */}
            {currentDir && childFolders.length > 0 && (
              <div className="relative shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setChildFolderMenuOpen(o => !o); }}
                  title={`Jump to subfolder (${childFolders.length})`}
                  className={`flex items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors text-xs font-medium ${childFolderMenuOpen ? 'bg-dark-700 text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
                >
                  <ChevronDown size={14} />
                  <span className="text-[10px] text-gray-500">{childFolders.length}</span>
                </button>
                {childFolderMenuOpen && (
                  <>
                    {/* Backdrop — click outside to close, sits below the menu */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => { e.stopPropagation(); setChildFolderMenuOpen(false); }}
                    />
                    {/* Dropdown list — z-50 sits above the backdrop */}
                    <div className="absolute top-full left-0 mt-1 w-56 bg-dark-800 border border-dark-600 rounded-xl shadow-xl z-50 overflow-hidden py-1 max-h-72 overflow-y-auto">
                      {childFolders.map(f => (
                        <button
                          key={f.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            setChildFolderMenuOpen(false);
                            setLoading(true);
                            loadHandleContentsToUI(f.handle)
                              .then(() => setPathStack(prev => [...prev, f.handle]))
                              .catch(console.error)
                              .finally(() => setLoading(false));
                          }}
                          className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-dark-700 transition-colors"
                        >
                          <FolderOpen size={14} className="text-blue-400 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* New Path button (only when inside a folder) */}
          {currentDir && (
            <button onClick={() => setPathPromptOpen(true)} title="New Path" className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors shrink-0">
              <FolderPlus size={15} />
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${stcConfig ? 'text-blue-400 hover:text-blue-300 hover:bg-dark-700' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
          >
            {stcConfig ? <Cloud size={15} /> : <Settings size={15} />}
          </button>

          {/* Bookmarks top-bar button + dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setBookmarksPanelOpen(o => !o); setCollectionPanelOpen(false); }}
              title="Bookmarks"
              className={`p-1.5 rounded-lg transition-colors ${bookmarksPanelOpen ? 'bg-dark-700 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
            >
              <Bookmark size={15} />
            </button>
            {bookmarksPanelOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBookmarksPanelOpen(false)} />
                <div className="absolute top-full right-0 mt-1 w-64 bg-dark-800 border border-dark-600 rounded-xl shadow-xl z-50 overflow-hidden py-1 max-h-80 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-dark-700 flex items-center justify-between">
                    <span className="text-xs font-semibold text-yellow-400">Bookmarks</span>
                  </div>
                  {bookmarks.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-gray-500">
                      <Bookmark size={24} className="mx-auto mb-2 opacity-30" />
                      <p>No bookmarks yet.</p>
                      <p className="mt-1 text-yellow-500/70">Right-click a folder to bookmark it</p>
                    </div>
                  ) : bookmarks.map(bm => (
                    <div key={bm.id} className="flex items-center justify-between px-3 py-2 text-sm group cursor-pointer hover:bg-dark-700 transition-colors"
                      onClick={() => { handleOpenBookmark(bm); setBookmarksPanelOpen(false); }}>
                      <div className="flex items-center gap-2 truncate text-gray-300">
                        <FolderOpen size={14} className="text-yellow-500 shrink-0" />
                        <span className="truncate">{bm.name}</span>
                      </div>
                      <button onClick={async (e) => { e.stopPropagation(); const bks = await StorageService.removeBookmark(bm.id); setBookmarks(bks); }}
                        className="text-dark-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1 shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Collection top-bar button + dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setCollectionPanelOpen(o => !o); setBookmarksPanelOpen(false); }}
              title="Collection"
              className={`relative p-1.5 rounded-lg transition-colors ${collectionPanelOpen || collectionViewOpen ? 'bg-dark-700 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}
            >
              <BoxSelect size={15} />
              {collection.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white min-w-[14px] h-3.5 rounded-full text-[9px] flex items-center justify-center px-0.5 font-bold">
                  {collection.length}
                </span>
              )}
            </button>
            {collectionPanelOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCollectionPanelOpen(false)} />
                <div className="absolute top-full right-0 mt-1 w-64 bg-dark-800 border border-dark-600 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-96">
                  <div className="px-3 py-2 border-b border-dark-700 flex items-center justify-between shrink-0">
                    <span className="text-xs font-semibold text-blue-400">{collection.length} item{collection.length !== 1 ? 's' : ''} in Collection</span>
                    {collection.length > 0 && (
                      <button onClick={() => { setCollection([]); setCollectionViewOpen(false); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Clear</button>
                    )}
                  </div>
                  {collection.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-gray-500">
                      <BoxSelect size={24} className="mx-auto mb-2 opacity-30" />
                      <p>Collection is empty.</p>
                      <p className="mt-1 text-gray-600">Right-click items to add them</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 overflow-y-auto py-1">
                        {collection.map((i, idx) => {
                          const id = i.type === 'file' ? i.pair.id : i.name;
                          return (
                            <div key={id + idx} className="flex items-center justify-between px-3 py-1.5 text-xs group">
                              <span className="truncate text-gray-300 flex-1 min-w-0">{id}</span>
                              <button onClick={() => setCollection(prev => prev.filter((_, j) => j !== idx))} className="text-dark-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2">
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-2 border-t border-dark-700 bg-dark-900/50 shrink-0 space-y-1.5">
                        <button
                          onClick={() => { setCollectionViewOpen(o => !o); setCollectionPanelOpen(false); }}
                          className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${collectionViewOpen ? 'bg-blue-700 hover:bg-blue-600 text-white' : 'bg-dark-700 hover:bg-dark-600 text-gray-200'}`}
                        >
                          {collectionViewOpen ? 'Close Collection View' : 'View Collection'}
                        </button>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button onClick={() => handleCollectionBatch('zip')} className="py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white font-medium">ZIP</button>
                          <button onClick={() => handleCollectionBatch('copy')} className="py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-medium">Copy here</button>
                          <button onClick={() => handleCollectionBatch('move')} className="py-1.5 bg-dark-600 hover:bg-dark-500 rounded text-xs text-white font-medium col-span-2">Move here</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Filter input */}
          <div className="relative shrink-0 w-36 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-900 border border-dark-600 rounded-lg py-1 pl-8 pr-7 text-sm focus:outline-none focus:border-blue-500 transition-shadow"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Sort/Group controls + view mode OR action bar when items selected */}
        <div className="flex items-center px-3 h-10 gap-2">
          {(selectedIds.size > 0 || clipboardItems.length > 0) ? (
            /* ── Action bar (replaces sort controls when something is selected) ── */
            <div className="flex items-center gap-1 w-full">
              {selectedIds.size > 0 && (
                <>
                  <span className="px-2 text-sm font-bold text-white border-r border-dark-600 whitespace-nowrap mr-1">{selectedIds.size} Selected</span>
                  {selectedIds.size === 2 && (
                    <button onClick={() => {
                      const arr = selectedIdsArray.filter(Boolean);
                      const iL = items.find(i => (i.type === 'file' ? i.pair.id : i.name) === arr[0]);
                      const iR = items.find(i => (i.type === 'file' ? i.pair.id : i.name) === arr[1]);
                      if (iL && iR) setCompareActive({ left: iL, right: iR });
                    }} className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-green-500/20 hover:text-green-400 rounded-lg text-sm font-medium transition-colors">
                      <CompareIcon size={14} /> Compare
                    </button>
                  )}
                  <button onClick={() => {
                    setClipboardItems(items.filter(i => selectedIds.has(i.type === 'file' ? i.pair.id : i.name)));
                    _setClipboardAction('copy');
                    clearSelection();
                  }} className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-dark-700 rounded-lg text-sm font-medium transition-colors">
                    <Copy size={14} /> Copy
                  </button>
                  <button onClick={() => {
                    const arr = selectedIdsArray.filter(Boolean);
                    const selImages = items.filter(i => {
                      if (i.type !== 'file') return false;
                      return arr.includes(i.pair.id) && /\.(jpe?g|png|gif|svg|webp|bmp)$/i.test(i.pair.id);
                    });
                    if (selImages.length > 0) setSlideshowItems(selImages);
                  }} className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-blue-500/20 hover:text-blue-400 rounded-lg text-sm font-medium transition-colors">
                    <Play size={14} /> Slideshow
                  </button>
                  <button onClick={async () => {
                    const arr = (selectedIdsArray.filter(Boolean) as string[]);
                    const selFiles = items.filter(i => i.type === 'file' && arr.includes(i.pair.id)) as Extract<GridItem, { type: 'file' }>[];
                    if (selFiles.length === 0) return;
                    try {
                      if (selFiles.length === 1) {
                        const file = await selFiles[0].pair.mainHandle.getFile();
                        const url = URL.createObjectURL(file);
                        const a = document.createElement('a');
                        a.href = url; a.download = file.name;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } else {
                        const zip = new JSZip();
                        for (const item of selFiles) {
                          const f = await item.pair.mainHandle.getFile();
                          zip.file(item.pair.id, f);
                          if (item.pair.sidecarHandle) {
                            const sc = await item.pair.sidecarHandle.getFile();
                            zip.file(item.pair.sidecarHandle.name, sc);
                          }
                        }
                        const blob = await zip.generateAsync({ type: 'blob' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'sidekick_download.zip';
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }
                    } catch (err) {
                      console.error('[sidekick] download failed:', err);
                      if (onTelemetry) onTelemetry('sidekick:error', { code: 'DOWNLOAD_FAILED', message: (err as any)?.message });
                    }
                  }} className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-green-500/20 hover:text-green-400 rounded-lg text-sm font-medium transition-colors">
                    <Download size={14} /> Download
                  </button>
                  {allSelectionActions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => action.onClick(selectedIdsArray.filter(Boolean) as string[])}
                      className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-purple-500/20 hover:text-purple-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      {action.icon && <span>{action.icon}</span>}
                      {action.label}
                    </button>
                  ))}
                  <button onClick={() => setDeleteModalOpen(true)} className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-sm font-medium transition-colors">
                    <Trash2 size={14} /> Delete
                  </button>
                  <button onClick={clearSelection} className="p-1.5 hover:bg-dark-700 rounded-lg text-gray-500 hover:text-white transition-colors ml-1" title="Clear selection">
                    <X size={14} />
                  </button>
                </>
              )}
              {selectedIds.size > 0 && clipboardItems.length > 0 && <div className="w-px h-5 bg-dark-600 mx-1" />}
              {clipboardItems.length > 0 && (
                <>
                  <span className="px-2 text-sm font-bold text-white border-r border-dark-600 whitespace-nowrap">{clipboardItems.length} Copied</span>
                  <button onClick={executePasteClipboard} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-medium transition-colors border border-blue-500/30">
                    <ClipboardPaste size={14} /> Paste Here
                  </button>
                  <button onClick={() => setClipboardItems([])} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors ml-1" title="Clear clipboard">
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          ) : (
            /* ── Normal row 2: sort + group + view mode ── */
            <>
              {/* Sort */}
              <div className="flex items-center gap-1 text-xs text-gray-400 bg-dark-900 px-2 py-1 rounded-lg border border-dark-600 shrink-0">
                <span className="text-gray-500">Sort:</span>
                <select className="bg-transparent text-white focus:outline-none cursor-pointer text-xs" value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}>
                  <option value="name" className="bg-dark-800">Name</option>
                  <option value="type" className="bg-dark-800">Type</option>
                  <option value="date" className="bg-dark-800">Date</option>
                  <option value="size" className="bg-dark-800">Size</option>
                </select>
                <button onClick={() => setSortAsc(!sortAsc)} className="p-0.5 text-gray-400 hover:text-white rounded transition-colors" title={sortAsc ? 'Ascending' : 'Descending'}>
                  {sortAsc ? <SortAsc size={13} /> : <SortDesc size={13} />}
                </button>
              </div>

              {/* Group */}
              <div className="flex items-center gap-1 text-xs text-gray-400 bg-dark-900 px-2 py-1 rounded-lg border border-dark-600 shrink-0">
                <span className="text-gray-500">Group:</span>
                <select className="bg-transparent text-white focus:outline-none cursor-pointer text-xs" value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}>
                  <option value="none" className="bg-dark-800">None</option>
                  <option value="type" className="bg-dark-800">Type</option>
                </select>
              </div>

              {/* Type filter buttons */}
              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                <TypeFilters items={items} active={typeFilter} onChange={setTypeFilter} allowedTypes={allowedTypes} />
              </div>

              {/* View mode */}
              <div className="flex bg-dark-900 p-0.5 rounded-lg border border-dark-600 shrink-0">
                <button title="Grid View" onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={15} /></button>
                <button title="Filmstrip View" onClick={() => setViewMode('filmstrip')} className={`p-1.5 rounded-md ${viewMode === 'filmstrip' ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-white'}`}><GalleryHorizontal size={15} /></button>
                <button title="List View" onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-white'}`}><List size={15} /></button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">

        <main className="flex-1 flex flex-col bg-dark-900 relative overflow-hidden w-full h-full">
          <HiddenFilesWarning count={hiddenFilesCount} message={hiddenFilesMessage} />

          {/* Collection view banner */}
          {collectionViewOpen && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-900/40 border-b border-blue-500/30 shrink-0 text-sm">
              <BoxSelect size={14} className="text-blue-400 shrink-0" />
              <span className="text-blue-300 font-medium">Collection</span>
              <span className="text-blue-400/60">— virtual view, not a folder on disk</span>
              <span className="ml-auto text-blue-400 font-semibold">{collection.length} item{collection.length !== 1 ? 's' : ''}</span>
              <button onClick={() => setCollectionViewOpen(false)} className="ml-2 text-blue-400/60 hover:text-blue-200 transition-colors"><X size={14} /></button>
            </div>
          )}

          {loading ? (
             <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-10 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium text-blue-400">Processing...</span>
                </div>
             </div>
          ) : collectionViewOpen ? (
            <FileGrid
              groups={[{ groupName: '', items: collection }]}
              selectedIdsArray={selectedIdsArray}
              viewMode={viewMode === 'filmstrip' ? 'grid' : viewMode}
              onItemClick={handleItemClick}
              onItemDoubleClick={handleItemDoubleClick}
              onItemContextMenu={(item, e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.pageX, y: e.pageY, item });
              }}
              onItemHover={handleItemHover}
              onItemLeave={handleItemLeave}
            />
          ) : pathStack.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 max-w-xl text-center m-auto h-full w-full">
              <FolderOpen size={64} className="mb-6 text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to Sidekick</h2>
              <button onClick={handleOpenRootFolder} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg font-medium text-white transition-all transform hover:scale-105 mb-12 mt-4">Select Local Directory</button>
              
              {recentWorkspaces.length > 0 && (
                 <div className="w-full flex flex-col items-center border-t border-dark-700 pt-8 animate-in fade-in">
                    <h3 className="text-sm tracking-wider text-gray-500 font-bold mb-4 flex items-center gap-2"><History size={16} /> Continue where you left off</h3>
                    <div className="flex flex-wrap gap-3 justify-center">
                       {recentWorkspaces.slice(0, 5).map(ws => (
                          <button key={ws.id} onClick={() => handleResumeWorkspace(ws)} className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 hover:border-blue-500 rounded-lg text-sm text-gray-300 transition-colors shadow-sm">
                             <FolderOpen size={14} className="text-blue-400" />{ws.name}
                          </button>
                       ))}
                    </div>
                 </div>
              )}
            </div>
          ) : processedGroups.reduce((acc, curr) => acc + curr.items.length, 0) === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-500 m-auto h-full w-full"><SearchX size={48} className="mb-4 opacity-50" /><p>Directory Empty</p></div>
          ) : compareMode === 'transform' ? (
            <TransformCompareView
              groups={processedGroups}
              selectedIdsArray={selectedIdsArray}
              onItemClick={handleItemClick}
              onItemDoubleClick={handleItemDoubleClick}
              onItemContextMenu={(item, e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.pageX, y: e.pageY, item });
              }}
              onCompareRender={onCompareRender}
              onCompareInfo={onCompareInfo}
              customControlsHtml={customControlsHtml}
              onBindCustomControls={onBindCustomControls}
              triggerProcessRef={triggerProcessRef}
            />
          ) : viewMode === 'filmstrip' ? (
            <FilmstripView
              groups={processedGroups}
              selectedIdsArray={selectedIdsArray}
              onItemClick={handleItemClick}
              onItemDoubleClick={handleItemDoubleClick}
              onItemContextMenu={(item, e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 setContextMenu({ x: e.pageX, y: e.pageY, item });
              }}
            />
          ) : (
            <FileGrid
              groups={processedGroups}
              selectedIdsArray={selectedIdsArray}
              viewMode={viewMode}
              onItemClick={handleItemClick}
              onItemDoubleClick={handleItemDoubleClick}
              onItemContextMenu={(item, e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 setContextMenu({ x: e.pageX, y: e.pageY, item });
              }}
              onItemHover={handleItemHover}
              onItemLeave={handleItemLeave}
            />
          )}
        </main>

        {!hideInspector && (
          <InspectorPanel
             isOpen={true}
             selectedItem={selectedItem}
          />
        )}
      </div>

      {gapPrompt && (
        <ConfirmModal 
           isOpen={true} title="Leave gap in selection order?"
           message="Do you want to maintain the specific ordering constraints for the rest of your selections by leaving a structural gap here?"
           confirmText="Leave Gap" cancelText="Shift Order (Close Gap)"
           onConfirm={() => { gapPrompt.resolve(true); setGapPrompt(null); }}
           onCancel={() => { gapPrompt.resolve(false); setGapPrompt(null); }}
        />
      )}

      {deleteModalOpen && (
        <ConfirmModal 
          isOpen={true} title="Delete Selected Items" isDestructive={true}
          confirmText="Delete permanently"
          message={`Are you sure you want to delete the ${selectedIds.size} items? Sidecars will be destroyed.`}
          onCancel={() => setDeleteModalOpen(false)}
          onConfirm={() => executeDeleteMode(items.filter(i => selectedIds.has(i.type === 'file' ? i.pair.id : i.name)))}
        />
      )}

      <PathPromptModal 
         isOpen={pathPromptOpen} 
         onClose={() => setPathPromptOpen(false)}
         onSubmit={handleCreatePath}
      />

      {contextMenu && (
         <div className="fixed z-[200] w-56 py-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1" style={{ top: contextMenu.y, left: contextMenu.x }}>
            {contextMenu.item.type === 'folder' && contextMenu.item.name !== '..' && (
               <button onClick={async () => {
                  const bk = await StorageService.saveBookmark((contextMenu.item as any).handle);
                  setBookmarks(bk);
                  closeContext();
               }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-yellow-600 hover:text-white transition-colors text-left border-b border-dark-700 pb-2 mb-1">
                  <Bookmark size={14}/> Bookmark Folder
               </button>
            )}
            <button onClick={() => { setCollection(prev => { if (!prev.find(i => i === contextMenu.item)) return [...prev, contextMenu.item]; return prev; }); closeContext(); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors text-left"><BoxSelect size={14}/> Add to Collection</button>
            {contextMenu.item.type === 'file' && (
               <button onClick={() => { handleCopyContents(contextMenu.item); closeContext(); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors text-left"><ClipboardPaste size={14}/> Copy File Contents</button>
            )}
            {contextMenu.item.type === 'file' && (
               <button onClick={() => { setPreviewItem({ item: contextMenu.item, forceText: true }); closeContext(); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors text-left"><FileText size={14}/> View as Text</button>
            )}
            <button onClick={() => { setLeftCompareItem(contextMenu.item); closeContext(); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors text-left"><CompareIcon size={14}/> Set as L Compare</button>
            <button onClick={() => { if (leftCompareItem) setCompareActive({ left: leftCompareItem, right: contextMenu.item }); closeContext(); }} disabled={!leftCompareItem} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors text-left disabled:opacity-50 disabled:hover:bg-transparent"><CompareIcon size={14}/> Compare with L</button>
         </div>
      )}

      {previewItem && <PreviewModal 
         item={previewItem.item} 
         forceText={previewItem.forceText} 
         onClose={() => setPreviewItem(null)} 
         onSaveNewFile={async (blob, name, options) => {
            const targetDir = pathStack[pathStack.length - 1];
            if (!targetDir) return;
            setLoading(true);
            try {
               if (options?.overwriteOriginal) {
                  const targetFileHandle = await targetDir.getFileHandle(name, { create: false });
                  const writable = await (targetFileHandle as any).createWritable();
                  await writable.write(blob);
                  await writable.close();
               } else {
                  const uniqueId = await generateUniqueName(targetDir, name);
                  const targetFileHandle = await targetDir.getFileHandle(uniqueId, { create: true });
                  const writable = await (targetFileHandle as any).createWritable();
                  await writable.write(blob);
                  await writable.close();
               }
            } finally {
               setLoading(false);
               await refreshCurrentDirectory();
            }
         }}
      />}
      
      {compareActive && compareActive.left.type === 'file' && compareActive.right.type === 'file' && (
         <CompareModal itemLeft={compareActive.left} itemRight={compareActive.right} onClose={() => setCompareActive(null)} />
      )}

      {compareActive && compareActive.left.type === 'folder' && compareActive.right.type === 'folder' && (
         <FolderDiffModal handleLeft={compareActive.left.handle as any} handleRight={compareActive.right.handle as any} onClose={() => setCompareActive(null)} />
      )}

      {globalTooltip && !contextMenu && (
          <div className="fixed z-[300] p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl pointer-events-none animate-in fade-in zoom-in slide-in-from-left-2 duration-200" style={{ left: globalTooltip.x, top: globalTooltip.y, maxWidth: 280 }}>
             <p className="text-sm font-bold text-gray-100 truncate">{globalTooltip.item.type === 'file' ? globalTooltip.item.pair.id : globalTooltip.item.name}</p>
             {globalTooltip.item.type === 'file' ? (
                <div className="mt-2 flex flex-col gap-1">
                   <p className="text-xs text-blue-400 font-mono tracking-wider">.{globalTooltip.item.pair.id.split('.').pop()?.toUpperCase() || 'FILE'}</p>
                   <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{globalTooltip.item.pair.size ? `${(globalTooltip.item.pair.size / 1024).toFixed(2)} KB` : '0 KB'}</span>
                      <span>{globalTooltip.item.pair.lastModified ? new Date(globalTooltip.item.pair.lastModified).toLocaleString() : 'N/A'}</span>
                   </div>
                   {tooltipDimCache.current[globalTooltip.item.pair.id] && (
                     <p className="text-xs text-gray-400">{tooltipDimCache.current[globalTooltip.item.pair.id]} px</p>
                   )}
                </div>
             ) : <p className="text-xs text-gray-500 mt-1">Directory / Folder</p>}
          </div>
      )}

      {slideshowItems && <SlideshowModal items={slideshowItems} onClose={() => setSlideshowItems(null)} />}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(cfg) => setStcConfig(cfg)}
      />

      {stcModalOpen && stcConfig && (
        <SendToCloudModal
          isOpen={stcModalOpen}
          files={stcFiles}
          config={stcConfig}
          onClose={() => { setStcModalOpen(false); setStcFiles([]); }}
        />
      )}
    </div>
  );
});

export default App;
