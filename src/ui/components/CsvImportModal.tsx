import React, { useState, useRef } from 'react';
import { X, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { SidecarService } from '../../core/services/SidecarService';
import { GridItem } from '../../core/models/FilePair';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dirHandle: FileSystemDirectoryHandle | null;
  items: GridItem[];
  onComplete: () => void;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(cur); cur = ''; rows.push(row); row = [];
        if (ch === '\r') i++;
      } else { cur += ch; }
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

export function CsvImportModal({ isOpen, onClose, dirHandle, items, onComplete }: CsvImportModalProps) {
  const [step, setStep] = useState<'pick' | 'map' | 'preview' | 'importing' | 'done'>('pick');
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filenameCol, setFilenameCol] = useState<number>(0);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const fileItems = items.filter(i => i.type === 'file').map(i => i.type === 'file' ? i.pair.id : '');

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCsv(ev.target?.result as string);
      if (rows.length < 2) return;
      const [hdr, ...data] = rows;
      setHeaders(hdr);
      setCsvRows(data);
      setFilenameCol(0);
      setFieldNames(hdr.map((h, i) => i === 0 ? '' : h));
      setStep('map');
    };
    reader.readAsText(file);
  };

  const buildPreview = () => {
    const warns: string[] = [];
    const matched = csvRows.filter(row => {
      const fn = row[filenameCol]?.trim();
      if (!fn) return false;
      if (!fileItems.includes(fn)) { warns.push(`"${fn}" not found in folder`); return false; }
      return true;
    });
    setWarnings(warns);
    setStep('preview');
    return matched;
  };

  const runImport = async () => {
    if (!dirHandle) return;
    setStep('importing');
    const matched = csvRows.filter(row => fileItems.includes(row[filenameCol]?.trim()));
    let done = 0;
    for (const row of matched) {
      const fn = row[filenameCol].trim();
      const assetPatch: Record<string, unknown> = {};
      headers.forEach((_, ci) => {
        if (ci === filenameCol) return;
        const name = fieldNames[ci]?.trim();
        if (name) assetPatch[name] = row[ci] ?? '';
      });
      try {
        await SidecarService.writeAsset(dirHandle, fn, assetPatch);
      } catch (e) {
        console.error('Failed to write sidecar for', fn, e);
      }
      done++;
      setProgress(Math.round((done / matched.length) * 100));
    }
    setStep('done');
    onComplete();
  };

  const reset = () => {
    setStep('pick');
    setCsvRows([]); setHeaders([]); setFieldNames([]); setWarnings([]); setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
          <h2 className="text-base font-semibold text-white">Import CSV</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Step 1: Pick file */}
          {step === 'pick' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Upload size={40} className="text-blue-400" />
              <p className="text-gray-300 text-sm text-center max-w-sm">
                Select a CSV file. The first row should be column headers. One column must contain the image filenames.
              </p>
              <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white cursor-pointer transition-colors">
                Choose CSV file
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFilePick} className="hidden" />
              </label>
            </div>
          )}

          {/* Step 2: Map columns */}
          {step === 'map' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">Which column contains the filename?</label>
                <select
                  value={filenameCol}
                  onChange={e => setFilenameCol(Number(e.target.value))}
                  className="w-full bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm text-white"
                >
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2 font-medium">Map other columns to metadata field names:</p>
                <div className="flex flex-col gap-2">
                  {headers.map((h, i) => i === filenameCol ? null : (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-28 truncate" title={h}>CSV: <span className="text-gray-300">{h}</span></span>
                      <span className="text-gray-600">→</span>
                      <input
                        type="text"
                        value={fieldNames[i] ?? h}
                        onChange={e => setFieldNames(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                        placeholder="metadata field name"
                        className="flex-1 bg-dark-700 border border-dark-600 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500">Fields will be written under <code className="text-blue-400">asset.*</code> in the metadata JSON, accessible as <code className="text-blue-400">{'{{'}asset.fieldname{'}}'}</code> in pic-machina recipes.</p>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="flex flex-col gap-3">
              {warnings.length > 0 && (
                <div className="bg-amber-900/30 border border-amber-500/40 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2 text-amber-400 text-xs font-medium">
                    <AlertTriangle size={14} /> {warnings.length} unmatched filename{warnings.length !== 1 ? 's' : ''}
                  </div>
                  <ul className="text-xs text-amber-300/80 list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-400">
                {csvRows.filter(r => fileItems.includes(r[filenameCol]?.trim())).length} files will be updated.
              </p>
              <div className="overflow-x-auto border border-dark-700 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-dark-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-400">Filename</th>
                      {headers.map((_, i) => i === filenameCol ? null : (
                        <th key={i} className="px-3 py-2 text-left text-blue-400">{fieldNames[i] || headers[i]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.filter(r => fileItems.includes(r[filenameCol]?.trim())).slice(0, 5).map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-dark-900' : 'bg-dark-800'}>
                        <td className="px-3 py-1.5 text-gray-300 font-mono">{row[filenameCol]}</td>
                        {headers.map((_, i) => i === filenameCol ? null : (
                          <td key={i} className="px-3 py-1.5 text-gray-200">{row[i] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.filter(r => fileItems.includes(r[filenameCol]?.trim())).length > 5 && (
                  <p className="text-xs text-gray-600 px-3 py-2 border-t border-dark-700">+ more rows…</p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-full bg-dark-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-300">Writing metadata… {progress}%</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle size={40} className="text-green-400" />
              <p className="text-gray-300 text-sm">Import complete. Metadata has been written.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-dark-700">
          {step === 'done' ? (
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white">Done</button>
          ) : step === 'importing' ? null : (
            <>
              <button onClick={step === 'pick' ? onClose : reset} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">
                {step === 'pick' ? 'Cancel' : 'Back'}
              </button>
              {step === 'map' && (
                <button onClick={() => buildPreview()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white">
                  Preview
                </button>
              )}
              {step === 'preview' && (
                <button onClick={runImport} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm text-white">
                  Import
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
