import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GridItem } from '../../core/models/FilePair';
import { SidecarService } from '../../core/services/SidecarService';
import { useThumbnails } from '../hooks/useThumbnails';
import { Plus, Download, Upload } from 'lucide-react';

const IMAGE_VIDEO_RE = /\.(jpe?g|png|gif|webp|avif|heic|heif|tiff?|bmp|mp4|mov|avi|mkv|webm|m4v)$/i;

function isMediaFile(item: GridItem): item is Extract<GridItem, { type: 'file' }> {
  return item.type === 'file' && IMAGE_VIDEO_RE.test(item.pair.id);
}

interface DataSheetViewProps {
  items: GridItem[];
  dirHandle: FileSystemDirectoryHandle | null;
  onMetadataUpdated: (id: string, metadata: Record<string, unknown>) => void;
  onImportCsv: () => void;
}

export function DataSheetView({ items, dirHandle, onMetadataUpdated, onImportCsv }: DataSheetViewProps) {
  const mediaItems = items.filter(isMediaFile);

  // Discover all asset keys across existing sidecars
  const discoveredKeys = React.useMemo(() => {
    const keys = new Set<string>();
    mediaItems.forEach(item => {
      const asset = item.pair.metadata?.asset as Record<string, unknown> | undefined;
      if (asset) Object.keys(asset).forEach(k => keys.add(k));
    });
    // Ensure at least a starter column
    if (keys.size === 0) keys.add('title');
    return Array.from(keys);
  }, [mediaItems]);

  const [columns, setColumns] = useState<string[]>(discoveredKeys);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const newColInputRef = useRef<HTMLInputElement>(null);

  // Sync columns when discovered keys change (e.g. after CSV import)
  useEffect(() => {
    setColumns(prev => {
      const merged = [...prev];
      discoveredKeys.forEach(k => { if (!merged.includes(k)) merged.push(k); });
      return merged;
    });
  }, [discoveredKeys.join(',')]);

  useEffect(() => {
    if (addingCol) newColInputRef.current?.focus();
  }, [addingCol]);

  const handleCellBlur = useCallback(async (
    item: Extract<GridItem, { type: 'file' }>,
    col: string,
    value: string
  ) => {
    if (!dirHandle) return;

    setSaving(prev => new Set(prev).add(item.pair.id));
    try {
      const merged = await SidecarService.writeAsset(dirHandle, item.pair.id, { [col]: value });
      onMetadataUpdated(item.pair.id, merged);
    } catch (e) {
      console.error('Failed to save sidecar', e);
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(item.pair.id); return s; });
    }
  }, [dirHandle, onMetadataUpdated]);

  const addColumn = () => {
    const name = newColName.trim();
    if (name && !columns.includes(name)) {
      setColumns(prev => [...prev, name]);
    }
    setNewColName('');
    setAddingCol(false);
  };

  const exportCsv = () => {
    const headers = ['filename', ...columns];
    const rows = mediaItems.map(item => {
      const asset = item.pair.metadata?.asset as Record<string, unknown> | undefined;
      const cells = columns.map(col => {
        const v = String(asset?.[col] ?? '');
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"`
          : v;
      });
      return [item.pair.id, ...cells].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sidecar-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  function DataSheetRow({
    item,
    columns,
    rowIdx,
    isSaving,
    onCellBlur,
  }: {
    item: Extract<GridItem, { type: 'file' }>;
    columns: string[];
    rowIdx: number;
    isSaving: boolean;
    onCellBlur: (col: string, value: string) => void;
  }) {
    const thumbUrl = useThumbnails(item.pair.mainHandle, item.pair.thumbnailHandle);
    const getCellValue = (col: string) => {
      const asset = item.pair.metadata?.asset as Record<string, unknown> | undefined;
      return String(asset?.[col] ?? '');
    };
    return (
      <tr className={`${rowIdx % 2 === 0 ? 'bg-dark-900' : 'bg-dark-800'} hover:bg-dark-800 transition-colors`}>
        <td className="border-b border-r border-dark-700 p-1 w-12">
          <div className="w-10 h-10 rounded overflow-hidden bg-dark-700 flex items-center justify-center">
            {thumbUrl
              ? <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
              : <span className="text-gray-600 text-xs">?</span>
            }
          </div>
        </td>
        <td className="border-b border-r border-dark-700 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs font-mono truncate max-w-[200px]" title={item.pair.id}>
              {item.pair.id}
            </span>
            {isSaving && <span className="text-blue-400 text-xs animate-pulse">saving…</span>}
          </div>
        </td>
        {columns.map(col => (
          <td key={col} className="border-b border-r border-dark-700 p-0">
            <input
              type="text"
              defaultValue={getCellValue(col)}
              key={`${item.pair.id}-${col}-${getCellValue(col)}`}
              onBlur={e => onCellBlur(col, e.target.value)}
              className="w-full h-full px-3 py-2 bg-transparent text-gray-200 text-xs outline-none focus:bg-blue-900/20 focus:ring-1 focus:ring-inset focus:ring-blue-500/50"
              placeholder="—"
            />
          </td>
        ))}
        <td className="border-b border-dark-700" />
      </tr>
    );
  }

  if (mediaItems.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>No image or video files in this folder.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-700 bg-dark-800 shrink-0">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Data Sheet</span>
        <span className="text-xs text-gray-600">— {mediaItems.length} files · edit cells to write sidecar metadata</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onImportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-dark-700 hover:bg-dark-600 text-gray-300 border border-dark-600"
          >
            <Upload size={12} /> Import CSV
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-dark-700 hover:bg-dark-600 text-gray-300 border border-dark-600"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-dark-800">
            <tr>
              <th className="w-12 border-b border-r border-dark-700 p-0" />
              <th className="border-b border-r border-dark-700 px-3 py-2 text-left text-xs font-semibold text-gray-400 whitespace-nowrap min-w-[160px]">
                Filename
              </th>
              {columns.map(col => (
                <th
                  key={col}
                  className="border-b border-r border-dark-700 px-3 py-2 text-left text-xs font-semibold text-blue-400 whitespace-nowrap min-w-[140px]"
                >
                  {col}
                </th>
              ))}
              <th className="border-b border-dark-700 px-2 py-2 w-8">
                {addingCol ? (
                  <form
                    onSubmit={e => { e.preventDefault(); addColumn(); }}
                    className="flex items-center gap-1"
                  >
                    <input
                      ref={newColInputRef}
                      value={newColName}
                      onChange={e => setNewColName(e.target.value)}
                      onBlur={() => { if (!newColName.trim()) setAddingCol(false); }}
                      placeholder="field name"
                      className="w-24 bg-dark-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                    />
                    <button type="submit" className="text-blue-400 hover:text-blue-300 text-xs">✓</button>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingCol(true)}
                    title="Add column"
                    className="text-gray-600 hover:text-blue-400 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {mediaItems.map((item, rowIdx) => (
              <DataSheetRow
                key={item.pair.id}
                item={item}
                columns={columns}
                rowIdx={rowIdx}
                isSaving={saving.has(item.pair.id)}
                onCellBlur={(col, value) => handleCellBlur(item, col, value)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
