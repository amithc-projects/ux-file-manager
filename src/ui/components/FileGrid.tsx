import React from 'react';
import { useTranslation } from 'react-i18next';
import { GridItem } from '../../core/models/FilePair';
import { useThumbnails } from '../hooks/useThumbnails';
import { FileIcon, Image as ImageIcon, Folder, Film, Check, Music, Play, Braces, FileText, FileCode, Archive, Hash } from 'lucide-react';

const CodeTextIcon = ({ text, className, size }: { text: string, className: string, size: number }) => (
  <div 
    style={{ width: size, height: size, fontSize: size * 0.35 }} 
    className={`flex items-center justify-center font-mono font-bold border-2 rounded-lg pointer-events-none ${className}`}
  >
    {text}
  </div>
);

/** Small play badge overlay shown on video items (bottom-left of thumbnail) */
const VideoBadge = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
  const dim = size === 'sm' ? 16 : 20;
  const iconSize = size === 'sm' ? 7 : 9;
  return (
    <div style={{
      position: 'absolute',
      bottom: 6,
      left: 6,
      width: dim,
      height: dim,
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 20,
    }}>
      <Play size={iconSize} fill="white" stroke="none" strokeWidth={0} style={{ marginLeft: 1, color: 'white' }} />
    </div>
  );
};

