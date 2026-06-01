import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, GitCompare, ArrowLeft, ArrowRight, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react';

interface FolderDiffModalProps {
  handleLeft: FileSystemDirectoryHandle;
  handleRight: FileSystemDirectoryHandle;
  onClose: () => void;
}

type DiffItem = {
  name: string;
  isFolder: boolean;
  state: 'added' | 'removed' | 'modified' | 'unchanged';
  sizeL?: number;
  sizeR?: number;
  dateL?: number;
  dateR?: number;
  handleL?: FileSystemHandle;
  handleR?: FileSystemHandle;
  parentHandleL?: FileSystemDirectoryHandle;
  parentHandleR?: FileSystemDirectoryHandle;
  relativePath?: string;
};

const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '--';
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const isIgnoredFile = (name: string) => {
  return name === '.DS_Store' || name === 'Thumbs.db' || name === '.git';
};

const copyFile = async (
  srcHandle: FileSystemFileHandle,
  srcParent: FileSystemDirectoryHandle,
  destRootDirHandle: FileSystemDirectoryHandle,
  relativePath: string
) => {
  const file = await srcHandle.getFile();
  const segments = relativePath.split('/');
  const fileName = segments.pop()!;
  
  let destParentDir = destRootDirHandle;
  for (const segment of segments) {
    destParentDir = await destParentDir.getDirectoryHandle(segment, { create: true });
  }
  
  // Write main file
  const targetFileHandle = await destParentDir.getFileHandle(fileName, { create: true });
  const writable = await targetFileHandle.createWritable();
  await writable.write(file);
  await writable.close();

  // Write sidecar metadata if exists
  try {
    const sidecarName = `.${fileName}.json`;
    const srcSidecarHandle = await srcParent.getFileHandle(sidecarName);
    const sidecarFile = await srcSidecarHandle.getFile();
    const destSidecarHandle = await destParentDir.getFileHandle(sidecarName, { create: true });
    const sidecarWritable = await destSidecarHandle.createWritable();
    await sidecarWritable.write(sidecarFile);
    await sidecarWritable.close();
  } catch (e) {
    // Sidecar doesn't exist or is unreadable; skip silently
  }
};

