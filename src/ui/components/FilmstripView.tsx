/**
 * FilmstripView — Large viewer + scrolling thumbnail strip.
 *
 * Ported from pic-machina's MediaBrowser filmstrip mode.
 * Keeps the large viewer in sync with the thumbnail strip; supports
 * click, Shift+click, Ctrl/Cmd+click multi-selection and keyboard navigation.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { GridItem } from '../../core/models/FilePair';
import { GroupedItems } from './FileGrid';
import { FileViewer } from './FileViewer';
import { Folder, Film, FileIcon, Image as ImageIcon, Check, Music } from 'lucide-react';
import { useThumbnails } from '../hooks/useThumbnails';

interface FilmstripViewProps {
  groups: GroupedItems[];
  selectedIdsArray: (string | null)[];
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onItemDoubleClick: (item: GridItem, e: React.MouseEvent) => void;
  onItemContextMenu: (item: GridItem, e: React.MouseEvent) => void;
}

// ── Thumbnail chip ────────────────────────────────────────────────────────────

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
  const isFile = item.type === 'file';
  const pair = isFile ? item.pair : undefined;
  const itemName = isFile ? pair!.id : item.name;
  const isImage = isFile && /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(itemName);
  const isVideo = isFile && /\.(mp4|webm|mov|avi|mkv)$/i.test(itemName);
  const isAudio = isFile && /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(itemName);
  const thumbnailUrl = useThumbnails(pair?.mainHandle);

  const renderThumb = () => {
    if (!isFile) return <Folder size={36} className="text-blue-500/80" fill="currentColor" />;
    if (thumbnailUrl) return <img src={thumbnailUrl} className="w-full h-full object-cover" alt={itemName} />;
    if (isImage) return <ImageIcon size={28} className="text-gray-500" />;
    if (isVideo) return <Film size={28} className="text-gray-500" />;
    if (isAudio) return <Music size={28} className="text-purple-500" />;
    return <FileIcon size={28} className="text-gray-500" />;
  };

  return (
    <div
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
      <p className="text-[10px] text-center text-gray-300 truncate w-[100px]" title={itemName}>
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

  // Scroll persistence
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef<number>(0);

  // Restore scroll on mount
  useEffect(() => {
    if (stripRef.current) stripRef.current.scrollLeft = scrollLeftRef.current;
  }, []);

  // Save scroll on scroll
  const handleScroll = useCallback(() => {
    if (stripRef.current) scrollLeftRef.current = stripRef.current.scrollLeft;
  }, []);

  // Resolve the "active" item (first selected, or first file)
  const focusedId = selectedIdsArray.find(Boolean);
  const focusedItem =
    allItems.find((i) => (i.type === 'file' ? i.pair.id : i.name) === focusedId) ||
    allItems.find((i) => i.type === 'file') ||
    allItems[0];

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;

      const focusedId2 = focusedItem
        ? focusedItem.type === 'file' ? focusedItem.pair.id : focusedItem.name
        : null;
      const currentIdx = focusedId2
        ? allItems.findIndex((i) => (i.type === 'file' ? i.pair.id : i.name) === focusedId2)
        : -1;

      let newIdx = currentIdx;
      if (e.key === 'ArrowLeft') newIdx = Math.max(0, currentIdx - 1);
      else if (e.key === 'ArrowRight') newIdx = Math.min(allItems.length - 1, currentIdx + 1);
      else if (e.key === 'Enter' && focusedItem) {
        onItemDoubleClick(focusedItem, new MouseEvent('dblclick') as unknown as React.MouseEvent);
        return;
      }

      if (newIdx !== currentIdx && allItems[newIdx]) {
        const newItem = allItems[newIdx];
        const newId = newItem.type === 'file' ? newItem.pair.id : newItem.name;
        e.preventDefault();
        onItemClick(newId, new MouseEvent('click') as unknown as React.MouseEvent);

        // Scroll the strip to keep the item visible
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

      {/* ── Viewer area ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden relative">
        {focusedItem ? (
          focusedItem.type === 'folder' ? (
            <div className="flex flex-col items-center gap-4 text-blue-400">
              <Folder size={96} fill="currentColor" />
              <span className="text-xl font-semibold">{focusedItem.name}</span>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <FileViewer item={focusedItem} />
            </div>
          )
        ) : null}
      </div>

      {/* ── Thumbnail strip ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-dark-700 bg-dark-900" style={{ height: 148 }}>
        <div
          ref={stripRef}
          onScroll={handleScroll}
          className="h-full flex gap-2 px-3 py-3 overflow-x-auto overflow-y-hidden items-start"
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
