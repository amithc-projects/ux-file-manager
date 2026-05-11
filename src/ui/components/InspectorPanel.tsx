import { Info, Folder as FolderIcon, FileIcon, Settings } from 'lucide-react';
import { GridItem } from '../../core/models/FilePair';

interface InspectorPanelProps {
  selectedItem?: GridItem;
  isOpen: boolean;
}

export function InspectorPanel({ selectedItem, isOpen }: InspectorPanelProps) {
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const renderContent = () => {
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

  return (
    <div className={`w-72 border-l border-dark-700 flex flex-col overflow-hidden shadow-2xl transition-all duration-300 shrink-0 z-20 ${isOpen ? 'bg-dark-800' : 'w-0 opacity-0'}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-700 bg-dark-900 shrink-0">
        <Info size={14} className="text-blue-400" />
        <span className="text-xs font-semibold text-blue-400">Properties</span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>
    </div>
  );
}