export function FolderDiffModal({ handleLeft, handleRight, onClose }: FolderDiffModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [viewMode, setViewMode] = useState<'unified' | 'side'>('side');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; filename: string } | null>(null);

  // Overwrite prompt state
  const [overwritePrompt, setOverwritePrompt] = useState<{
    filename: string;
    direction: 'L2R' | 'R2L';
    resolve: (decision: { action: 'overwrite' | 'skip'; applyToAll: boolean }) => void;
  } | null>(null);

  // Bulk preview state
  const [previewPrompt, setPreviewPrompt] = useState<{
    tasks: { item: DiffItem; direction: 'L2R' | 'R2L' }[];
    resolve: (proceed: boolean) => void;
  } | null>(null);

  useEffect(() => {
    let isActive = true;
    (async () => {
       try {
          setLoading(true);
          const mapLeft = new Map<string, { f: FileSystemHandle, s?: number, d?: number, relativePath: string, parentDir: FileSystemDirectoryHandle }>();
          const mapRight = new Map<string, { f: FileSystemHandle, s?: number, d?: number, relativePath: string, parentDir: FileSystemDirectoryHandle }>();

          // Recursive walker
          const walkDirectory = async (
            dir: FileSystemDirectoryHandle,
            currentPath: string,
            map: Map<string, any>,
            parent: FileSystemDirectoryHandle
          ) => {
            // @ts-ignore
            for await (const [name, entry] of dir.entries()) {
              if (isIgnoredFile(name)) continue;
              const relPath = currentPath ? `${currentPath}/${name}` : name;
              map.set(relPath, { f: entry, relativePath: relPath, parentDir: parent });
              if (entry.kind === 'directory') {
                await walkDirectory(entry as FileSystemDirectoryHandle, relPath, map, entry as FileSystemDirectoryHandle);
              }
            }
          };

          // Walk Left and Right
          await Promise.all([
             walkDirectory(handleLeft, '', mapLeft, handleLeft),
             walkDirectory(handleRight, '', mapRight, handleRight)
          ]);

          // Load File Meta in parallel batches
          const loadMeta = async (map: Map<string, any>) => {
              const items = Array.from(map.values()).filter(val => val.f.kind === 'file');
              const batchSize = 15;
              for (let i = 0; i < items.length; i += batchSize) {
                  const batch = items.slice(i, i + batchSize);
                  await Promise.all(batch.map(async (val) => {
                      try {
                          const file = await (val.f as FileSystemFileHandle).getFile();
                          val.s = file.size;
                          val.d = file.lastModified;
                      } catch(e) {}
                  }));
              }
          };

          await Promise.all([loadMeta(mapLeft), loadMeta(mapRight)]);

          if (!isActive) return;

          const results: DiffItem[] = [];
          
          // Compare Left -> Right
          for (const [relPath, valL] of mapLeft.entries()) {
             const valR = mapRight.get(relPath);
             const isFolder = valL.f.kind === 'directory';

             if (!valR) {
                 results.push({
                   name: relPath,
                   isFolder,
                   state: 'removed',
                   sizeL: valL.s,
                   dateL: valL.d,
                   handleL: valL.f,
                   parentHandleL: valL.parentDir,
                   relativePath: relPath
                 });
             } else {
                 const isFolderR = valR.f.kind === 'directory';
                 if (isFolder || isFolderR) {
                     if (isFolder && isFolderR) {
                         results.push({
                           name: relPath,
                           isFolder: true,
                           state: 'unchanged',
                           handleL: valL.f,
                           handleR: valR.f,
                           parentHandleL: valL.parentDir,
                           parentHandleR: valR.parentDir,
                           relativePath: relPath
                         });
                     } else {
                         results.push({
                           name: relPath,
                           isFolder: true,
                           state: 'modified',
                           sizeL: valL.s,
                           sizeR: valR.s,
                           dateL: valL.d,
                           dateR: valR.d,
                           handleL: valL.f,
                           handleR: valR.f,
                           parentHandleL: valL.parentDir,
                           parentHandleR: valR.parentDir,
                           relativePath: relPath
                         });
                     }
                 } else {
                     if (valL.s !== valR.s || valL.d !== valR.d) {
                         results.push({
                           name: relPath,
                           isFolder: false,
                           state: 'modified',
                           sizeL: valL.s,
                           sizeR: valR.s,
                           dateL: valL.d,
                           dateR: valR.d,
                           handleL: valL.f,
                           handleR: valR.f,
                           parentHandleL: valL.parentDir,
                           parentHandleR: valR.parentDir,
                           relativePath: relPath
                         });
                     } else {
                         results.push({
                           name: relPath,
                           isFolder: false,
                           state: 'unchanged',
                           sizeL: valL.s,
                           sizeR: valR.s,
                           handleL: valL.f,
                           handleR: valR.f,
                           parentHandleL: valL.parentDir,
                           parentHandleR: valR.parentDir,
                           relativePath: relPath
                         });
                     }
                 }
                 mapRight.delete(relPath); // mark handled
             }
          }

          // Anything remaining in Right was Added
          for (const [relPath, valR] of mapRight.entries()) {
             results.push({
               name: relPath,
               isFolder: valR.f.kind === 'directory',
               state: 'added',
               sizeR: valR.s,
               dateR: valR.d,
               handleR: valR.f,
               parentHandleR: valR.parentDir,
               relativePath: relPath
             });
          }

          // Sort by Folder -> Name
          results.sort((a,b) => {
             if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
             return a.name.localeCompare(b.name);
          });

          setDiffs(results);
       } catch(e) { console.error(e); }
       finally { if (isActive) setLoading(false); }
    })();
    return () => { isActive = false; };
  }, [handleLeft, handleRight, refreshTrigger]);

  const promptOverwrite = (item: DiffItem, direction: 'L2R' | 'R2L') => {
     return new Promise<{ action: 'overwrite' | 'skip'; applyToAll: boolean }>((resolve) => {
        setOverwritePrompt({ filename: item.name, direction, resolve });
     });
  };

  const promptPreview = (tasks: { item: DiffItem; direction: 'L2R' | 'R2L' }[]) => {
     return new Promise<boolean>((resolve) => {
        setPreviewPrompt({ tasks, resolve });
     });
  };

  const runTransfer = async (tasks: { item: DiffItem; direction: 'L2R' | 'R2L' }[]) => {
     if (tasks.length === 0) return;
     
     if (tasks.length > 20) {
        const proceed = await promptPreview(tasks);
        if (!proceed) return;
     }

     setSyncing(true);
     setSyncProgress({ current: 0, total: tasks.length, filename: '' });

     try {
        let applyToAllDecision: 'overwrite' | 'skip' | null = null;
        let completed = 0;

        for (const task of tasks) {
           const { item, direction } = task;
           setSyncProgress({ current: completed + 1, total: tasks.length, filename: item.name });

           let shouldCopy = true;
           const isOverwrite = item.state === 'modified';

           if (isOverwrite) {
              if (applyToAllDecision === 'skip') {
                 shouldCopy = false;
              } else if (applyToAllDecision === 'overwrite') {
                 shouldCopy = true;
              } else {
                 const res = await promptOverwrite(item, direction);
                 if (res.applyToAll) {
                    applyToAllDecision = res.action;
                 }
                 shouldCopy = res.action === 'overwrite';
              }
           }

           if (shouldCopy) {
              const srcHandle = direction === 'L2R' ? item.handleL : item.handleR;
              const srcParent = direction === 'L2R' ? item.parentHandleL : item.parentHandleR;
              const destRoot = direction === 'L2R' ? handleRight : handleLeft;

              if (srcHandle && srcParent && srcHandle.kind === 'file') {
                 await copyFile(srcHandle as FileSystemFileHandle, srcParent, destRoot, item.relativePath || item.name);
              }
           }
           completed++;
        }
     } catch (err) {
        console.error('Transfer failed:', err);
        alert('Transfer failed: ' + (err as any)?.message);
     } finally {
        setSyncing(false);
        setSyncProgress(null);
        setRefreshTrigger(prev => prev + 1);
     }
  };

  const handleCopyItem = async (item: DiffItem, direction: 'L2R' | 'R2L') => {
     if (item.isFolder) {
        const prefix = item.name + '/';
        const eligibleStates = direction === 'L2R' ? ['removed', 'modified'] : ['added', 'modified'];
        const childTasks = diffs
           .filter(d => !d.isFolder && d.name.startsWith(prefix) && eligibleStates.includes(d.state))
           .map(d => ({ item: d, direction }));
        
        if (childTasks.length === 0) {
           alert("No items in this folder need copying.");
           return;
        }
        await runTransfer(childTasks);
     } else {
        await runTransfer([{ item, direction }]);
     }
  };

  const handleSyncMissing = async () => {
     const tasks: { item: DiffItem; direction: 'L2R' | 'R2L' }[] = [];
     for (const d of diffs) {
        if (!d.isFolder) {
           if (d.state === 'removed') {
              tasks.push({ item: d, direction: 'L2R' });
           } else if (d.state === 'added') {
              tasks.push({ item: d, direction: 'R2L' });
           }
        }
     }
     
     if (tasks.length === 0) {
        alert("No missing files found to sync.");
        return;
     }
     await runTransfer(tasks);
  };

  const stateColors = {
      'added': 'text-green-400 bg-green-500/10 border-green-500/20',
      'removed': 'text-red-400 bg-red-500/10 border-red-500/20',
      'modified': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      'unchanged': 'text-gray-400 bg-dark-900 border-dark-700 opacity-50'
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-dark-800 border border-dark-600 shadow-2xl rounded-2xl w-full max-w-5xl h-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-900 shrink-0">
          <div className="flex items-center gap-6">
             <h2 className="flex items-center gap-3 font-semibold text-lg text-gray-100">
                <GitCompare size={20} className="text-blue-400" />
                {t('folderDiff.title')}
                <span className="text-gray-400 px-2 py-0.5 bg-dark-950 rounded text-sm font-mono border border-dark-700">{handleLeft.name}</span>
                <span className="text-gray-600 text-sm">{t('folderDiff.vs')}</span>
                <span className="text-gray-400 px-2 py-0.5 bg-dark-950 rounded text-sm font-mono border border-dark-700">{handleRight.name}</span>
             </h2>

             <div className="flex bg-dark-950 p-1 rounded-lg border border-dark-700 shadow-inner">
                <button onClick={() => setViewMode('unified')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'unified' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                  {t('folderDiff.unified')}
                </button>
                <button onClick={() => setViewMode('side')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'side' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                  {t('folderDiff.sideBySide')}
                </button>
             </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
             <button
                onClick={handleSyncMissing}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
                title="Sync missing files between folders"
             >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {t('folderDiff.syncMissing') || 'Sync Missing'}
             </button>
             
             <button onClick={onClose} className="p-2 bg-dark-800 border border-dark-700 hover:bg-dark-700 rounded-full transition-colors">
               <X size={20} className="text-gray-300" />
             </button>
          </div>
        </div>

        <div className="flex-1 w-full overflow-hidden bg-dark-950 flex flex-col relative">
           {/* Progress overlay */}
           {syncing && syncProgress && (
              <div className="absolute inset-0 bg-black/75 z-[180] flex items-center justify-center backdrop-blur-sm">
                 <div className="flex flex-col items-center max-w-md w-full px-6">
                    <RefreshCw size={40} className="text-indigo-400 animate-spin mb-4" />
                    <h3 className="font-semibold text-lg text-white mb-2">Syncing Files...</h3>
                    <p className="text-sm text-gray-400 mb-6 text-center truncate w-full px-4 font-mono">
                       {syncProgress.filename ? syncProgress.filename : 'Starting transfer...'}
                    </p>
                    
                    <div className="w-full bg-dark-950 rounded-full h-3 border border-dark-700 overflow-hidden relative">
                       <div 
                          className="bg-indigo-500 h-full rounded-full transition-all duration-150"
                          style={{ width: `${syncProgress.total ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
                       />
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-2">
                       {syncProgress.current} / {syncProgress.total} files completed ({syncProgress.total ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%)
                    </div>
                 </div>
              </div>
           )}

           {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <span className="text-sm font-medium text-blue-400">{t('folderDiff.scanning')}</span>
              </div>
           ) : (
              <div className="flex-1 overflow-auto px-4 pb-4">
                 
                 {viewMode === 'unified' ? (
                      <>
                          <div className="grid grid-cols-[minmax(200px,1fr)_120px_80px_100px_100px_150px_150px] gap-2 mb-2 px-4 pt-4 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 border-b border-dark-700 sticky top-0 bg-dark-950 z-20">
                             <div>{t('folderDiff.filename')}</div>
                             <div>{t('folderDiff.state')}</div>
                             <div className="text-center">Actions</div>
                             <div>{t('folderDiff.sizeL')}</div>
                             <div>{t('folderDiff.sizeR')}</div>
                             <div>{t('folderDiff.dateL')}</div>
                             <div>{t('folderDiff.dateR')}</div>
                          </div>
         
                          <div className="flex flex-col gap-1">
                             {diffs.map((d, i) => (
                                <div key={i} className={`grid grid-cols-[minmax(200px,1fr)_120px_80px_100px_100px_150px_150px] gap-2 px-4 py-2 text-sm items-center border rounded-lg ${stateColors[d.state]}`}>
                                   <div className="truncate font-medium flex items-center gap-2" title={d.name}>
                                      <span className="shrink-0">{d.isFolder ? '📁' : '📄'}</span>
                                      <span className="truncate font-mono text-xs">{d.name}</span>
                                   </div>
                                   <div className="font-bold tracking-wide text-xs uppercase">{t(`folderDiff.states.${d.state}`)}</div>
                                   
                                   {/* Copy Actions */}
                                   <div className="flex justify-center gap-1">
                                      {d.state === 'removed' && (
                                         <button 
                                            onClick={() => handleCopyItem(d, 'L2R')}
                                            className="p-1 hover:bg-blue-600/35 hover:text-blue-300 rounded text-blue-400 transition-colors"
                                            title="Copy to Right"
                                         >
                                            <ArrowRight size={14} />
                                         </button>
                                      )}
                                      {d.state === 'added' && (
                                         <button 
                                            onClick={() => handleCopyItem(d, 'R2L')}
                                            className="p-1 hover:bg-green-600/35 hover:text-green-300 rounded text-green-400 transition-colors"
                                            title="Copy to Left"
                                         >
                                            <ArrowLeft size={14} />
                                         </button>
                                      )}
                                      {d.state === 'modified' && (
                                         <>
                                            <button 
                                               onClick={() => handleCopyItem(d, 'L2R')}
                                               className="p-1 hover:bg-blue-600/35 hover:text-blue-300 rounded text-blue-400 transition-colors"
                                               title="Copy Left → Right (Overwrite)"
                                            >
                                               <ArrowRight size={14} />
                                            </button>
                                            <button 
                                               onClick={() => handleCopyItem(d, 'R2L')}
                                               className="p-1 hover:bg-green-600/35 hover:text-green-300 rounded text-green-400 transition-colors"
                                               title="Copy Right → Left (Overwrite)"
                                            >
                                               <ArrowLeft size={14} />
                                            </button>
                                         </>
                                      )}
                                   </div>

                                   <div className="font-mono text-xs">{formatBytes(d.sizeL)}</div>
                                   <div className="font-mono text-xs">{formatBytes(d.sizeR)}</div>
                                   <div className="font-mono text-xs truncate" title={d.dateL ? new Date(d.dateL).toLocaleString() : ''}>{d.dateL ? new Date(d.dateL).toLocaleDateString() : '--'}</div>
                                   <div className="font-mono text-xs truncate" title={d.dateR ? new Date(d.dateR).toLocaleString() : ''}>{d.dateR ? new Date(d.dateR).toLocaleDateString() : '--'}</div>
                                </div>
                             ))}
                          </div>
                      </>
                  ) : (
                      <>
                          <div className="flex gap-2 mb-2 px-4 pt-4 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 border-b border-dark-700 sticky top-0 bg-dark-950 z-20 items-center">
                             <div className="flex-1 flex justify-between px-2 min-w-0">
                                 <span className="truncate mr-2">{handleLeft.name}</span>
                                 <span className="shrink-0">{t('folderDiff.sizeAndDate')}</span>
                             </div>
                             <div className="w-16 text-center shrink-0">Actions</div>
                             <div className="flex-1 flex justify-between px-2 min-w-0">
                                 <span className="truncate mr-2">{handleRight.name}</span>
                                 <span className="shrink-0">{t('folderDiff.sizeAndDate')}</span>
                             </div>
                          </div>
                          <div className="flex flex-col gap-1">
                             {diffs.map((d, i) => {
                                const hasL = d.state === 'removed' || d.state === 'modified' || d.state === 'unchanged';
                                const hasR = d.state === 'added' || d.state === 'modified' || d.state === 'unchanged';
 
                                const bgL = d.state === 'removed' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                            d.state === 'modified' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                            d.state === 'unchanged' ? 'bg-dark-900 border-dark-700 text-gray-400 opacity-50' :
                                            'bg-transparent border-transparent';
 
                                const bgR = d.state === 'added' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                                            d.state === 'modified' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                            d.state === 'unchanged' ? 'bg-dark-900 border-dark-700 text-gray-400 opacity-50' :
                                            'bg-transparent border-transparent';
 
                                return (
                                   <div key={i} className="flex gap-2 w-full min-h-[38px] items-center animate-in fade-in duration-100">
                                      {/* Left Card */}
                                      <div className={`flex-1 flex items-center justify-between px-4 py-1.5 border rounded-lg overflow-hidden min-w-0 ${bgL}`}>
                                         {hasL && (
                                            <>
                                               <div className="flex items-center gap-2 text-sm min-w-0 mr-4">
                                                   <span className="shrink-0">{d.isFolder ? '📁' : '📄'}</span> 
                                                   <span className="truncate font-medium font-mono text-xs" title={d.name}>{d.name}</span>
                                               </div>
                                               <div className="flex items-center gap-3 font-mono text-[11px] opacity-80 shrink-0 whitespace-nowrap">
                                                   <span className="w-20 text-right">{formatBytes(d.sizeL)}</span>
                                                   <span className="w-24 text-right">{d.dateL ? new Date(d.dateL).toLocaleDateString() : '--'}</span>
                                               </div>
                                            </>
                                         )}
                                      </div>

                                      {/* Copy Action Column (Middle) */}
                                      <div className="w-16 flex justify-center gap-1 shrink-0">
                                         {d.state === 'removed' && (
                                            <button 
                                               onClick={() => handleCopyItem(d, 'L2R')}
                                               className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded border border-blue-500/30 transition-colors"
                                               title="Copy to Right"
                                            >
                                               <ArrowRight size={13} />
                                            </button>
                                         )}
                                         {d.state === 'added' && (
                                            <button 
                                               onClick={() => handleCopyItem(d, 'R2L')}
                                               className="p-1.5 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white rounded border border-green-500/30 transition-colors"
                                               title="Copy to Left"
                                            >
                                               <ArrowLeft size={13} />
                                            </button>
                                         )}
                                         {d.state === 'modified' && (
                                            <>
                                               <button 
                                                  onClick={() => handleCopyItem(d, 'L2R')}
                                                  className="p-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded border border-blue-500/30 transition-colors"
                                                  title="Copy Left → Right (Overwrite)"
                                               >
                                                  <ArrowRight size={12} />
                                               </button>
                                               <button 
                                                  onClick={() => handleCopyItem(d, 'R2L')}
                                                  className="p-1 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white rounded border border-green-500/30 transition-colors"
                                                  title="Copy Right → Left (Overwrite)"
                                               >
                                                  <ArrowLeft size={12} />
                                               </button>
                                            </>
                                         )}
                                      </div>

                                      {/* Right Card */}
                                      <div className={`flex-1 flex items-center justify-between px-4 py-1.5 border rounded-lg overflow-hidden min-w-0 ${bgR}`}>
                                         {hasR && (
                                            <>
                                               <div className="flex items-center gap-2 text-sm min-w-0 mr-4">
                                                   <span className="shrink-0">{d.isFolder ? '📁' : '📄'}</span> 
                                                   <span className="truncate font-medium font-mono text-xs" title={d.name}>{d.name}</span>
                                               </div>
                                               <div className="flex items-center gap-3 font-mono text-[11px] opacity-80 shrink-0 whitespace-nowrap">
                                                   <span className="w-20 text-right">{formatBytes(d.sizeR)}</span>
                                                   <span className="w-24 text-right">{d.dateR ? new Date(d.dateR).toLocaleDateString() : '--'}</span>
                                               </div>
                                            </>
                                         )}
                                      </div>
                                   </div>
                                )
                             })}
                          </div>
                      </>
                  )}

              </div>
           )}
        </div>
      </div>

      {/* Overwrite Confirmation Dialog */}
      {overwritePrompt && (
         <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative bg-dark-800 border border-dark-600 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
               <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-700 bg-yellow-500/10">
                  <AlertTriangle size={24} className="text-yellow-400 shrink-0" />
                  <h3 className="font-semibold text-lg text-yellow-400 truncate">Confirm Overwrite</h3>
               </div>
               
               <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-300">
                     The following file already exists at the destination and will be replaced:
                  </p>
                  <p className="text-xs font-mono bg-dark-900 border border-dark-700 p-3 rounded text-gray-300 break-all select-all">
                     {overwritePrompt.filename}
                  </p>
                  
                  <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer pt-2 select-none">
                     <input 
                        type="checkbox" 
                        id="apply-to-all-checkbox"
                        className="w-4 h-4 rounded bg-dark-905 border-dark-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                     />
                     <span>Do the same for all remaining conflicts</span>
                  </label>
               </div>
               
               <div className="flex items-center justify-end gap-3 px-6 py-4 bg-dark-900/50 border-t border-dark-700">
                  <button 
                     onClick={() => {
                        const chk = document.getElementById('apply-to-all-checkbox') as HTMLInputElement;
                        overwritePrompt.resolve({ action: 'skip', applyToAll: chk?.checked || false });
                        setOverwritePrompt(null);
                     }}
                     className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
                  >
                     Skip
                  </button>
                  <button 
                     onClick={() => {
                        const chk = document.getElementById('apply-to-all-checkbox') as HTMLInputElement;
                        overwritePrompt.resolve({ action: 'overwrite', applyToAll: chk?.checked || false });
                        setOverwritePrompt(null);
                     }}
                     className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors"
                  >
                     Overwrite
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Bulk Preview Dialog */}
      {previewPrompt && (
         <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative bg-dark-800 border border-dark-600 shadow-2xl rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
               <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-700 bg-indigo-500/10 shrink-0">
                  <AlertCircle size={24} className="text-indigo-400 shrink-0" />
                  <h3 className="font-semibold text-lg text-indigo-400">Confirm Operations ({previewPrompt.tasks.length} files)</h3>
               </div>
               
               <div className="p-6 flex-1 overflow-hidden flex flex-col min-h-0">
                  <p className="text-sm text-gray-300 mb-4 shrink-0">
                     You are about to transfer <span className="font-bold text-white">{previewPrompt.tasks.length}</span> files. Please review the details below:
                  </p>
                  
                  <div className="flex-1 min-h-0 overflow-y-auto border border-dark-700 rounded-lg bg-dark-900 p-2 font-mono text-xs text-gray-400 scrollbar-thin">
                     {previewPrompt.tasks.slice(0, 1000).map((t, idx) => (
                        <div key={idx} className="flex justify-between items-center py-1.5 border-b border-dark-800 last:border-b-0 px-2 hover:bg-dark-850/50 transition-colors">
                           <span className="truncate mr-4 text-gray-300 flex items-center gap-2" title={t.item.name}>
                              <span className="shrink-0">{t.item.isFolder ? '📁' : '📄'}</span>
                              <span className="truncate">{t.item.name}</span>
                           </span>
                           <span className="shrink-0 flex items-center gap-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-sans uppercase font-bold ${
                                 t.item.state === 'modified' ? 'bg-yellow-500/20 text-yellow-400' :
                                 t.item.state === 'added' ? 'bg-green-500/20 text-green-400' :
                                 'bg-blue-500/20 text-blue-400'
                              }`}>
                                 {t.item.state === 'modified' ? 'Overwrite' : 'New'}
                              </span>
                              <span className="text-[10px] text-gray-500">
                                 ({t.direction === 'L2R' ? 'L → R' : 'R → L'})
                              </span>
                           </span>
                        </div>
                     ))}
                     {previewPrompt.tasks.length > 1000 && (
                        <div className="py-2 text-center text-gray-500 font-sans italic text-xs border-t border-dark-800">
                           Showing first 1,000 files... (+ {previewPrompt.tasks.length - 1000} more)
                        </div>
                     )}
                  </div>
               </div>
               
               <div className="flex items-center justify-end gap-3 px-6 py-4 bg-dark-900/50 border-t border-dark-700 shrink-0">
                  <button 
                     onClick={() => {
                        previewPrompt.resolve(false);
                        setPreviewPrompt(null);
                     }}
                     className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
                  >
                     Cancel
                  </button>
                  <button 
                     onClick={() => {
                        previewPrompt.resolve(true);
                        setPreviewPrompt(null);
                     }}
                     className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
                  >
                     Proceed
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
