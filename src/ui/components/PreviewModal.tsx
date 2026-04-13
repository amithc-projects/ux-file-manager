import React from 'react';
import { X } from 'lucide-react';
import { GridItem } from '../../core/models/FilePair';
import { FileViewer } from './FileViewer';

interface PreviewModalProps {
  item: GridItem;
  forceText?: boolean;
  onClose: () => void;
  onSaveNewFile?: (blob: Blob, name: string, options?: {overwriteOriginal?: boolean}) => Promise<void>;
}

export function PreviewModal({ item, forceText, onClose, onSaveNewFile }: PreviewModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (item.type !== 'file') return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" onClick={handleBackdropClick}>
      
      <div className="absolute top-4 right-4 flex items-center gap-4 z-50">
        <button onClick={onClose} className="p-3 bg-dark-800/80 hover:bg-dark-700/80 rounded-full transition-colors text-gray-300 hover:text-white border border-dark-600/50 shadow-2xl">
          <X size={24} />
        </button>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-dark-900/80 border border-dark-700 shadow-2xl backdrop-blur-lg rounded-2xl pointer-events-none z-50">
        <div className="flex flex-col items-center">
            <span className="text-gray-100 font-bold tracking-wide truncate max-w-[60vw]">{item.pair.id}</span>
            {item.pair.size && <span className="text-xs text-gray-400 font-mono mt-0.5">{(item.pair.size / 1024 / 1024).toFixed(2)} MB</span>}
        </div>
      </div>

      <div className="relative w-full max-w-6xl h-[85vh] flex items-center justify-center bg-dark-900 border border-dark-700 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.8)] overflow-hidden">
          <FileViewer item={item} forceText={forceText} onSaveNewFile={onSaveNewFile} />
      </div>

    </div>
  );
}
