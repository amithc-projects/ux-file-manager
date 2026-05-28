import { useState } from 'react';
import { Info, Folder as FolderIcon, FileIcon, Settings, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { GridItem } from '../../core/models/FilePair';

interface InspectorPanelProps {
  selectedItem?: GridItem;
  isOpen: boolean;
  onToggle: () => void;
}

/** Render a single scalar value as a readable string */
function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v || '—';
  if (Array.isArray(v)) {
    if (v.length === 0) return '—';
    // Array of scalars → comma-joined; array of objects → count label
    if (typeof v[0] === 'object') return `${v.length} item${v.length !== 1 ? 's' : ''}`;
    return v.join(', ');
  }
  return String(v);
}

/** Collapsible section for a nested metadata object */
function MetaSection({ label, value }: { label: string; value: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;

  return (
    <div className="border border-indigo-500/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-indigo-900/10 hover:bg-indigo-900/20 transition-colors text-left"
      >
        <span className="text-indigo-300/80 text-xs font-semibold uppercase tracking-wider">{label}</span>
        <ChevronRight size={12} className={`text-indigo-400/50 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 py-2 space-y-1.5 bg-indigo-900/5">
          {entries.map(([k, v]) => {
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
              // Nested object — render as mini key/value block
              const subEntries = Object.entries(v as Record<string, unknown>).filter(([, sv]) => sv !== null && sv !== undefined && sv !== '');
              if (subEntries.length === 0) return null;
              return (
                <div key={k} className="pt-1">
                  <span className="text-indigo-300/50 text-[10px] uppercase tracking-wider">{k}</span>
                  <div className="pl-2 mt-0.5 space-y-0.5">
                    {subEntries.map(([sk, sv]) => (
                      <div key={sk} className="flex gap-2 items-start">
                        <span className="text-gray-500 text-[10px] shrink-0 w-20 truncate">{sk}</span>
                        <span className="text-gray-300 font-mono text-[10px] break-all">{formatValue(sv)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <div key={k} className="flex gap-2 items-start">
                <span className="text-gray-500 text-[10px] shrink-0 w-24 truncate">{k}</span>
                <span className="text-gray-300 font-mono text-[10px] break-all">{formatValue(v)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function InspectorPanel({ selectedItem, isOpen, onToggle }: InspectorPanelProps) {
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const renderContent = () => {
    if (!selectedItem) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-6 text-center h-full">
          <Info size={48} className="mb-4 opacity-30" />
          <p>Select an item to view properties...</p>
        </div>
      );
    }
    const isFile = selectedItem.type === 'file';
    const name = isFile ? selectedItem.pair.id : selectedItem.name;
    const size = isFile ? formatBytes(selectedItem.pair.size || 0) : '--';
    const modifiedDate = isFile && selectedItem.pair.lastModified ? new Date(selectedItem.pair.lastModified).toLocaleString() : '--';
    const meta = isFile ? selectedItem.pair.metadata : undefined;

    // Separate top-level scalar fields from nested objects
    const scalarEntries: [string, unknown][] = [];
    const objectEntries: [string, Record<string, unknown>][] = [];

    if (meta) {
      for (const [k, v] of Object.entries(meta)) {
        if (k.startsWith('$')) continue; // skip $version etc at section level
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          objectEntries.push([k, v as Record<string, unknown>]);
        } else {
          scalarEntries.push([k, v]);
        }
      }
    }

    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4 h-full text-sm">
        {/* File icon + name */}
        <div className="flex flex-col items-center space-y-3 pb-4 border-b border-dark-700">
          <div className="w-16 h-16 rounded-xl bg-dark-900 border border-dark-600 flex items-center justify-center text-blue-500 shadow-inner">
            {isFile ? <FileIcon size={32} /> : <FolderIcon size={32} />}
          </div>
          <h3 className="font-semibold text-center break-all text-gray-200 leading-tight">{name}</h3>
        </div>

        {/* File system properties */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Properties</h4>
          <div className="bg-dark-900/50 rounded-lg p-3 space-y-2 border border-dark-700/50">
            <div className="flex justify-between"><span className="text-gray-500">Kind</span><span className="text-gray-300">{isFile ? 'File' : 'Folder'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="text-gray-300">{size}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Modified</span><span className="text-gray-300 text-xs">{modifiedDate}</span></div>
          </div>
        </div>

        {/* File metadata */}
        {meta && (scalarEntries.length > 0 || objectEntries.length > 0) && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <Settings size={14} /> Metadata
              {meta.$version != null && <span className="ml-auto text-indigo-400/40 normal-case font-normal">v{String(meta.$version)}</span>}
            </h4>

            {/* Scalar top-level fields */}
            {scalarEntries.length > 0 && (
              <div className="bg-indigo-900/10 rounded-lg p-3 space-y-1.5 border border-indigo-500/20">
                {scalarEntries.map(([k, v]) => (
                  <div key={k} className="flex gap-2 items-start">
                    <span className="text-indigo-300/60 text-[10px] shrink-0 w-24 truncate">{k}</span>
                    <span className="text-gray-300 font-mono text-[10px] break-all">{formatValue(v as unknown)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Nested object sections — each collapsible */}
            {objectEntries.map(([k, v]) => (
              <MetaSection key={k} label={k} value={v} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <div className="border-l border-dark-700 bg-dark-800 shrink-0 flex flex-col items-center pt-3 w-8 z-20">
        <button onClick={onToggle} title="Show properties panel" className="p-1 text-gray-500 hover:text-blue-400 transition-colors">
          <PanelRightOpen size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-dark-700 flex flex-col overflow-hidden shadow-2xl shrink-0 z-20 bg-dark-800">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dark-700 bg-dark-900 shrink-0">
        <Info size={14} className="text-blue-400" />
        <span className="text-xs font-semibold text-blue-400 flex-1">Properties</span>
        <button onClick={onToggle} title="Hide properties panel" className="p-0.5 text-gray-500 hover:text-blue-400 transition-colors">
          <PanelRightClose size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {renderContent()}
      </div>
    </div>
  );
}
