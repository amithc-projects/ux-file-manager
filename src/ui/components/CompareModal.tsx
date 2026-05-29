import { useState, useEffect, Suspense, lazy, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Columns, MoveHorizontal, FileText, Link, Link2Off } from 'lucide-react';
import { ZoomableImage, ZoomState, DEFAULT_ZOOM } from './ZoomableImage';
import { GridItem } from '../../core/models/FilePair';

// Lazy load the diff viewer so it only downloads when a user clicks to compare text files
const ReactDiffViewer = lazy(() => import('react-diff-viewer-continued'));

interface CompareModalProps {
  itemLeft: GridItem;
  itemRight: GridItem;
  onClose: () => void;
}

export function CompareModal({ itemLeft, itemRight, onClose }: CompareModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'side' | 'slider'>('side');
  const [sliderPos, setSliderPos] = useState(50);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoLeftRef = useRef<HTMLVideoElement>(null);
  const videoRightRef = useRef<HTMLVideoElement>(null);
  const [syncVideos, setSyncVideos] = useState(true);
  const [syncZoom, setSyncZoom] = useState(true);
  const [sharedZoom, setSharedZoom] = useState<ZoomState>(DEFAULT_ZOOM);
  const [zoomLeft, setZoomLeft] = useState<ZoomState>(DEFAULT_ZOOM);
  const [zoomRight, setZoomRight] = useState<ZoomState>(DEFAULT_ZOOM);

  const handleZoomLeft = useCallback((z: ZoomState) => {
    setZoomLeft(z);
    if (syncZoom) setSharedZoom(z);
  }, [syncZoom]);

  const handleZoomRight = useCallback((z: ZoomState) => {
    setZoomRight(z);
    if (syncZoom) setSharedZoom(z);
  }, [syncZoom]);

  const [urlLeft, setUrlLeft] = useState<string | null>(null);
  const [urlRight, setUrlRight] = useState<string | null>(null);
  
  const [textLeft, setTextLeft] = useState<string | null>(null);
  const [textRight, setTextRight] = useState<string | null>(null);

  const nameLeft = itemLeft.type === 'file' ? itemLeft.pair.id : t('compare.folder');
  const nameRight = itemRight.type === 'file' ? itemRight.pair.id : t('compare.folder');

  const isImageFile = (name: string) => /\.(jpg|jpeg|png|gif|svg|webp|bmp)$/i.test(name);
  const isVideoFile = (name: string) => /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(name);
  const isImageCompare = itemLeft.type === 'file' && itemRight.type === 'file' && isImageFile(nameLeft) && isImageFile(nameRight);
  const isVideoCompare = itemLeft.type === 'file' && itemRight.type === 'file' && isVideoFile(nameLeft) && isVideoFile(nameRight);
  const isTextCompare = !isImageCompare && !isVideoCompare;

  // Sync mode: if it's a text compare, 'slider' doesn't make much sense (unified vs split is better)
  // but react-diff-viewer handles `splitView={mode === 'side'}` nicely.
  
  useEffect(() => {
    let isActive = true;
    (async () => {
      if (itemLeft.type === 'file') {
         const file = await itemLeft.pair.mainHandle.getFile();
         if (isTextCompare) {
             const text = await file.text();
             if (isActive) setTextLeft(text);
         } else {
             if (isActive) setUrlLeft(URL.createObjectURL(file));
         }
      }
      if (itemRight.type === 'file') {
         const file = await itemRight.pair.mainHandle.getFile();
         if (isTextCompare) {
             const text = await file.text();
             if (isActive) setTextRight(text);
         } else {
             if (isActive) setUrlRight(URL.createObjectURL(file));
         }
      }
    })();
    return () => {
      isActive = false;
      if (urlLeft) URL.revokeObjectURL(urlLeft);
      if (urlRight) URL.revokeObjectURL(urlRight);
    };
  }, [itemLeft, itemRight, isTextCompare]);

  // HACK: Emotion (which react-diff-viewer uses) injects styles into document.head.
  // Because our component lives inside a Web Component (Shadow DOM), those styles
  // are completely blocked from reaching the diff viewer. 
  // We must observe and clone them into our Shadow Root.
  useEffect(() => {
    if (!isTextCompare || !containerRef.current) return;
    
    const syncEmotionStyles = () => {
      const rootNode = containerRef.current?.getRootNode();
      if (!(rootNode instanceof ShadowRoot)) return;

      const emotionStyles = Array.from(document.head.querySelectorAll('style[data-emotion]')) as HTMLStyleElement[];
      
      emotionStyles.forEach((style, idx) => {
        const id = `em-clone-${idx}`;
        let target = rootNode.getElementById(id) as HTMLStyleElement;
        if (!target) {
          target = document.createElement('style');
          target.id = id;
          rootNode.appendChild(target);
        }
        
        let cssText = '';
        try {
          if (style.sheet && style.sheet.cssRules.length > 0) {
            cssText = Array.from(style.sheet.cssRules).map(r => r.cssText).join('\\n');
          } else {
            cssText = style.innerHTML;
          }
        } catch (e) {
          cssText = style.innerHTML; 
        }
        
        if (target.innerHTML !== cssText) {
           target.innerHTML = cssText;
        }
      });
    };

    syncEmotionStyles();
    const observer = new MutationObserver(syncEmotionStyles);
    observer.observe(document.head, { childList: true, subtree: true });
    
    const interval = setInterval(syncEmotionStyles, 100);
    setTimeout(() => clearInterval(interval), 2000);

    return () => {
       observer.disconnect();
       clearInterval(interval);
    };
  }, [isTextCompare, textLeft, textRight, mode, showDiffOnly]);

  // Sync video playback when syncVideos is enabled
  useEffect(() => {
    if (!isVideoCompare || !syncVideos) return;
    const left = videoLeftRef.current;
    const right = videoRightRef.current;
    if (!left || !right) return;

    const syncFrom = (source: HTMLVideoElement, target: HTMLVideoElement) => ({
      play: () => { target.currentTime = source.currentTime; target.play().catch(() => {}); },
      pause: () => { target.currentTime = source.currentTime; target.pause(); },
      seeked: () => { if (Math.abs(target.currentTime - source.currentTime) > 0.1) target.currentTime = source.currentTime; },
    });

    const lHandlers = syncFrom(left, right);
    const rHandlers = syncFrom(right, left);

    left.addEventListener('play', lHandlers.play);
    left.addEventListener('pause', lHandlers.pause);
    left.addEventListener('seeked', lHandlers.seeked);
    right.addEventListener('play', rHandlers.play);
    right.addEventListener('pause', rHandlers.pause);
    right.addEventListener('seeked', rHandlers.seeked);

    return () => {
      left.removeEventListener('play', lHandlers.play);
      left.removeEventListener('pause', lHandlers.pause);
      left.removeEventListener('seeked', lHandlers.seeked);
      right.removeEventListener('play', rHandlers.play);
      right.removeEventListener('pause', rHandlers.pause);
      right.removeEventListener('seeked', rHandlers.seeked);
    };
  }, [isVideoCompare, syncVideos, urlLeft, urlRight]);

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-dark-950 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-900 shrink-0 select-none">
        <div className="flex items-center gap-6">
           <h2 className="font-semibold text-lg text-gray-100">{t('compare.title')}</h2>

           <div className="flex bg-dark-950 p-1 rounded-lg border border-dark-700 shadow-inner">
             <button title={isTextCompare ? t('compare.unifiedMode') : t('compare.sliderMode')} onClick={() => setMode('slider')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'slider' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
               {isTextCompare ? <FileText size={14} /> : <MoveHorizontal size={14} />}
               {isTextCompare ? t('compare.unifiedDiff') : t('compare.sliderWipe')}
             </button>
             <button title={t('compare.sideBySideMode')} onClick={() => setMode('side')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'side' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
               <Columns size={14} /> {t('compare.sideBySide')}
             </button>
           </div>

           {isTextCompare && (
             <div className="flex bg-dark-950 p-1 rounded-lg border border-dark-700 shadow-inner">
               <button title={t('compare.showAllLines')} onClick={() => setShowDiffOnly(false)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!showDiffOnly ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                 {t('compare.all')}
               </button>
               <button title={t('compare.showChangesOnly')} onClick={() => setShowDiffOnly(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${showDiffOnly ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                 {t('compare.changesOnly')}
               </button>
             </div>
           )}

           {isVideoCompare && (
             <button
               onClick={() => setSyncVideos(s => !s)}
               title={syncVideos ? t('compare.unsyncControls') : t('compare.syncControls')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${syncVideos ? 'bg-blue-600 border-blue-500 text-white' : 'border-dark-600 text-gray-400 hover:text-white hover:border-dark-500'}`}
             >
               {syncVideos ? <Link size={14} /> : <Link2Off size={14} />}
               {syncVideos ? t('compare.synced') : t('compare.independent')}
             </button>
           )}

           {isImageCompare && (
             <button
               onClick={() => setSyncZoom(s => !s)}
               title={syncZoom ? t('compare.unsyncZoom') : t('compare.syncZoom')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${syncZoom ? 'bg-blue-600 border-blue-500 text-white' : 'border-dark-600 text-gray-400 hover:text-white hover:border-dark-500'}`}
             >
               {syncZoom ? <Link size={14} /> : <Link2Off size={14} />}
               {syncZoom ? t('compare.zoomSynced') : t('compare.zoomIndependent')}
             </button>
           )}
        </div>

        <button onClick={onClose} className="p-2 bg-dark-800 border border-dark-700 hover:bg-dark-700 rounded-full transition-colors shrink-0">
          <X size={20} className="text-gray-300" />
        </button>
      </div>

      {/* Viewport Workspace */}
      <div className="flex-1 w-full relative overflow-hidden bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQYlWNgYGCQwoKxgqGgcJA5h3yFAAs8BRWVSwooAAAAAElFTkSuQmCC')] bg-repeat">
         
         {isVideoCompare ? (
            <div className="w-full h-full flex items-stretch divide-x divide-dark-700">
              {[
                { ref: videoLeftRef, url: urlLeft, name: nameLeft },
                { ref: videoRightRef, url: urlRight, name: nameRight },
              ].map(({ ref, url, name }) => (
                <div key={name} className="w-1/2 h-full flex flex-col bg-dark-900/90 p-4 gap-2">
                  <div className="text-center font-mono text-sm text-gray-400 truncate bg-dark-900/60 rounded-lg py-1 px-4 self-center">{name}</div>
                  <div className="flex-1 flex items-center justify-center min-h-0">
                    {url
                      ? <video ref={ref} src={url} controls className="max-w-full max-h-full rounded-lg shadow-2xl" />
                      : <div className="text-gray-500 text-sm">{t('compare.loading')}</div>
                    }
                  </div>
                </div>
              ))}
            </div>
         ) : isTextCompare ? (
            <div ref={containerRef} className="w-full h-full overflow-auto bg-[#1e1e1e] p-2 text-sm">
                <Suspense fallback={<div className="text-gray-400 p-8 flex items-center gap-3 justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" /> {t('compare.loadingDiff')}</div>}>
                    {textLeft !== null && textRight !== null && (
                        <ReactDiffViewer
                           oldValue={textLeft}
                           newValue={textRight}
                           splitView={mode === 'side'}
                           leftTitle={nameLeft}
                           rightTitle={nameRight}
                           useDarkTheme={true}
                           hideLineNumbers={false}
                           showDiffOnly={showDiffOnly}
                           styles={{ 
                               variables: { 
                                  dark: { 
                                    diffViewerBackground: 'transparent',
                                    gutterBackground: '#1e1e1e',
                                    addedBackground: '#022c22', // Deep green
                                    addedColor: '#d1fae5',
                                    removedBackground: '#450a0a', // Deep red
                                    removedColor: '#fee2e2',
                                    wordAddedBackground: '#065f46',
                                    wordRemovedBackground: '#991b1b',
                                    addedGutterBackground: '#064e3b',
                                    removedGutterBackground: '#7f1d1d',
                                  } 
                               } 
                           }}
                        />
                    )}
                </Suspense>
            </div>
         ) : (
            <>
              {mode === 'side' && (
                 <div className="w-full h-full flex items-stretch divide-x divide-dark-700">
                    <div className="w-1/2 h-full flex flex-col bg-dark-900/90 backdrop-blur-sm p-4">
                       <div className="text-center font-mono text-sm text-gray-400 mb-2 truncate max-w-full drop-shadow-md bg-dark-900/60 rounded-lg py-1 px-4 self-center">{nameLeft}</div>
                       <div className="flex-1 overflow-hidden">
                          {urlLeft && <ZoomableImage src={urlLeft} alt={nameLeft} zoomState={syncZoom ? sharedZoom : zoomLeft} onZoomChange={handleZoomLeft} className="w-full h-full" />}
                       </div>
                    </div>
                    <div className="w-1/2 h-full flex flex-col bg-dark-900/90 backdrop-blur-sm p-4">
                       <div className="text-center font-mono text-sm text-gray-400 mb-2 truncate max-w-full drop-shadow-md bg-dark-900/60 rounded-lg py-1 px-4 self-center">{nameRight}</div>
                       <div className="flex-1 overflow-hidden">
                          {urlRight && <ZoomableImage src={urlRight} alt={nameRight} zoomState={syncZoom ? sharedZoom : zoomRight} onZoomChange={handleZoomRight} className="w-full h-full" />}
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
            </>
         )}
      </div>
    </div>
  );
}
