import { useState } from 'react';
import { Info, Folder as FolderIcon, FileIcon, Settings, BoxSelect, X, Bookmark } from 'lucide-react';
import { GridItem, WorkspaceFolder } from '../../core/models/FilePair';

interface InspectorPanelProps {
  selectedItem?: GridItem;
  isOpen: boolean;
  collection: GridItem[];
  bookmarks: WorkspaceFolder[];
  onRemoveFromCollection: (id: string) => void;
  onCollectionBatchAction: (action: string) => void;
  onRemoveBookmark: (id: string) => void;
  onOpenBookmark: (ws: WorkspaceFolder) => void;
}

export function InspectorPanel({ 
  selectedItem, isOpen, collection, bookmarks, 
  onRemoveFromCollection, onCollectionBatchAction, onRemoveBookmark, onOpenBookmark 
}: InspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<'inspector' | 'collection' | 'bookmarks'>('inspector');

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const renderInspector = () => {
     if (!selectedItem) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6 text-center h-full">
            <Info size={48} className="mb-4 opacity-30" />
            <p>Select an item to view properties...</p>
          </div>
        );
     }
     const isFile = selectedItem.type === 'file';
     const name = isFile ? selectedItem.pair.id : selectedItem.name;
     const size = isFile ? formatBytes(selectedItem.pair.size || 0) : '--';
     const modifiedDate = isFile && selectedItem.pair.lastModified ? new Date(selectedItem.pair.lastModified).toLocaleString() : '--';
     const meta = isFile ? selectedItem.pair.metadata : undefined;

     return (
       <div className="flex-1 overflow-y-auto p-4 space-y-6 h-full text-sm">
         <div className="flex flex-col items-center space-y-3 pb-4 border-b border-dark-700">
           <div className="w-16 h-16 rounded-xl bg-dark-900 border border-dark-600 flex items-center justify-center text-blue-500 shadow-inner">
             {isFile ? <FileIcon size={32} /> : <FolderIcon size={32} />}
           </div>
           <h3 className="font-semibold text-center break-all text-gray-200 leading-tight">{name}</h3>
         </div>

         <div className="space-y-4">
           <div>
             <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Properties</h4>
             <div className="bg-dark-900/50 rounded-lg p-3 space-y-2 border border-dark-700/50">
               <div className="flex justify-between"><span className="text-gray-500">Kind</span><span className="text-gray-300">{isFile ? 'File' : 'Folder'}</span></div>
               <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="text-gray-300">{size}</span></div>
               <div className="flex justify-between"><span className="text-gray-500">Modified</span><span className="text-gray-300">{modifiedDate}</span></div>
             </div>
           </div>

           {meta && Object.keys(meta).length > 0 && (
             <div>
               <h4 className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2"><Settings size={14} /> Sidecar Metadata</h4>
               <div className="bg-indigo-900/10 rounded-lg p-3 space-y-2 border border-indigo-500/20">
                 {Object.entries(meta).map(([k, v]) => (
                   <div key={k} className="flex flex-col"><span className="text-indigo-300/60 text-xs">{k}</span><span className="text-gray-300 font-mono text-xs break-all">{String(v)}</span></div>
                 ))}
               </div>
             </div>
           )}
         </div>
       </div>
     );
  };

  const renderCollection = () => {
      return (
         <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-dark-700 shrink-0">
               <span className="text-sm font-semibold text-blue-400">{collection.length} Items</span>
               <button onClick={() => onCollectionBatchAction('clear')} className="text-xs text-red-400 hover:text-red-300 transition-colors">Clear All</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {collection.length === 0 ? (
                   <div className="flex flex-col items-center justify-center text-gray-500 text-center h-full opacity-50">
                      <BoxSelect size={48} className="mb-4" />
                      <p className="text-sm">Collection is empty.</p>
                      <p className="text-xs mt-2">Right click items to add them here across any workspace.</p>
                   </div>
                ) : (
                   collection.map((i, idx) => {
                      const id = i.type === 'file' ? i.pair.id : i.name;
                      return (
                         <div key={id + idx} className="flex items-center justify-between bg-dark-900 border border-dark-600 rounded drop-shadow p-2 text-xs group">
                            <span className="truncate w-[200px] text-gray-300">{id}</span>
                            <button onClick={() => onRemoveFromCollection(id)} className="text-dark-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><X size={14} /></button>
                         </div>
                      );
                   })
                )}
            </div>
            {collection.length > 0 && (
               <div className="p-4 border-t border-dark-700 bg-dark-900/50 shrink-0 grid grid-cols-2 gap-2">
                  <button onClick={() => onCollectionBatchAction('zip')} className="py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white font-medium shadow-lg">ZIP Items</button>
                  <button onClick={() => onCollectionBatchAction('copy')} className="py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-medium shadow-lg">Copy to Active</button>
                  <button onClick={() => onCollectionBatchAction('move')} className="py-2 bg-dark-700 hover:bg-dark-600 rounded text-xs text-white font-medium shadow-lg col-span-2">Move to Active</button>
               </div>
            )}
         </div>
      );
  };

  const renderBookmarks = () => {
     return (
       <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center p-4 border-b border-dark-700 shrink-0">
             <span className="text-sm font-semibold text-yellow-400">Bookmarks</span>
          </div>
           <div className="flex-1 overflow-y-auto p-2 space-y-2">
             {bookmarks.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-gray-500 text-center h-full opacity-50">
                    <Bookmark size={48} className="mb-4" />
                    <p className="text-sm">No bookmarks saved.</p>
                    <p className="text-xs mt-2 text-yellow-500/80 font-medium">Right-Click to bookmark an item</p>
                 </div>
             ) : (
                bookmarks.map(bm => (
                   <div key={bm.id} className="flex items-center justify-between bg-dark-900 border border-dark-600 rounded drop-shadow p-2 text-sm group cursor-pointer hover:bg-dark-700 transition-colors" onClick={() => onOpenBookmark(bm)}>
                      <div className="flex items-center gap-2 truncate text-gray-300">
                         <FolderIcon size={16} className="text-yellow-500 shrink-0" />
                         <span className="truncate">{bm.name}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); onRemoveBookmark(bm.id); }} className="text-dark-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1">
                         <X size={14} />
                      </button>
                   </div>
                ))
             )}
          </div>
       </div>
     );
  };

  return (
    <div className={`w-80 border-l border-dark-700 flex flex-col overflow-hidden shadow-2xl transition-all duration-300 shrink-0 z-20 ${isOpen ? 'bg-dark-800' : 'w-0 opacity-0'}`}>
      
      {/* Tabs */}
      <div className="flex border-b border-dark-700 bg-dark-900 shrink-0">
          <button 
             onClick={() => setActiveTab('inspector')}
             className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${activeTab === 'inspector' ? 'text-blue-400 border-b-2 border-blue-400 bg-dark-800' : 'text-gray-500 hover:text-gray-300'}`}
          >
             <Info size={14} /> Props
          </button>
          <button 
             onClick={() => setActiveTab('bookmarks')}
             className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${activeTab === 'bookmarks' ? 'text-yellow-400 border-b-2 border-yellow-400 bg-dark-800' : 'text-gray-500 hover:text-gray-300'}`}
          >
             <Bookmark size={14} /> Marks
          </button>
          <button 
             onClick={() => setActiveTab('collection')}
             className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1 transition-colors relative ${activeTab === 'collection' ? 'text-blue-400 border-b-2 border-blue-400 bg-dark-800' : 'text-gray-500 hover:text-gray-300'}`}
          >
             <BoxSelect size={14} /> Basket
             {collection.length > 0 && (
                <span className="absolute top-2 right-2 bg-blue-500 text-white min-w-[16px] h-4 rounded-full text-[10px] flex items-center justify-center px-1 font-bold">
                   {collection.length}
                </span>
             )}
          </button>
      </div>

      {/* Pane Content */}
      <div className="flex-1 w-full h-full bg-dark-800 overflow-hidden relative">
         <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'inspector' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>{renderInspector()}</div>
         <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'bookmarks' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>{renderBookmarks()}</div>
         <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'collection' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>{renderCollection()}</div>
      </div>
    </div>
  );
}
