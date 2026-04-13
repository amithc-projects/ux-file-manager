import React, { useState, useMemo, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { GridItem, FilePair, WorkspaceFolder } from '../../core/models/FilePair';
import { ScannerService } from '../../core/services/ScannerService';
import { StorageService } from '../../core/services/StorageService';
import { FileGrid, GroupedItems, ViewMode } from '../../ui/components/FileGrid';
import { GalleryView } from '../../ui/components/GalleryView';
import { InspectorPanel } from '../../ui/components/InspectorPanel';
import { PreviewModal } from '../../ui/components/PreviewModal';
import { CompareModal } from '../../ui/components/CompareModal';
import { FolderDiffModal } from '../../ui/components/FolderDiffModal';
import { ConfirmModal } from '../../ui/components/ConfirmModal';
import { PathPromptModal } from '../../ui/components/PathPromptModal';
import { useSelection } from '../../ui/hooks/useSelection';
import { FolderOpen, FolderPlus, Search, SearchX, LayoutGrid, List, Columns, SortAsc, SortDesc, History, Copy, Trash2, ClipboardPaste, Archive, BoxSelect, Columns as CompareIcon, Bookmark, FileText } from 'lucide-react';

type SortBy = 'name' | 'type' | 'date' | 'size';
type GroupBy = 'none' | 'type';
type ActionType = 'copy' | 'cut' | null;

interface ContextMenuState { x: number; y: number; item: GridItem; }

function App() {
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
  
  // Advanced Selectors
  const [leftCompareItem, setLeftCompareItem] = useState<GridItem | null>(null);
  const [compareActive, setCompareActive] = useState<{ left: GridItem, right: GridItem } | null>(null);
  
  // Collection & Clipboard
  const [clipboardItems, setClipboardItems] = useState<GridItem[]>([]);
  const [clipboardAction, setClipboardAction] = useState<ActionType>(null);
  const [collectionBasket, setCollectionBasket] = useState<GridItem[]>([]);

  const { selectedIdsArray, selectedIds, toggleSelection, clearSelection } = useSelection<GridItem>(items, true);

  useEffect(() => {
     StorageService.getWorkspaces().then(setRecentWorkspaces);
     StorageService.getBookmarks().then(setBookmarks);
  }, []);

  const closeContext = () => setContextMenu(null);
  const currentDir = pathStack.length > 0 ? pathStack[pathStack.length - 1] : null;

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
  }, [clearSelection]);

  const refreshCurrentDirectory = useCallback(async () => {
    if (currentDir) {
       setLoading(true);
       await loadHandleContentsToUI(currentDir);
       setLoading(false);
    }
  }, [currentDir, loadHandleContentsToUI]);

  const scanAndSetDirectory = useCallback(async (handle: FileSystemDirectoryHandle, isNewRoot: boolean = false) => {
    try {
      setLoading(true);
      if (isNewRoot) {
         await StorageService.saveWorkspace(handle);
         StorageService.getWorkspaces().then(setRecentWorkspaces);

         let finalTargetHandle = handle;
         let resolvedStack: FileSystemDirectoryHandle[] = [handle];
         const rawHash = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
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
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await scanAndSetDirectory(handle, true);
    } catch (err) {}
  };

  const handleResumeWorkspace = async (ws: WorkspaceFolder) => {
     const hasPerm = await StorageService.verifyPermission(ws.handle, 'readwrite');
     if (hasPerm) await scanAndSetDirectory(ws.handle, true);
  };

  const handleNavigateUp = useCallback(() => {
    if (pathStack.length <= 1) return; 
    const newStack = [...pathStack];
    newStack.pop(); 
    const parentHandle = newStack[newStack.length - 1];
    setPathStack(newStack);
    
    setLoading(true);
    loadHandleContentsToUI(parentHandle).finally(() => setLoading(false));
    window.location.hash = '';
  }, [pathStack, loadHandleContentsToUI]);

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
      toggleSelection(id, e.shiftKey, e.metaKey || e.ctrlKey, e.altKey, () => {
         return new Promise<boolean>((resolve) => {
             setGapPrompt({ id, resolve });
         });
      });
  };

  const handleCreatePath = async (pathStr: string) => {
     setPathPromptOpen(false);
     if (!currentDir || !pathStr) return;
     try {
         setLoading(true);
         const segments = pathStr.split('/').filter(Boolean);
         let targetHandle = currentDir;
         for (const segment of segments) {
             targetHandle = await targetHandle.getDirectoryHandle(segment, { create: true });
         }
         await refreshCurrentDirectory();
     } catch (e) {
         console.error(e);
     } finally {
         setLoading(false);
     }
  };

  const executeDeleteMode = async (targetedItems: GridItem[]) => {
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
      await refreshCurrentDirectory();
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleCollectionBatch = async (action: string) => {
      if (action === 'clear') {
         setCollectionBasket([]);
      } else if (action === 'zip') {
         const zip = new JSZip();
         for (const item of collectionBasket) {
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
         for (const item of collectionBasket) {
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
     } catch (e) { console.error('Failed to copy', e); }
  };

  const selectedItem = items.find(i => {
     const id = i.type === 'file' ? i.pair.id : i.name;
     return id === selectedIdsArray.find(x => x !== null);
  });

  const parentName = currentDir ? currentDir.name : '';

  const processedGroups = useMemo(() => {
    let processable = (pathStack.length <= 1 ? items : [{ type: 'folder' as const, name: '..', handle: {} as any, lastModified: 0, size: 0 }, ...items]).filter(i => {
      const name = i.type === 'file' ? i.pair.id : i.name;
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    processable.sort((a, b) => {
      const nameA = a.type === 'file' ? a.pair.id : a.name;
      const nameB = b.type === 'file' ? b.pair.id : b.name;
      if (nameA === '..') return -1;
      if (nameB === '..') return 1;

      let result = 0;
      if (sortBy === 'type') {
         if (a.type !== b.type) result = a.type === 'folder' ? -1 : 1;
         else if (a.type === 'file' && b.type === 'file') result = (nameA.split('.').pop() || '').localeCompare(nameB.split('.').pop() || '');
      } else if (sortBy === 'date') {
         result = (a.type === 'file' ? (a.pair.lastModified || 0) : 0) - (b.type === 'file' ? (b.pair.lastModified || 0) : 0);
      } else if (sortBy === 'size') {
         result = (a.type === 'file' ? (a.pair.size || 0) : 0) - (b.type === 'file' ? (b.pair.size || 0) : 0);
      } else result = nameA.localeCompare(nameB);

      return sortAsc ? result : -result;
    });

    if (groupBy === 'none') return [{ groupName: '', items: processable }];
    
    const groupsMap: Record<string, GridItem[]> = { 'Navigation': [], 'Folders': [], 'Images': [], 'Documents': [], 'Videos': [], 'Other Files': [] };
    processable.forEach(item => {
      if (item.name === '..') groupsMap['Navigation'].push(item);
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
  }, [items, pathStack, searchQuery, sortBy, sortAsc, groupBy]);

  return (
    <div className="h-screen flex flex-col bg-dark-900 text-gray-100 font-sans overflow-hidden" onClick={closeContext}>
      <header className="h-14 border-b border-dark-700 bg-dark-800 flex items-center justify-between px-4 shrink-0 relative z-40 shadow-sm select-none">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <span className="font-bold text-white text-lg">S</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar font-medium text-sm tracking-tight scroll-smooth">
            {pathStack.length === 0 ? (
               <span className="text-lg font-semibold ml-2">Sidekick</span>
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
                     className={`hover:text-blue-400 transition-colors whitespace-nowrap px-2 py-0.5 rounded-md ${idx === pathStack.length - 1 ? 'text-gray-100 font-semibold cursor-default' : 'text-gray-400 hover:bg-dark-700'}`}
                   >
                     {handle.name}
                   </button>
                 </React.Fragment>
               ))
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 flex-none justify-center shrink-0">
          <div className="flex bg-dark-900 p-1 rounded-lg border border-dark-600 shrink-0">
             <button title="Grid View" onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={16} /></button>
             <button title="Gallery View" onClick={() => setViewMode('gallery')} className={`p-1.5 rounded-md ${viewMode === 'gallery' ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-white'}`}><Columns size={16} /></button>
             <button title="List View" onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-white'}`}><List size={16} /></button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 bg-dark-900 p-1 rounded-lg border border-dark-600 shadow-inner shrink-0">
            <label className="flex items-center gap-1 pl-2">Sort: 
              <select className="bg-transparent text-white focus:outline-none cursor-pointer" value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}>
                <option value="name" className="bg-dark-800">Name</option><option value="type" className="bg-dark-800">Type</option>
                <option value="date" className="bg-dark-800">Date</option><option value="size" className="bg-dark-800">Size</option>
              </select>
            </label>
            <button onClick={() => setSortAsc(!sortAsc)} className="p-1 text-gray-400 hover:text-white bg-dark-800 rounded-md transition-colors" title={sortAsc ? "Ascending" : "Descending"}>
              {sortAsc ? <SortAsc size={14} /> : <SortDesc size={14} />}
            </button>
            <div className="w-px h-4 bg-dark-600 mx-1"></div>
            <label className="flex items-center gap-1 pr-2">Group: 
              <select className="bg-transparent text-white focus:outline-none cursor-pointer" value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}>
                <option value="none" className="bg-dark-800">None</option><option value="type" className="bg-dark-800">Type</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2 w-full max-w-[280px] relative ml-2 shrink-0">
             <Search className="absolute left-3 w-4 h-4 text-gray-400" />
             <input type="text" placeholder="Filter..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-dark-900 border border-dark-600 rounded-lg py-1.5 pl-9 pr-8 text-sm focus:outline-none focus:border-blue-500 transition-shadow"/>
          </div>
        </div>
        
        <div className="w-80 flex justify-end gap-2">
          {currentDir && (
             <button onClick={() => setPathPromptOpen(true)} className="flex items-center gap-2 bg-dark-800 border border-dark-600 hover:bg-dark-700 px-3 py-1.5 rounded-lg text-sm text-gray-300 font-medium transition-colors truncate hidden xl:flex">
               <FolderPlus size={16} /> New Path
             </button>
          )}
          <button onClick={handleOpenRootFolder} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow shadow-blue-500/20 truncate">
            <FolderOpen size={16} /> {pathStack.length > 0 ? 'Switch Workspace' : 'Open Workspace'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {(selectedIds.size > 0 || clipboardItems.length > 0) && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-dark-800 border border-dark-600 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-2 animate-in slide-in-from-top duration-300">
             {selectedIds.size > 0 && (
                <>
                  <div className="px-4 text-sm font-bold text-white border-r border-dark-600">{selectedIds.size} Selected</div>
                  {selectedIds.size === 2 && (
                     <button onClick={() => {
                        const arr = selectedIdsArray.filter(Boolean);
                        const iL = items.find(i => (i.type === 'file' ? i.pair.id : i.name) === arr[0]);
                        const iR = items.find(i => (i.type === 'file' ? i.pair.id : i.name) === arr[1]);
                        if (iL && iR) setCompareActive({ left: iL, right: iR });
                     }} className="flex items-center gap-2 px-4 py-2 hover:bg-green-500/20 hover:text-green-400 rounded-xl text-sm font-medium transition-colors">
                        <CompareIcon size={16} /> Compare Matrix
                     </button>
                  )}
                  <button onClick={() => {
                     setClipboardItems(items.filter(i => selectedIds.has(i.type === 'file' ? i.pair.id : i.name)));
                     setClipboardAction('copy');
                     clearSelection();
                  }} className="flex items-center gap-2 px-4 py-2 hover:bg-dark-700 rounded-xl text-sm font-medium transition-colors">
                    <Copy size={16} /> Copy
                  </button>
                  <button onClick={() => setDeleteModalOpen(true)} className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/20 hover:text-red-400 rounded-xl text-sm font-medium transition-colors">
                    <Trash2 size={16} /> Delete
                  </button>
                </>
             )}
          </div>
        )}

        <main className="flex-1 flex flex-col bg-dark-900 relative overflow-hidden w-full h-full">
          {loading ? (
             <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-10 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium text-blue-400">Processing...</span>
                </div>
             </div>
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
          ) : viewMode === 'gallery' ? (
            <GalleryView
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
            />
          )}
        </main>

        <InspectorPanel 
           isOpen={true} 
           selectedItem={selectedItem} 
           collection={collectionBasket} 
           bookmarks={bookmarks}
           onRemoveFromCollection={(id) => setCollectionBasket(prev => prev.filter(i => (i.type === 'file' ? i.pair.id : i.name) !== id))}
           onCollectionBatchAction={handleCollectionBatch}
           onRemoveBookmark={async (id) => { const bk = await StorageService.removeBookmark(id); setBookmarks(bk); }}
           onOpenBookmark={handleResumeWorkspace}
        />
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
                  const bk = await StorageService.saveBookmark(contextMenu.item.handle as any);
                  setBookmarks(bk);
                  closeContext();
               }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-yellow-600 hover:text-white transition-colors text-left border-b border-dark-700 pb-2 mb-1">
                  <Bookmark size={14}/> Bookmark Folder
               </button>
            )}
            <button onClick={() => { setCollectionBasket(prev => { if (!prev.find(i => i === contextMenu.item)) return [...prev, contextMenu.item]; return prev; }); closeContext(); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-200 hover:bg-blue-600 hover:text-white transition-colors text-left"><BoxSelect size={14}/> Add to Collection</button>
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

      {previewItem && <PreviewModal item={previewItem.item} forceText={previewItem.forceText} onClose={() => setPreviewItem(null)} />}
      
      {compareActive && compareActive.left.type === 'file' && compareActive.right.type === 'file' && (
         <CompareModal itemLeft={compareActive.left} itemRight={compareActive.right} onClose={() => setCompareActive(null)} />
      )}

      {compareActive && compareActive.left.type === 'folder' && compareActive.right.type === 'folder' && (
         <FolderDiffModal handleLeft={compareActive.left.handle as any} handleRight={compareActive.right.handle as any} onClose={() => setCompareActive(null)} />
      )}
    </div>
  );
}

export default App;
