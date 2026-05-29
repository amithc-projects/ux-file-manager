/**
 * TransformCompareView — filmstrip strip + before/after compare workspace.
 *
 * Activated when compareMode='transform' is set on the web component.
 *
 * Layout:
 *   ┌────────────────────────────────────────────┐
 *   │  Custom controls (host-provided HTML)       │
 *   ├──────────────────┬─────────────────────────┤
 *   │   Before         │   After                  │  ← viewer
 *   │   (original)     │   (processed)            │
 *   ├────────────────────────────────────────────┤
 *   │  ← scrollable thumbnail strip →            │
 *   └────────────────────────────────────────────┘
 *
 * Callbacks (all optional, set as properties on the web component):
 *   onCompareRender(file): Promise<{ beforeUrl, afterUrl, beforeLabel?, afterLabel? }
 *                                  | { noPreview, noPreviewReason? }>
 *   onCompareInfo(file):   Promise<void>   — fired when ℹ️ button clicked
 *   customControlsHtml:    string          — injected HTML above the viewer
 *   onBindCustomControls(container): void  — called once after HTML is injected
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { GridItem } from '../../core/models/FilePair';
import { GroupedItems } from './FileGrid';
import { useThumbnails } from '../hooks/useThumbnails';
import { Folder, Film, FileIcon, Image as ImageIcon, Music, Check, Play, Info, Loader2, SplitSquareHorizontal, Columns2, GalleryHorizontal, MoveHorizontal } from 'lucide-react';

type CompareLayout = 'side-by-side' | 'slider';
type ViewMode = 'grid' | 'filmstrip' | 'list' | 'data';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompareRenderResult {
  beforeUrl?: string;
  afterUrl?: string;
  beforeLabel?: string;
  afterLabel?: string;
  noPreview?: boolean;
  noPreviewReason?: string;
}

export interface TransformCompareViewProps {
  groups: GroupedItems[];
  selectedIdsArray: (string | null)[];
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onItemDoubleClick: (item: GridItem, e: React.MouseEvent) => void;
  onItemContextMenu: (item: GridItem, e: React.MouseEvent) => void;
  /** Async callback: receives the File object, returns before/after blob URLs */
  onCompareRender?: (file: File) => Promise<CompareRenderResult>;
  /** Called when the ℹ️ button is clicked — e.g. open sidecar/EXIF panel */
  onCompareInfo?: (file: File) => Promise<void>;
  /** Raw HTML string injected into the controls bar above the viewer */
  customControlsHtml?: string;
  /** Called once after customControlsHtml is mounted — wire up button handlers */
  onBindCustomControls?: (container: HTMLDivElement) => void;
  /** Exposed via useImperativeHandle so parent can call triggerProcess() */
  triggerProcessRef?: React.MutableRefObject<(() => void) | null>;
  /** Controls how the thumbnail strip renders (passed from App viewMode state) */
  viewMode?: ViewMode;
}

// ── Thumbnail chip ────────────────────────────────────────────────────────────

function StripThumb({
  item, isSelected, selectionOrderIndex, totalSelected,
  onClick, onDoubleClick, onContextMenu,
}: {
  item: GridItem;
  isSelected: boolean;
  selectionOrderIndex: number | null;
  totalSelected: number;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const isFile = item.type === 'file';
  const pair = isFile ? item.pair : undefined;
  const itemName = isFile ? pair!.id : item.name;
  const isVideo = isFile && /\.(mp4|webm|mov|avi|mkv)$/i.test(itemName);
  const thumbnailUrl = useThumbnails(pair?.mainHandle);

  const renderThumb = () => {
    if (!isFile) return <Folder size={36} className="text-blue-500/80" fill="currentColor" />;
    if (thumbnailUrl) return <img src={thumbnailUrl} className="w-full h-full object-cover" alt={itemName} />;
    if (/\.(jpe?g|png|gif|webp|bmp)$/i.test(itemName)) return <ImageIcon size={28} className="text-gray-500" />;
    if (isVideo) return <Film size={28} className="text-gray-500" />;
    if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(itemName)) return <Music size={28} className="text-purple-500" />;
    return <FileIcon size={28} className="text-gray-500" />;
  };

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className="flex flex-col gap-1 shrink-0 cursor-pointer select-none"
      style={{ width: 88 }}
    >
      <div className={`relative w-[88px] h-[88px] rounded-md overflow-hidden border-2 flex items-center justify-center bg-[#111] transition-all ${isSelected ? 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]' : 'border-transparent opacity-60 hover:opacity-100'
        }`}>
        {renderThumb()}
        {isVideo && (
          <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-0.5 pointer-events-none">
            <Play size={9} className="text-white" fill="white" />
          </div>
        )}
        {isSelected && (
          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shadow-md z-10 pointer-events-none">
            {totalSelected === 1 || selectionOrderIndex === null ? <Check size={10} strokeWidth={3} /> : selectionOrderIndex}
          </div>
        )}
      </div>
      <p className="text-[10px] text-center text-gray-300 truncate w-[88px]">{itemName}</p>
    </div>
  );
}

