/**
 * FilmstripView — Large viewer + scrolling thumbnail strip.
 *
 * Ported from pic-machina's MediaBrowser filmstrip mode.
 * - Large viewer top: renders image/video/audio directly (no autoplay on video)
 * - Horizontal strip bottom: thumbnails with video first-frame extraction
 * - Selection: click, Shift+click, Ctrl/Cmd+click (delegated to App's handleItemClick)
 * - Keyboard: Left/Right arrows navigate; Enter fires double-click
 * - Scroll position persisted across re-renders
 * - Tooltip on hover showing name/size/type
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GridItem } from '../../core/models/FilePair';
import { GroupedItems } from './FileGrid';
import { Folder, Film, FileIcon, Image as ImageIcon, Check, Music, Play, Braces, FileText, FileCode, Archive, Hash } from 'lucide-react';
import { useThumbnails } from '../hooks/useThumbnails';

const CodeTextIcon = ({ text, className, size }: { text: string, className: string, size: number }) => (
  <div 
    style={{ width: size, height: size, fontSize: size * 0.35 }} 
    className={`flex items-center justify-center font-mono font-bold border-2 rounded-lg pointer-events-none ${className}`}
  >
    {text}
  </div>
);

interface FilmstripViewProps {
  groups: GroupedItems[];
  selectedIdsArray: (string | null)[];
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onItemDoubleClick: (item: GridItem, e: React.MouseEvent) => void;
  onItemContextMenu: (item: GridItem, e: React.MouseEvent) => void;
}

// ── File type helpers ─────────────────────────────────────────────────────────

function getMediaType(name: string) {
  if (/\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(name)) return 'image';
  if (/\.(mp4|webm|mov|avi|mkv)$/i.test(name)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(name)) return 'audio';
  return 'other';
}

function formatBytes(bytes: number) {
  if (!bytes) return '';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── Viewer area — renders the focused file ────────────────────────────────────

function FilmstripViewer({ item }: { item: GridItem | null }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!item || item.type !== 'file') { setBlobUrl(null); return; }
    let url: string | null = null;
    let isActive = true;
    item.pair.mainHandle.getFile().then((f) => {
      if (!isActive) return;
      url = URL.createObjectURL(f);
      setBlobUrl(url);
    }).catch(() => {});
    return () => {
      isActive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item]);

  if (!item) return null;

  if (item.type === 'folder') {
    return (
      <div className="flex flex-col items-center gap-4 text-blue-400">
        <Folder size={96} fill="currentColor" />
        <span className="text-xl font-semibold">{item.name}</span>
      </div>
    );
  }

  const name = item.pair.id;
  const type = getMediaType(name);

  if (!blobUrl) {
    return <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />;
  }

  if (type === 'image') {
    return (
      <img
        src={blobUrl}
        alt={name}
        className="max-w-full max-h-full object-contain"
        style={{ display: 'block' }}
      />
    );
  }

  if (type === 'video') {
    // controls but no autoplay — user must press play
    return (
      <video
        key={blobUrl}
        src={blobUrl}
        controls
        className="max-w-full max-h-full"
        style={{ display: 'block' }}
      />
    );
  }

  if (type === 'audio') {
    return (
      <div className="flex flex-col items-center gap-6 text-purple-400">
        <Music size={80} />
        <p className="text-sm text-gray-300">{name}</p>
        <audio key={blobUrl} src={blobUrl} controls />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-gray-500">
      <FileIcon size={80} />
      <p className="text-sm">{name}</p>
    </div>
  );
}

// ── Strip thumbnail chip ──────────────────────────────────────────────────────

function StripThumb({
  item,
  isSelected,
  selectionOrderIndex,
  totalSelected,
  onClick,
  onDoubleClick,
  onContextMenu,
}: {
  item: GridItem;
  isSelected: boolean;
  selectionOrderIndex: number | null;
  totalSelected: number;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  const isFile = item.type === 'file';
  const pair = isFile ? item.pair : undefined;
  const itemName = isFile ? pair!.id : item.name;
  const type = isFile ? getMediaType(itemName) : 'folder';

  const thumbnailUrl = useThumbnails(pair?.mainHandle, pair?.thumbnailHandle);

  // Tooltip text
  const tooltipLines: string[] = [itemName];
  if (isFile && pair) {
    if (pair.size) tooltipLines.push(t('filmstrip.size', { size: formatBytes(pair.size) }));
    if (pair.lastModified) tooltipLines.push(t('filmstrip.modified', { date: new Date(pair.lastModified).toLocaleString() }));
  }
  const tooltipText = tooltipLines.join('\n');

  const renderThumb = () => {
    if (!isFile) return <Folder size={36} className="text-blue-500/80" fill="currentColor" />;
    if (thumbnailUrl) return <img src={thumbnailUrl} className="w-full h-full object-cover" alt={itemName} />;
    if (type === 'image') return <ImageIcon size={28} className="text-gray-500" />;
    if (type === 'video') return <Film size={28} className="text-gray-500" />;
    if (type === 'audio') return <Music size={28} className="text-purple-500" />;
    if (/\.json$/i.test(itemName)) return <Braces size={28} className="text-amber-400/90" />;
    if (/\.(md|markdown|txt)$/i.test(itemName)) return <FileText size={28} className="text-blue-400" />;
    if (/\.zip$/i.test(itemName)) return <Archive size={28} className="text-orange-500" />;
    if (/\.pdf$/i.test(itemName)) return <FileText size={28} className="text-red-500" />;

    // Code specific icons
    if (/\.html?$/i.test(itemName)) return <FileCode size={28} className="text-orange-500" />;
    if (/\.jsx$/i.test(itemName)) return <FileCode size={28} className="text-cyan-400" />;
    if (/\.tsx$/i.test(itemName)) return <FileCode size={28} className="text-blue-500" />;
    if (/\.sh$/i.test(itemName)) return <Hash size={28} className="text-gray-400" />;
    if (/\.js$/i.test(itemName)) return <CodeTextIcon text="JS" className="border-yellow-500/30 text-yellow-500 bg-yellow-500/10" size={28} />;
    if (/\.ts$/i.test(itemName)) return <CodeTextIcon text="TS" className="border-blue-500/30 text-blue-500 bg-blue-500/10" size={28} />;
    if (/\.css$/i.test(itemName)) return <CodeTextIcon text="CSS" className="border-pink-500/30 text-pink-500 bg-pink-500/10" size={28} />;
    if (/\.py$/i.test(itemName)) return <CodeTextIcon text="PY" className="border-green-500/30 text-green-500 bg-green-500/10" size={28} />;
    if (/\.csv$/i.test(itemName)) return <FileCode size={28} className="text-gray-400" />;

    return <FileIcon size={28} className="text-gray-500" />;
  };

  return (
    <div
      title={tooltipText}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className="flex flex-col gap-1 shrink-0 cursor-pointer select-none"
      style={{ width: 100 }}
    >
      {/* Thumb box */}
      <div
        className={`relative w-[100px] h-[100px] rounded-md overflow-hidden border-2 flex items-center justify-center bg-[#111] transition-all ${
          isSelected
            ? 'border-blue-500 opacity-100 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]'
            : 'border-transparent opacity-60 hover:opacity-100'
        }`}
      >
        {renderThumb()}

        {/* Video play badge */}
        {type === 'video' && (
          <div style={{ position:'absolute', bottom:5, left:5, width:16, height:16, borderRadius:'50%', background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:20 }}>
            <Play size={7} fill="white" stroke="none" strokeWidth={0} style={{ marginLeft:1, color:'white' }} />
          </div>
        )}

        {/* Selection badge */}
        {isSelected && (
          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold shadow-md z-10 pointer-events-none">
            {totalSelected === 1 || selectionOrderIndex === null
              ? <Check size={11} strokeWidth={3} />
              : selectionOrderIndex}
          </div>
        )}
      </div>

      {/* Label */}
      <p className="text-[10px] text-center text-gray-300 truncate w-[100px]">
        {itemName}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FilmstripView({
  groups,
  selectedIdsArray,
  onItemClick,
  onItemDoubleClick,
  onItemContextMenu,
}: FilmstripViewProps) {
  const allItems = groups.flatMap((g) => g.items);

  // Scroll persistence — survives React re-renders via module-level ref pattern
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef<number>(0);

  useEffect(() => {
    if (stripRef.current) stripRef.current.scrollLeft = scrollLeftRef.current;
  }, []);

  const handleScroll = useCallback(() => {
    if (stripRef.current) scrollLeftRef.current = stripRef.current.scrollLeft;
  }, []);

  // Resolve the focused item (first selected → first file → first item)
  const focusedId = selectedIdsArray.find(Boolean);
  const focusedItem =
    allItems.find((i) => (i.type === 'file' ? i.pair.id : i.name) === focusedId) ||
    allItems.find((i) => i.type === 'file') ||
    allItems[0] ||
    null;

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;

      const currentId = focusedItem
        ? focusedItem.type === 'file' ? focusedItem.pair.id : focusedItem.name
        : null;
      const currentIdx = currentId
        ? allItems.findIndex((i) => (i.type === 'file' ? i.pair.id : i.name) === currentId)
        : -1;

      if (e.key === 'Enter') {
        if (focusedItem) onItemDoubleClick(focusedItem, new MouseEvent('dblclick') as unknown as React.MouseEvent);
        return;
      }

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
  }, [allItems, focusedItem, onItemClick, onItemDoubleClick]);

  if (allItems.length === 0) return null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">

      {/* ── Viewer ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
        <FilmstripViewer item={focusedItem} />
      </div>

      {/* ── Strip ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-dark-700 bg-dark-900" style={{ height: 160, minHeight: 160, flexBasis: 160 }}>
        <div
          ref={stripRef}
          onScroll={handleScroll}
          className="h-full flex gap-2 px-3 pt-3 pb-6 overflow-x-auto overflow-y-hidden items-start"
          style={{ scrollbarWidth: 'thin' }}
        >
          {allItems.map((item) => {
            const id = item.type === 'file' ? item.pair.id : item.name;
            const isSelected = selectedIdsArray.includes(id);
            const selIdx = selectedIdsArray.indexOf(id);

            return (
              <StripThumb
                key={id}
                item={item}
                isSelected={isSelected}
                selectionOrderIndex={selIdx !== -1 ? selIdx + 1 : null}
                totalSelected={selectedIdsArray.filter(Boolean).length}
                onClick={(e) => onItemClick(id, e)}
                onDoubleClick={(e) => onItemDoubleClick(item, e)}
                onContextMenu={(e) => onItemContextMenu(item, e)}
              />
            );
          })}
        </div>
      </div>

    </div>
  );
}