export type ViewMode = 'grid' | 'filmstrip' | 'list' | 'data';

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
  const { t } = useTranslation();
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
  
  const thumbnailUrl = useThumbnails(pair?.mainHandle, pair?.thumbnailHandle);
  
  const itemName = isFile ? pair!.id : item.name;
  const isImage = isFile && /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(itemName);
  const isVideo = isFile && /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(itemName);
  const isAudio = isFile && /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(itemName);
  const isJson  = isFile && /\.json$/i.test(itemName);
  const isMd = isFile && /\.(md|markdown|txt)$/i.test(itemName);
  const isArchive = isFile && /\.zip$/i.test(itemName);
  const isPdf = isFile && /\.pdf$/i.test(itemName);

  const isHtml = isFile && /\.html?$/i.test(itemName);
  const isJsx = isFile && /\.jsx$/i.test(itemName);
  const isTsx = isFile && /\.tsx$/i.test(itemName);
  const isJs = isFile && /\.js$/i.test(itemName);
  const isTs = isFile && /\.ts$/i.test(itemName);
  const isCss = isFile && /\.css$/i.test(itemName);
  const isPy = isFile && /\.py$/i.test(itemName);
  const isSh = isFile && /\.sh$/i.test(itemName);
  const isOtherCode = isFile && /\.(csv)$/i.test(itemName);

  const IconComponent = () => {
    const s = viewMode === 'list' ? 20 : 48;
    if (!isFile) return <Folder size={viewMode === 'list' ? 24 : 64} className="text-blue-500/80 drop-shadow-md" fill="currentColor" />;
    if (thumbnailUrl) return <img src={thumbnailUrl} alt={itemName} className="w-full h-full object-cover rounded-md pointer-events-none" />;
    if (isImage) return <ImageIcon size={s} className="text-gray-500 pointer-events-none" />;
    if (isVideo) return <Film size={s} className="text-gray-500 pointer-events-none" />;
    if (isAudio) return <Music size={s} className="text-purple-500 pointer-events-none" />;
    if (isJson)  return <Braces size={s} className="text-amber-400/90 pointer-events-none" />;
    if (isMd)    return <FileText size={s} className="text-blue-400 pointer-events-none" />;
    if (isArchive) return <Archive size={s} className="text-orange-500 pointer-events-none" />;
    if (isPdf)   return <FileText size={s} className="text-red-500 pointer-events-none" />;
    
    // Code specific icons
    if (isHtml) return <FileCode size={s} className="text-orange-500 pointer-events-none" />;
    if (isJsx) return <FileCode size={s} className="text-cyan-400 pointer-events-none" />;
    if (isTsx) return <FileCode size={s} className="text-blue-500 pointer-events-none" />;
    if (isSh) return <Hash size={s} className="text-gray-400 pointer-events-none" />;
    if (isJs) return <CodeTextIcon text="JS" className="border-yellow-500/30 text-yellow-500 bg-yellow-500/10" size={s} />;
    if (isTs) return <CodeTextIcon text="TS" className="border-blue-500/30 text-blue-500 bg-blue-500/10" size={s} />;
    if (isCss) return <CodeTextIcon text="CSS" className="border-pink-500/30 text-pink-500 bg-pink-500/10" size={s} />;
    if (isPy) return <CodeTextIcon text="PY" className="border-green-500/30 text-green-500 bg-green-500/10" size={s} />;
    if (isOtherCode) return <FileCode size={s} className="text-gray-400 pointer-events-none" />;

    return <FileIcon size={s} className="text-gray-500 pointer-events-none" />;
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
          {isVideo && <VideoBadge size="sm" />}
        </div>
        <div className="flex-1 flex items-center gap-2 truncate pointer-events-none">
          <p className="text-sm font-medium truncate text-gray-200" title={itemName}>{itemName}</p>
          {isFile && pair!.sidecarHandle && (
            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" title={t('fileGrid.hasMetadata')} />
          )}
        </div>
        <div className="flex items-center justify-end gap-6 shrink-0 text-right pointer-events-none pr-2">
           {isFile ? (
              <>
                 <p className="text-xs text-gray-400 w-24 text-right">{pair!.size ? `${(pair!.size / 1024).toFixed(1)} KB` : ''}</p>
                 <p className="text-xs text-gray-500 w-40 text-right">{pair!.lastModified ? new Date(pair!.lastModified).toLocaleString() : ''}</p>
              </>
           ) : (
              <p className="text-xs text-gray-500 w-40 text-right">{t('fileGrid.folder')}</p>
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
        {isVideo && <VideoBadge />}
        {isFile && pair!.sidecarHandle && (
           <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-400 shadow-sm z-10 pointer-events-none" title={t('fileGrid.hasMetadata')} />
        )}
      </div>
      <div className="p-3 border-t border-dark-700/50 flex-1 truncate pointers-none">
        <p className="text-sm font-medium truncate text-gray-200" title={itemName}>
          {itemName}
        </p>
        <div className="flex items-center justify-between mt-1">
           <p className="text-xs text-gray-500">
             {!isFile ? t('fileGrid.folder') : pair!.size ? `${(pair!.size / (1024 * 1024) >= 1) ? (pair!.size / (1024 * 1024)).toFixed(1) + ' MB' : (pair!.size / 1024).toFixed(1) + ' KB'}` : t('fileGrid.unknownSize')}
           </p>
           {isFile && pair!.sidecarHandle && <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" title={t('fileGrid.hasMetadata')} />}
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
  thumbnailSize?: number;
  onItemClick: (id: string, e: React.MouseEvent) => void;
  onItemDoubleClick: (item: GridItem, e: React.MouseEvent) => void;
  onItemContextMenu: (item: GridItem, e: React.MouseEvent) => void;
  onItemHover?: (item: GridItem, e: React.MouseEvent) => void;
  onItemLeave?: () => void;
}

const GROUP_NAME_KEYS: Record<string, string> = {
  'Navigation': 'fileGrid.groups.navigation',
  'Images': 'fileGrid.groups.images',
  'Documents': 'fileGrid.groups.documents',
  'Videos': 'fileGrid.groups.videos',
  'Other Files': 'fileGrid.groups.otherFiles',
  'Folders': 'fileGrid.groups.folders',
};

export function FileGrid({ groups, selectedIdsArray, viewMode, thumbnailSize = 160, onItemClick, onItemDoubleClick, onItemContextMenu, onItemHover, onItemLeave }: FileGridProps) {
  const { t } = useTranslation();
  const translateGroup = (name: string) => GROUP_NAME_KEYS[name] ? t(GROUP_NAME_KEYS[name]) : name;
  if (groups.length === 0 || (groups.length === 1 && groups[0].items.length === 0)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
        <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center border border-dark-700">
           <FileIcon size={24} />
        </div>
        <p>{t('fileGrid.noItems')}</p>
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

    return (
      <div className="grid gap-4 w-full items-start mb-8" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}>
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
             <h3 className="text-xl font-bold mb-4 text-gray-300 border-b border-dark-700 pb-2">{translateGroup(group.groupName)}</h3>
          )}
          {group.items.length > 0 && renderItems(group.items)}
        </div>
      ))}
    </div>
  );
}
