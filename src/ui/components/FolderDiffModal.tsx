import { useEffect, useState } from 'react';
import { X, GitCompare } from 'lucide-react';

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
};

const formatBytes = (bytes?: number) => {
    if (bytes === undefined) return '--';
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export function FolderDiffModal({ handleLeft, handleRight, onClose }: FolderDiffModalProps) {
  const [loading, setLoading] = useState(true);
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [viewMode, setViewMode] = useState<'unified' | 'side'>('side');

  useEffect(() => {
    let isActive = true;
    (async () => {
       try {
          const mapLeft = new Map<string, { f: FileSystemHandle, s?: number, d?: number }>();
          const mapRight = new Map<string, { f: FileSystemHandle, s?: number, d?: number }>();

          // Pass 1: Gather handles
          // @ts-ignore
          for await (const [name, entry] of handleLeft.entries()) mapLeft.set(name, { f: entry });
          // @ts-ignore
          for await (const [name, entry] of handleRight.entries()) mapRight.set(name, { f: entry });

          // Pass 2: Extract File logic
          const loadMeta = async (map: Map<string, any>) => {
              for (const val of map.values()) {
                  if (val.f.kind === 'file') {
                     try {
                        const file = await (val.f as FileSystemFileHandle).getFile();
                        val.s = file.size;
                        val.d = file.lastModified;
                     } catch(e) {}
                  }
              }
          };

          await Promise.all([loadMeta(mapLeft), loadMeta(mapRight)]);

          if (!isActive) return;

          const results: DiffItem[] = [];
          
          // Compare Left -> Right
          for (const [name, valL] of mapLeft.entries()) {
             const valR = mapRight.get(name);
             if (!valR) {
                 results.push({ name, isFolder: valL.f.kind === 'directory', state: 'removed', sizeL: valL.s, dateL: valL.d });
             } else {
                 if (valL.f.kind === 'directory' || valR.f.kind === 'directory') {
                     results.push({ name, isFolder: true, state: 'unchanged' }); // folder deep diffs skipped
                 } else {
                     if (valL.s !== valR.s || valL.d !== valR.d) {
                         results.push({ name, isFolder: false, state: 'modified', sizeL: valL.s, sizeR: valR.s, dateL: valL.d, dateR: valR.d });
                     } else {
                         results.push({ name, isFolder: false, state: 'unchanged', sizeL: valL.s, sizeR: valR.s });
                     }
                 }
                 mapRight.delete(name); // mark handled
             }
          }

          // Anything remaining in Right was Added
          for (const [name, valR] of mapRight.entries()) {
             results.push({ name, isFolder: valR.f.kind === 'directory', state: 'added', sizeR: valR.s, dateR: valR.d });
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
  }, [handleLeft, handleRight]);

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
                Folder Diff: 
                <span className="text-gray-400 px-2 py-0.5 bg-dark-950 rounded text-sm font-mono border border-dark-700">{handleLeft.name}</span>
                <span className="text-gray-600 text-sm">vs</span>
                <span className="text-gray-400 px-2 py-0.5 bg-dark-950 rounded text-sm font-mono border border-dark-700">{handleRight.name}</span>
             </h2>

             <div className="flex bg-dark-950 p-1 rounded-lg border border-dark-700 shadow-inner">
               <button onClick={() => setViewMode('unified')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'unified' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                 Unified
               </button>
               <button onClick={() => setViewMode('side')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'side' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                 Side-by-Side
               </button>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-dark-800 border border-dark-700 hover:bg-dark-700 rounded-full transition-colors shrink-0">
            <X size={20} className="text-gray-300" />
          </button>
        </div>

        <div className="flex-1 w-full overflow-hidden bg-dark-950 flex flex-col">
           {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <span className="text-sm font-medium text-blue-400">Deep scanning handles...</span>
              </div>
           ) : (
              <div className="flex-1 overflow-auto px-4 pb-4">
                 
                 {viewMode === 'unified' ? (
                     <>
                         <div className="grid grid-cols-[minmax(200px,1fr)_120px_100px_100px_150px_150px] gap-2 mb-2 px-4 pt-4 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 border-b border-dark-700 sticky top-0 bg-dark-950 z-20">
                            <div>Filename</div>
                            <div>State</div>
                            <div>Size (L)</div>
                            <div>Size (R)</div>
                            <div>Date (L)</div>
                            <div>Date (R)</div>
                         </div>
        
                         <div className="flex flex-col gap-1">
                            {diffs.map((d, i) => (
                               <div key={i} className={`grid grid-cols-[minmax(200px,1fr)_120px_100px_100px_150px_150px] gap-2 px-4 py-2 text-sm items-center border rounded-lg ${stateColors[d.state]}`}>
                                  <div className="truncate font-medium">{d.isFolder ? `📁 ${d.name}` : `📄 ${d.name}`}</div>
                                  <div className="font-bold tracking-wide text-xs uppercase">{d.state}</div>
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
                         <div className="flex gap-2 mb-2 px-4 pt-4 py-2 font-bold text-xs uppercase tracking-wider text-gray-500 border-b border-dark-700 sticky top-0 bg-dark-950 z-20">
                            <div className="flex-1 flex justify-between px-2 min-w-0">
                                <span className="truncate mr-2">{handleLeft.name}</span>
                                <span className="shrink-0">Size & Date</span>
                            </div>
                            <div className="flex-1 flex justify-between px-2 min-w-0">
                                <span className="truncate mr-2">{handleRight.name}</span>
                                <span className="shrink-0">Size & Date</span>
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
                                  <div key={i} className="flex gap-2 w-full min-h-[38px]">
                                     <div className={`flex-1 flex items-center justify-between px-4 py-1.5 border rounded-lg overflow-hidden ${bgL}`}>
                                         {hasL && (
                                            <>
                                               <div className="flex items-center gap-2 text-sm min-w-0 mr-4">
                                                   <span className="shrink-0">{d.isFolder ? '📁' : '📄'}</span> 
                                                   <span className="truncate font-medium">{d.name}</span>
                                               </div>
                                               <div className="flex items-center gap-3 font-mono text-[11px] opacity-80 shrink-0 whitespace-nowrap">
                                                   <span className="w-20 text-right">{formatBytes(d.sizeL)}</span>
                                                   <span className="w-24 text-right">{d.dateL ? new Date(d.dateL).toLocaleDateString() : '--'}</span>
                                               </div>
                                            </>
                                         )}
                                     </div>
                                     <div className={`flex-1 flex items-center justify-between px-4 py-1.5 border rounded-lg overflow-hidden ${bgR}`}>
                                         {hasR && (
                                            <>
                                               <div className="flex items-center gap-2 text-sm min-w-0 mr-4">
                                                   <span className="shrink-0">{d.isFolder ? '📁' : '📄'}</span> 
                                                   <span className="truncate font-medium">{d.name}</span>
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
    </div>
  );
}