// ── Before/After viewer ───────────────────────────────────────────────────────

function CompareViewer({
  result, loading, focusedFile, layout,
  onCompareInfo,
}: {
  result: CompareRenderResult | null;
  loading: boolean;
  focusedFile: File | null;
  layout: CompareLayout;
  onCompareInfo?: (file: File) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [sliderPos, setSliderPos] = useState(50);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3 text-blue-400">
          <Loader2 size={36} className="animate-spin" />
          <span className="text-sm">{t('transformCompare.processing')}</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-gray-600">
        <div className="flex flex-col items-center gap-2">
          <SplitSquareHorizontal size={48} />
          <p className="text-sm">{t('transformCompare.selectFile')}</p>
        </div>
      </div>
    );
  }

  if (result.noPreview) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-gray-500">
        <p className="text-sm text-center px-8">{result.noPreviewReason ?? t('transformCompare.noPreview')}</p>
      </div>
    );
  }

  if (layout === 'slider') {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {result.afterUrl && <img src={result.afterUrl} className="absolute max-w-full max-h-full object-contain pointer-events-none" alt="after" />}
        {result.beforeUrl && (
          <img
            src={result.beforeUrl}
            className="absolute max-w-full max-h-full object-contain pointer-events-none"
            style={{ clipPath: `polygon(0% 0%, ${sliderPos}% 0%, ${sliderPos}% 100%, 0% 100%)` }}
            alt="before"
          />
        )}
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none z-10">
          {result.beforeLabel ?? t('transformCompare.before')}
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none z-10">
          {result.afterLabel ?? t('transformCompare.after')}
        </div>
        <input
          type="range" min="0" max="100"
          value={sliderPos}
          onChange={e => setSliderPos(Number(e.target.value))}
          className="absolute inset-x-0 bottom-1/2 translate-y-1/2 w-full h-full opacity-0 cursor-ew-resize z-20"
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] z-10 pointer-events-none"
          style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-white">
            <MoveHorizontal size={14} />
          </div>
        </div>
        {onCompareInfo && focusedFile && (
          <button onClick={() => onCompareInfo(focusedFile)} className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-blue-600 text-white rounded-full transition-colors z-30" title={t('transformCompare.fileInfo')}>
            <Info size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex bg-black overflow-hidden">
      {/* Before */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden border-r border-dark-700/50">
        {result.beforeUrl
          ? <img src={result.beforeUrl} className="max-w-full max-h-full object-contain" alt="before" />
          : <span className="text-gray-600 text-sm">{t('transformCompare.noInput')}</span>
        }
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
          {result.beforeLabel ?? t('transformCompare.before')}
        </div>
      </div>

      {/* After */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {result.afterUrl
          ? <img src={result.afterUrl} className="max-w-full max-h-full object-contain" alt="after" />
          : <span className="text-gray-600 text-sm">{t('transformCompare.noOutput')}</span>
        }
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
          {result.afterLabel ?? t('transformCompare.after')}
        </div>
        {onCompareInfo && focusedFile && (
          <button
            onClick={() => onCompareInfo(focusedFile)}
            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-blue-600 text-white rounded-full transition-colors"
            title={t('transformCompare.fileInfo')}
          >
            <Info size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TransformCompareView({
  groups,
  selectedIdsArray,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
  onCompareRender,
  onCompareInfo,
  customControlsHtml,
  onBindCustomControls,
  triggerProcessRef,
  viewMode = 'filmstrip',
}: TransformCompareViewProps) {
  const { t } = useTranslation();
  const allItems = groups.flatMap(g => g.items);
  const [compareLayout, setCompareLayout] = useState<CompareLayout>('side-by-side');

  // Strip scroll persistence
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef<number>(0);
  useEffect(() => {
    if (stripRef.current) stripRef.current.scrollLeft = scrollLeftRef.current;
  }, []);
  const handleScroll = () => {
    if (stripRef.current) scrollLeftRef.current = stripRef.current.scrollLeft;
  };

  // Custom controls HTML injection
  const controlsRef = useRef<HTMLDivElement>(null);
  const bindCalledRef = useRef(false);
  useEffect(() => {
    if (!controlsRef.current || !customControlsHtml) return;
    controlsRef.current.innerHTML = customControlsHtml;
    if (onBindCustomControls && !bindCalledRef.current) {
      bindCalledRef.current = true;
      onBindCustomControls(controlsRef.current);
    }
  }, [customControlsHtml, onBindCustomControls]);

  // Reset bind flag when controls change so rebind works on remount
  useEffect(() => { bindCalledRef.current = false; }, [customControlsHtml]);

  // Focused item (first selected → first file → first item)
  const focusedId = selectedIdsArray.find(Boolean);
  const focusedItem =
    allItems.find(i => (i.type === 'file' ? i.pair.id : i.name) === focusedId) ||
    allItems.find(i => i.type === 'file') ||
    allItems[0] || null;

  // Compare render state
  const [compareResult, setCompareResult] = useState<CompareRenderResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [focusedFile, setFocusedFile] = useState<File | null>(null);
  const lastRenderedIdRef = useRef<string | null>(null);

  const runRender = useCallback(async (item: GridItem | null) => {
    if (!item || item.type !== 'file' || !onCompareRender) {
      setCompareResult(null);
      setFocusedFile(null);
      return;
    }
    try {
      setCompareLoading(true);
      const file = await item.pair.mainHandle.getFile();
      setFocusedFile(file);
      const result = await onCompareRender(file);
      setCompareResult(result);
    } catch (err) {
      console.error('[TransformCompareView] onCompareRender error', err);
      setCompareResult({ noPreview: true, noPreviewReason: String(err) });
    } finally {
      setCompareLoading(false);
    }
  }, [onCompareRender]);

  // Re-run render when focused item changes
  useEffect(() => {
    const newId = focusedItem ? (focusedItem.type === 'file' ? focusedItem.pair.id : focusedItem.name) : null;
    if (newId === lastRenderedIdRef.current) return;
    lastRenderedIdRef.current = newId ?? null;
    runRender(focusedItem);
  }, [focusedItem, runRender]);

  // Expose triggerProcess so the host can call it (e.g. after video seek)
  useEffect(() => {
    if (triggerProcessRef) {
      triggerProcessRef.current = () => runRender(focusedItem);
    }
    return () => { if (triggerProcessRef) triggerProcessRef.current = null; };
  }, [triggerProcessRef, focusedItem, runRender]);

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const currentId = focusedItem
        ? (focusedItem.type === 'file' ? focusedItem.pair.id : focusedItem.name)
        : null;
      const currentIdx = currentId
        ? allItems.findIndex(i => (i.type === 'file' ? i.pair.id : i.name) === currentId)
        : -1;
      const newIdx = e.key === 'ArrowLeft'
        ? Math.max(0, currentIdx - 1)
        : Math.min(allItems.length - 1, currentIdx + 1);
      if (newIdx !== currentIdx && allItems[newIdx]) {
        const newItem = allItems[newIdx];
        const newId = newItem.type === 'file' ? newItem.pair.id : newItem.name;
        e.preventDefault();
        onItemClick(newId, new MouseEvent('click') as unknown as React.MouseEvent);
        setTimeout(() => {
          if (stripRef.current) {
            const el = stripRef.current.children[newIdx] as HTMLElement;
            if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          }
        }, 0);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [allItems, focusedItem, onItemClick]);

  if (allItems.length === 0) return null;

  const totalSelected = selectedIdsArray.filter(Boolean).length;

  const thumbItems = allItems.map(item => {
    const id = item.type === 'file' ? item.pair.id : item.name;
    const isSelected = selectedIdsArray.includes(id);
    const selIdx = selectedIdsArray.indexOf(id);
    return (
      <StripThumb
        key={id}
        item={item}
        isSelected={isSelected}
        selectionOrderIndex={selIdx !== -1 ? selIdx + 1 : null}
        totalSelected={totalSelected}
        onClick={e => onItemClick(id, e)}
        onDoubleClick={e => onItemDoubleClick(item, e)}
        onContextMenu={e => onItemContextMenu(item, e)}
      />
    );
  });

  const isGridStrip = viewMode === 'grid';
  const isListStrip = viewMode === 'list';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">

      {/* Toolbar: custom controls + compare layout toggle */}
      <div className="shrink-0 bg-dark-800 border-b border-dark-700 px-3 py-2 flex items-center gap-3">
        {/* Host-provided controls (Original / Prev Step etc.) */}
        {customControlsHtml && <div ref={controlsRef} className="flex items-center gap-2 flex-1" />}
        {!customControlsHtml && <div className="flex-1" />}

        {/* Compare layout toggle */}
        <div className="flex bg-dark-900 p-0.5 rounded-lg border border-dark-600 shrink-0">
          <button
            title={t('transformCompare.sideBySide')}
            onClick={() => setCompareLayout('side-by-side')}
            className={`p-1.5 rounded-md transition-colors ${compareLayout === 'side-by-side' ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <Columns2 size={15} />
          </button>
          <button
            title={t('transformCompare.sliderWipe')}
            onClick={() => setCompareLayout('slider')}
            className={`p-1.5 rounded-md transition-colors ${compareLayout === 'slider' ? 'bg-dark-700 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <GalleryHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Before/After viewer */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CompareViewer
          result={compareResult}
          loading={compareLoading}
          focusedFile={focusedFile}
          layout={compareLayout}
          onCompareInfo={onCompareInfo}
        />
      </div>

      {/* Thumbnail strip — layout controlled by viewMode */}
      {isListStrip ? (
        <div className="shrink-0 border-t border-dark-700 bg-dark-900 overflow-y-auto" style={{ maxHeight: 200 }}>
          {allItems.map(item => {
            const id = item.type === 'file' ? item.pair.id : item.name;
            const isSelected = selectedIdsArray.includes(id);
            return (
              <div
                key={id}
                onClick={e => onItemClick(id, e)}
                onDoubleClick={e => onItemDoubleClick(item, e)}
                onContextMenu={e => onItemContextMenu(item, e)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm truncate border-b border-dark-800 ${isSelected ? 'bg-blue-900/40 text-white' : 'text-gray-400 hover:bg-dark-800 hover:text-white'}`}
              >
                {isSelected && <Check size={12} className="text-blue-400 shrink-0" />}
                <span className="truncate">{id}</span>
              </div>
            );
          })}
        </div>
      ) : isGridStrip ? (
        <div className="shrink-0 border-t border-dark-700 bg-dark-900" style={{ height: 220, minHeight: 220 }}>
          <div className="h-full flex flex-wrap gap-2 px-3 py-2 overflow-y-auto content-start" style={{ scrollbarWidth: 'thin' }}>
            {thumbItems}
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-dark-700 bg-dark-900" style={{ height: 160, minHeight: 160, flexBasis: 160 }}>
          <div
            ref={stripRef}
            onScroll={handleScroll}
            className="h-full flex gap-2 px-3 pt-2 pb-6 overflow-x-auto overflow-y-hidden items-start"
            style={{ scrollbarWidth: 'thin' }}
          >
            {thumbItems}
          </div>
        </div>
      )}

    </div>
  );
}
