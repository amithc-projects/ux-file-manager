import React, { useState, useEffect } from 'react';
import { GridItem } from '../../core/models/FilePair';
import { GroupedItems } from './FileGrid';
import { Folder, Film, FileIcon, Image as ImageIcon } from 'lucide-react';
import { useThumbnails } from '../hooks/useThumbnails';

interface GalleryViewProps {
  groups: GroupedItems[];
  selectedIdsArray: (string | null)[];
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onItemDoubleClick: (item: GridItem, e: React.MouseEvent) => void;
  onItemContextMenu: (item: GridItem, e: React.MouseEvent) => void;
}

import { FileViewer } from './FileViewer';

// Minimal Chip for Horizontal Strip
function GalleryThumbnail({ item, isSelected, selectionOrderIndex, onClick, onDoubleClick, onContextMenu }: { 
    item: GridItem, isSelected: boolean, selectionOrderIndex: number | null,
    onClick: (e: React.MouseEvent) => void, onDoubleClick: (e: React.MouseEvent) => void, onContextMenu: (e: React.MouseEvent) => void 
}) {
    const isFile = item.type === 'file';
    const pair = isFile ? item.pair : undefined;
    const itemName = isFile ? pair!.id : item.name;

    const isImage = isFile && /\.(jpe?g|png|gif|webp|bmp)$/i.test(itemName);
    const isVideo = isFile && /\.(mp4|webm|ogg|mov)$/i.test(itemName);
    const thumbnailUrl = useThumbnails(pair?.mainHandle);

    const clickTimeout = React.useRef<NodeJS.Timeout | null>(null);

    const handleSingleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (e.detail === 1) {
            clickTimeout.current = setTimeout(() => { onClick(e); }, 220);
        }
    };
    const handleDoubleClickCore = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (clickTimeout.current) clearTimeout(clickTimeout.current);
        onDoubleClick(e);
    };

    const renderVisual = () => {
        if (!isFile) return <Folder size={32} className="text-blue-500/80 drop-shadow-md" fill="currentColor" />;
        if (thumbnailUrl) return <img src={thumbnailUrl} className="w-full h-full object-cover object-center pointer-events-none" />;
        if (isImage) return <ImageIcon size={24} className="text-gray-500 pointer-events-none" />;
        if (isVideo) return <Film size={24} className="text-gray-500 pointer-events-none" />;
        return <FileIcon size={24} className="text-gray-500 pointer-events-none" />;
    };

    const SelectionBadge = () => {
       if (selectionOrderIndex === null) return null;
       return (
          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-blue-500 text-white shadow-lg border border-white flex items-center justify-center font-bold text-[10px] pointer-events-none z-20">
             {selectionOrderIndex}
          </div>
       );
    };

    return (
        <div 
           onClick={handleSingleClick}
           onDoubleClick={handleDoubleClickCore}
           onContextMenu={onContextMenu}
           className={`group shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 transition-all flex flex-col justify-center items-center w-28 h-28 relative ${
               isSelected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] z-10' : 'border-dark-700 hover:border-dark-500 bg-dark-800'
           }`}
        >
           <SelectionBadge />
           <div className={`absolute inset-0 flex items-center justify-center p-2 opacity-100 transition-opacity ${thumbnailUrl ? 'p-0 bg-dark-950' : ''}`}>
               {renderVisual()}
           </div>
           
           <div className="absolute inset-x-0 bottom-0 bg-dark-900/80 backdrop-blur pb-1 pt-1.5 px-2 pointer-events-none border-t border-dark-700/50">
               <p className="text-[10px] font-medium text-gray-200 truncate">{itemName}</p>
           </div>
        </div>
    );
}

// Master Stage Logic
export function GalleryView({ groups, selectedIdsArray, onItemClick, onItemDoubleClick, onItemContextMenu }: GalleryViewProps) {
    const allItems = groups.flatMap(g => g.items);
    
    // Find the master focus index. Fallback to entirely 0 if neither array matches.
    const focusedId = selectedIdsArray.find(Boolean);
    const fallbackVisual = allItems.find(i => i.type === 'file' && /\.(jpe?g|png|gif|svg|webp|bmp|mp4|webm|mov|ogg|json|md|txt|pdf|zip)$/i.test((i as any).pair.id));
    const focusedItem = allItems.find(i => (i.type === 'file' ? i.pair.id : i.name) === focusedId) 
        || fallbackVisual 
        || allItems[0];

    if (allItems.length === 0) return null;

    const renderMasterPreview = () => {
        if (!focusedItem) return null;
        if (focusedItem.type === 'folder') {
            return (
                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
                    <Folder size={128} className="text-blue-500/80 drop-shadow-[0_15px_30px_rgba(59,130,246,0.3)] pointer-events-none" fill="currentColor"/>
                    <h2 className="text-2xl font-bold font-mono tracking-tight text-white">{focusedItem.name}</h2>
                    <span className="text-sm bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">Directory Node</span>
                </div>
            );
        }

        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 absolute inset-0">
               <div className="w-full h-full bg-dark-900 rounded-2xl border border-dark-700/60 shadow-2xl overflow-hidden flex items-center justify-center">
                  <FileViewer item={focusedItem} />
               </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden">
            
            {/* Top Workspace: Master View */}
            <div className="flex-1 w-full bg-[#0a0c10] bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQYlWNgYGCQwoKxgqGgcJA5h3yFAAs8BRWVSwooAAAAAElFTkSuQmCC')] bg-repeat relative border-b border-dark-700/60 shadow-inner flex items-center justify-center">
                 {renderMasterPreview()}
            </div>

            {/* Bottom Scroller: Detail Carousel */}
            <div className="h-44 w-full bg-dark-900 flex flex-col shrink-0">
                <div className="px-6 py-2 border-b border-dark-700/50 flex items-center justify-between shadow-sm bg-dark-900 z-10 shrink-0">
                   <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Carousel Roll</h3>
                   <span className="text-xs text-gray-400 font-mono bg-dark-800 px-2 py-0.5 rounded shadow-inner border border-dark-700">{allItems.length} Elements</span>
                </div>
                
                <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4 flex items-center gap-4 scroll-smooth">
                    {allItems.map(item => {
                        const id = item.type === 'file' ? item.pair.id : item.name;
                        const isSelected = selectedIdsArray.includes(id);
                        const selIndex = selectedIdsArray.indexOf(id);
                        return (
                            <GalleryThumbnail 
                               key={id} item={item} 
                               isSelected={isSelected}
                               selectionOrderIndex={selIndex !== -1 ? selIndex + 1 : null}
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
