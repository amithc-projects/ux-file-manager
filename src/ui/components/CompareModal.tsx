import React, { useState, useEffect } from 'react';
import { X, Columns, MoveHorizontal } from 'lucide-react';
import { GridItem } from '../../core/models/FilePair';

interface CompareModalProps {
  itemLeft: GridItem;
  itemRight: GridItem;
  onClose: () => void;
}

export function CompareModal({ itemLeft, itemRight, onClose }: CompareModalProps) {
  const [mode, setMode] = useState<'side' | 'slider'>('slider');
  const [sliderPos, setSliderPos] = useState(50);
  
  const [urlLeft, setUrlLeft] = useState<string | null>(null);
  const [urlRight, setUrlRight] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    (async () => {
      if (itemLeft.type === 'file') {
         const file = await itemLeft.pair.mainHandle.getFile();
         if (isActive) setUrlLeft(URL.createObjectURL(file));
      }
      if (itemRight.type === 'file') {
         const file = await itemRight.pair.mainHandle.getFile();
         if (isActive) setUrlRight(URL.createObjectURL(file));
      }
    })();
    return () => {
      isActive = false;
      if (urlLeft) URL.revokeObjectURL(urlLeft);
      if (urlRight) URL.revokeObjectURL(urlRight);
    };
  }, [itemLeft, itemRight]);

  const nameLeft = itemLeft.type === 'file' ? itemLeft.pair.id : 'Folder';
  const nameRight = itemRight.type === 'file' ? itemRight.pair.id : 'Folder';

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-dark-950 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-900 shrink-0 select-none">
        <div className="flex items-center gap-6">
           <h2 className="font-semibold text-lg text-gray-100">Comparison Engine</h2>
           
           <div className="flex bg-dark-950 p-1 rounded-lg border border-dark-700 shadow-inner">
             <button title="Slider Mode" onClick={() => setMode('slider')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'slider' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
               <MoveHorizontal size={14} /> Slider Wipe
             </button>
             <button title="Side-by-Side Mode" onClick={() => setMode('side')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'side' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
               <Columns size={14} /> Side by Side
             </button>
           </div>
        </div>

        <button onClick={onClose} className="p-2 bg-dark-800 border border-dark-700 hover:bg-dark-700 rounded-full transition-colors shrink-0">
          <X size={20} className="text-gray-300" />
        </button>
      </div>

      {/* Viewport Workspace */}
      <div className="flex-1 w-full relative overflow-hidden bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQYlWNgYGCQwoKxgqGgcJA5h3yFAAs8BRWVSwooAAAAAElFTkSuQmCC')] bg-repeat">
         
         {mode === 'side' && (
            <div className="w-full h-full flex items-stretch divide-x divide-dark-700">
               <div className="w-1/2 h-full flex flex-col bg-dark-900/90 backdrop-blur-sm p-4">
                  <div className="text-center font-mono text-sm text-gray-400 mb-2 truncate max-w-full drop-shadow-md bg-dark-900/60 rounded-lg py-1 px-4 self-center">{nameLeft}</div>
                  <div className="flex-1 overflow-hidden flex items-center justify-center">
                     {urlLeft && <img src={urlLeft} className="max-w-full max-h-full object-contain filter drop-shadow-2xl rounded-lg" />}
                  </div>
               </div>
               <div className="w-1/2 h-full flex flex-col bg-dark-900/90 backdrop-blur-sm p-4">
                  <div className="text-center font-mono text-sm text-gray-400 mb-2 truncate max-w-full drop-shadow-md bg-dark-900/60 rounded-lg py-1 px-4 self-center">{nameRight}</div>
                  <div className="flex-1 overflow-hidden flex items-center justify-center">
                     {urlRight && <img src={urlRight} className="max-w-full max-h-full object-contain filter drop-shadow-2xl rounded-lg" />}
                  </div>
               </div>
            </div>
         )}

         {mode === 'slider' && (
            <div className="relative w-full h-full flex items-center justify-center bg-dark-900/90 backdrop-blur-sm">
               
               {/* Underlaying Image (Right) */}
               {urlRight && <img src={urlRight} className="absolute max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl h-[90vh]" />}
               
               {/* Overlaying Image (Left) with Dynamic Clip Path */}
               {urlLeft && (
                 <img 
                    src={urlLeft} 
                    className="absolute max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl h-[90vh]" 
                    style={{ clipPath: `polygon(0% 0%, ${sliderPos}% 0%, ${sliderPos}% 100%, 0% 100%)` }}
                 />
               )}

               {/* Absolute Positioning Labels */}
               <div className="absolute top-6 left-6 text-sm font-bold bg-dark-900/80 border border-dark-600 px-3 py-1 rounded shadow-lg text-blue-400 z-10 pointers-none">
                 L: {nameLeft}
               </div>
               <div className="absolute top-6 right-6 text-sm font-bold bg-dark-900/80 border border-dark-600 px-3 py-1 rounded shadow-lg text-purple-400 z-10 pointers-none">
                 R: {nameRight}
               </div>

               {/* Wipe Slider overlay */}
               <input 
                  type="range" 
                  min="0" max="100" 
                  value={sliderPos}
                  onChange={(e) => setSliderPos(Number(e.target.value))}
                  className="absolute inset-x-0 bottom-1/2 translate-y-1/2 w-full h-full opacity-0 cursor-ew-resize z-20"
               />

               {/* Visual Handle for structural clarity */}
               <div 
                  className="absolute inset-y-0 w-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-10 pointer-events-none"
                  style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
               >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-white">
                     <MoveHorizontal size={16} />
                  </div>
               </div>

            </div>
         )}
      </div>
    </div>
  );
}
