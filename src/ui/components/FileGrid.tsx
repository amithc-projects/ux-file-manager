import React from 'react';
import { GridItem } from '../../core/models/FilePair';
import { useThumbnails } from '../hooks/useThumbnails';
import { FileIcon, Image as ImageIcon, Folder, Film, Check } from 'lucide-react';

export type ViewMode = 'grid' | 'gallery' | 'list';

interface FileGridItemProps {
  item: GridItem;
  isSelected: boolean;
  selectionOrderIndex: number | null; // 1-based order index, null if not selected
  totalSelected: number;
  viewMode: ViewMode;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onItemHover?: (item: GridItem, e: React.MouseEvent) => void;
  onItemLeave?: () => void;
}



function FileGridItem({ item, isSelected, selectionOrderIndex, totalSelected, viewMode, onClick, onDoubleClick, onContextMenu, onItemHover, onItemLeave }: FileGridItemProps) {
  const isFile = item.type === 'file';
  const pair = isFile ? item.pair : undefined;
  
  const clickTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSingleClick = (e: React.MouseEvent) => {
     e.stopPropagation();
     if (e.detail === 1) {
        clickTimeout.current = setTimeout(() => {
           onClick(e);
        }, 220);
     }
  };

  const handleDoubleClickCore = (e: React.MouseEvent) => {
     e.stopPropagation();
     if (clickTimeout.current) clearTimeout(clickTimeout.current);
     onDoubleClick(e);
  };
  
  const thumbnailUrl = useThumbnails(pair?.mainHandle);
  
  const itemName = isFile ? pair!.id : item.name;
  const isImage = isFile && /\.(jpe?g|png|gif|webp|bmp)$/i.test(itemName);
  const isVideo = isFile && /\.(mp4|webm|ogg|mov)$/i.test(itemName);

  const IconComponent = () => {
    if (!isFile) return <Folder size={viewMode === 'list' ? 24 : 64} className="text-blue-500/80 drop-shadow-md" fill="currentColor" />;
    if (thumbnailUrl) return <img src={thumbnailUrl} alt={itemName} className="w-full h-full object-cover rounded-md pointer-events-none" />;
    if (isImage) return <ImageIcon size={viewMode === 'list' ? 20 : 48} className="text-gray-500 pointer-events-none" />;
    if (isVideo) return <Film size={viewMode === 'list' ? 20 : 48} className="text-gray-500 pointer-events-none" />;
    return <FileIcon size={viewMode === 'list' ? 20 : 48} className="text-gray-500 pointer-events-none" />;
  };

  const selectedClass = isSelected 
    ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-10' 
    : 'border-dark-700 bg-dark-800 hover:border-dark-600 hover:bg-dark-700 z-0';

  const SelectionBadge = () => {
    if (selectionOrderIndex === null) return null;
    return (
       <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-blue-500 text-white shadow-lg border border-white flex items-center justify-center font-bold text-xs pointer-events-none z-20">
          {totalSelected === 1 ? <Check size={14} strokeWidth={3} /> : selectionOrderIndex}
       </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <div 
        onClick={handleSingleClick}
        onDoubleClick={handleDoubleClickCore}
        onContextMenu={onContextMenu}
        onMouseEnter={onItemHover && itemName !== '..' ? (e) => onItemHover(item, e) : undefined}
        onMouseLeave={onItemLeave}
        className={`group cursor-pointer border-b last:border-b-0 flex items-center px-4 py-2 transition-all relative select-none ${selectedClass}`}
      >
        <div className="w-8 h-8 flex items-center justify-center shrink-0 mr-3 relative">
          <SelectionBadge />
          <IconComponent />
        </div>
        <div className="flex-1 flex items-center gap-2 truncate pointer-events-none">
          <p className="text-sm font-medium truncate text-gray-200" title={itemName}>{itemName}</p>
          {isFile && pair!.sidecarHandle && (
            <span className="bg-indigo-500/80 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold text-white shrink-0">Meta</span>
          )}
        </div>
        <div className="flex items-center justify-end gap-6 shrink-0 text-right pointer-events-none pr-2">
           {isFile ? (
              <>
                 <p className="text-xs text-gray-400 w-24 text-right">{pair!.size ? `${(pair!.size / 1024).toFixed(1)} KB` : ''}</p>
                 <p className="text-xs text-gray-500 w-40 text-right">{pair!.lastModified ? new Date(pair!.lastModified).toLocaleString() : ''}</p>
              </>
           ) : (
              <p className="text-xs text-gray-500 w-40 text-right">Folder</p>
           )}
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={handleSingleClick}
      onDoubleClick={handleDoubleClickCore}
      onContextMenu={onContextMenu}
      onMouseEnter={onItemHover && itemName !== '..' ? (e) => onItemHover(item, e) : undefined}
      onMouseLeave={onItemLeave}
      className={`group cursor-pointer rounded-xl border flex flex-col overflow-visible transition-all duration-200 h-full select-none relative hover:z-[60] ${selectedClass}`}
    >
      <SelectionBadge />
      <div className="w-full py-[50%] flex items-center justify-center bg-dark-900/50 relative shrink-0 rounded-t-xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 flex items-center justify-center p-4">
           <IconComponent />
        </div>
        
        {isFile && pair!.sidecarHandle && (
           <div className="absolute bottom-2 right-2 bg-indigo-500/80 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold text-white shadow-sm z-10 pointers-none">
             Meta
           </div>
        )}
      </div>
      <div className="p-3 border-t border-dark-700/50 flex-1 truncate pointers-none">
        <p className="text-sm font-medium truncate text-gray-200" title={itemName}>
          {itemName}
        </p>
        <div className="flex items-center justify-between mt-1">
           <p className="text-xs text-gray-500">
             {!isFile ? 'Folder' : pair!.size ? `${(pair!.size / (1024 * 1024) >= 1) ? (pair!.size / (1024 * 1024)).toFixed(1) + ' MB' : (pair!.size / 1024).toFixed(1) + ' KB'}` : 'Unknown Size'}
           </p>
           {isFile && pair!.sidecarHandle && <span className="text-[10px] text-indigo-400 uppercase font-bold">Paired</span>}
        </div>
      </div>
    </div>
  );
}

export interface GroupedItems {
  groupName: string;
  items: GridItem[];
}

interface FileGridProps {
  groups: GroupedItems[];
  selectedIdsArray: (string | null)[];
  viewMode: ViewMode;
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onItemDoubleClick: (item: GridItem, e: React.MouseEvent) => void;
  onItemContextMenu: (item: GridItem, e: React.MouseEvent) => void;
  onItemHover?: (item: GridItem, e: React.MouseEvent) => void;
  onItemLeave?: () => void;
}

export function FileGrid({ groups, selectedIdsArray, viewMode, onItemClick, onItemDoubleClick, onItemContextMenu, onItemHover, onItemLeave }: FileGridProps) {
  if (groups.length === 0 || (groups.length === 1 && groups[0].items.length === 0)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
        <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center border border-dark-700">
           <FileIcon size={24} />
        </div>
        <p>No items found.</p>
      </div>
    );
  }

  const getSelectionOrderIndex = (id: string) => {
     const idx = selectedIdsArray.indexOf(id);
     return idx !== -1 ? idx + 1 : null;
  };

  const renderItems = (items: GridItem[]) => {
    const totalSelected = selectedIdsArray.filter(Boolean).length;

    if (viewMode === 'list') {
      return (
        <div className="flex flex-col border border-dark-700 rounded-xl bg-dark-800 w-full mb-6 max-w-5xl">
          {items.map(item => {
            const id = item.type === 'file' ? item.pair.id : item.name;
            return (
              <FileGridItem 
                key={id} item={item} 
                isSelected={getSelectionOrderIndex(id) !== null} 
                selectionOrderIndex={getSelectionOrderIndex(id)}
                totalSelected={totalSelected}
                viewMode={viewMode}
                onClick={(e) => onItemClick(id, e)} 
                onDoubleClick={(e) => onItemDoubleClick(item, e)}
                onContextMenu={(e) => onItemContextMenu(item, e)}
                onItemHover={onItemHover}
                onItemLeave={onItemLeave}
              />
            );
          })}
        </div>
      );
    }

    const gridCols = viewMode === 'gallery' 
      ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' 
      : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8';

    return (
      <div className={`grid ${gridCols} gap-4 w-full items-start mb-8`}>
        {items.map(item => {
          const id = item.type === 'file' ? item.pair.id : item.name;
          return (
            <FileGridItem 
              key={id} item={item} 
              isSelected={getSelectionOrderIndex(id) !== null} 
              selectionOrderIndex={getSelectionOrderIndex(id)}
              totalSelected={totalSelected}
              viewMode={viewMode}
              onClick={(e) => onItemClick(id, e)} 
              onDoubleClick={(e) => onItemDoubleClick(item, e)}
              onContextMenu={(e) => onItemContextMenu(item, e)}
              onItemHover={onItemHover}
              onItemLeave={onItemLeave}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={`p-4 pt-12 overflow-y-auto overflow-x-hidden w-full ${viewMode === 'list' ? 'flex flex-col items-center' : ''}`}>
      {groups.map((group, idx) => (
        <div key={idx} className="w-full max-w-screen-2xl mx-auto">
          {group.groupName && group.items.length > 0 && (
             <h3 className="text-xl font-bold mb-4 text-gray-300 border-b border-dark-700 pb-2">{group.groupName}</h3>
          )}
          {group.items.length > 0 && renderItems(group.items)}
        </div>
      ))}
    </div>
  );
}
