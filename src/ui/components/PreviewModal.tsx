import React, { useEffect, useState, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { GridItem } from '../../core/models/FilePair';

interface PreviewModalProps {
  item: GridItem | null;
  onClose: () => void;
}

export function PreviewModal({ item, onClose }: PreviewModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item || item.type !== 'file') return;
    let isActive = true;
    setLoading(true);
    setObjectUrl(null);
    setTextContent(null);
    setScale(1);

    const loadPreview = async () => {
      try {
        const file = await item.pair.mainHandle.getFile();
        if (/\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(file.name) || /\.(mp4|webm|ogg)$/i.test(file.name)) {
          const url = URL.createObjectURL(file);
          if (isActive) setObjectUrl(url);
        } else if (/\.pdf$/i.test(file.name)) {
          const url = URL.createObjectURL(file);
          if (isActive) setObjectUrl(url);
        } else if (/\.(txt|json|md|html|css|js|ts|tsx|jsx|csv)$/i.test(file.name)) {
          if (file.size > 2 * 1024 * 1024) {
            if (isActive) setTextContent(`File is too large to preview natively (${(file.size / 1024 / 1024).toFixed(2)} MB). Preview limited to 2MB.`);
            return;
          }
          const text = await file.text();
          if (isActive) setTextContent(text);
        } else {
          if (isActive) setTextContent('No native preview available for this file type.');
        }
      } catch (err) {
        if (isActive) setTextContent('Failed to load preview.');
      } finally {
        if (isActive) setLoading(false);
      }
    };
    loadPreview();
    return () => {
      isActive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item]);

  if (!item || item.type !== 'file') return null;

  const isVideo = /\.(mp4|webm|ogg)$/i.test(item.pair.id);
  const isImage = /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(item.pair.id);
  const isPdf = /\.pdf$/i.test(item.pair.id);

  const handleZoom = (delta: number) => {
     setScale(prev => Math.min(Math.max(0.1, prev + delta), 5));
  };

  const handleWheel = (e: React.WheelEvent) => {
     if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY * -0.01);
     }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-12">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-dark-900 border border-dark-700 shadow-2xl rounded-2xl w-full max-w-7xl h-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-800 shrink-0 select-none">
          <div className="flex items-center gap-4">
             <h2 className="font-semibold text-lg text-gray-100 truncate">{item.pair.id}</h2>
             {isImage && objectUrl && (
                <div className="flex items-center bg-dark-900 rounded-lg border border-dark-700 p-1">
                   <button onClick={() => handleZoom(-0.2)} className="p-1.5 hover:bg-dark-800 text-gray-400 hover:text-white rounded"><ZoomOut size={16} /></button>
                   <span className="text-xs font-mono w-12 text-center text-gray-300">{Math.round(scale * 100)}%</span>
                   <button onClick={() => handleZoom(0.2)} className="p-1.5 hover:bg-dark-800 text-gray-400 hover:text-white rounded"><ZoomIn size={16} /></button>
                   <button onClick={() => setScale(1)} className="p-1.5 hover:bg-dark-800 text-gray-400 hover:text-white rounded ml-1" title="Reset View"><Maximize size={16} /></button>
                </div>
             )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors shrink-0">
            <X size={20} className="text-gray-400 hover:text-red-400" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex items-center justify-center p-6 bg-dark-950 relative" onWheel={isImage ? handleWheel : undefined}>
          {loading && (
             <div className="absolute inset-0 flex items-center justify-center bg-dark-950 z-10">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
             </div>
          )}
          
          {objectUrl && isImage && (
            <div ref={imageContainerRef} className="w-full h-full overflow-auto flex items-center justify-center">
               <img 
                 src={objectUrl} 
                 alt={item.pair.id} 
                 style={{ transform: `scale(${scale})`, transition: scale === 1 ? 'transform 0.2s' : 'none' }}
                 className="origin-center max-w-full max-h-full object-contain cursor-move drop-shadow-2xl rounded-lg" 
               />
            </div>
          )}

          {objectUrl && isVideo && (
            <video src={objectUrl} controls autoPlay className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          )}

          {objectUrl && isPdf && (
            <iframe src={objectUrl} className="w-full h-full rounded-lg bg-white" title="PDF Preview" />
          )}

          {textContent !== null && (
            <div className="w-full h-full max-w-4xl text-left bg-dark-900 border border-dark-700 rounded-xl p-6 overflow-auto">
              <pre className="text-sm font-mono text-gray-300 w-full">{textContent}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
