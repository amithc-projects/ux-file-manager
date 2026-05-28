/**
 * DocMentisConsentModal
 *
 * Shown the first time a user tries to preview a DOCX / PPTX / XLSX file.
 * Explains exactly what telemetry docMentis collects before any file opens.
 * The viewer WASM does not load until the user accepts.
 */
import { ExternalLink, ShieldCheck, ShieldOff } from 'lucide-react';
import type { ConsentState } from './useDocMentisSettings';

interface Props {
  onDecide: (v: ConsentState) => void;
}

const COLLECTED = [
  { field: 'domain',          desc: 'Hostname of the embedding website',              example: 'example.com' },
  { field: 'format',          desc: 'Document format opened',                          example: 'docx' },
  { field: 'size_bucket',     desc: 'File size in 100 KB buckets (not exact)',         example: '3' },
  { field: 'viewer_version',  desc: 'docMentis SDK version string',                    example: '0.5.19' },
  { field: 'license_hash',    desc: 'SHA-256 hash of your licence key (empty if none)', example: 'a1b2c3…' },
  { field: 'distinct_id',     desc: 'Anonymous random UUID stored in localStorage',    example: 'f47ac10b-…' },
];

const NOT_COLLECTED = [
  'Document content, filenames, or URLs',
  'Your identity, cookies, or session data',
  'IP addresses (disabled at the collection endpoint)',
  'Any personally identifiable information',
];

export function DocMentisConsentModal({ onDecide }: Props) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl overflow-hidden my-auto">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-dark-700">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck size={20} className="text-blue-400 shrink-0" />
            <h2 className="text-base font-semibold text-white">Enable Office document preview?</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed mt-2">
            Previewing DOCX, PPTX, and XLSX files uses the{' '}
            <a
              href="https://github.com/docMentis/docmentis-udoc-viewer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
            >
              docMentis viewer <ExternalLink size={10} />
            </a>
            . It sends a small anonymous telemetry event <strong className="text-gray-200">once per document opened</strong> to help the authors understand usage.
            No file content is ever transmitted.
          </p>
        </div>

        {/* What is collected */}
        <div className="px-6 py-4 border-b border-dark-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">What is sent</p>
          <div className="rounded-lg overflow-hidden border border-dark-600 text-xs">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-900 text-gray-500">
                  <th className="text-left px-3 py-2 font-semibold">Field</th>
                  <th className="text-left px-3 py-2 font-semibold">Description</th>
                  <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {COLLECTED.map(row => (
                  <tr key={row.field} className="hover:bg-dark-700/40">
                    <td className="px-3 py-2 font-mono text-blue-300 whitespace-nowrap">{row.field}</td>
                    <td className="px-3 py-2 text-gray-300">{row.desc}</td>
                    <td className="px-3 py-2 font-mono text-gray-500 hidden sm:table-cell">{row.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* What is NOT collected */}
        <div className="px-6 py-4 border-b border-dark-700">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What is NOT sent</p>
          <ul className="space-y-1.5">
            {NOT_COLLECTED.map(item => (
              <li key={item} className="flex items-start gap-2 text-xs text-gray-400">
                <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Note about licence key */}
        <div className="px-6 py-3 border-b border-dark-700 bg-dark-900/50">
          <p className="text-xs text-gray-500">
            <span className="text-gray-300 font-medium">Have a docMentis licence key?</span>{' '}
            You can enter it in <span className="text-blue-400">Settings → Office Preview</span> to disable telemetry and remove the attribution badge.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => onDecide('declined')}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-dark-700 rounded-xl transition-colors w-full sm:w-auto justify-center"
          >
            <ShieldOff size={14} />
            No thanks — disable preview
          </button>
          <button
            onClick={() => onDecide('accepted')}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors w-full sm:w-auto justify-center"
          >
            <ShieldCheck size={14} />
            Accept &amp; enable preview
          </button>
        </div>

      </div>
    </div>
  );
}
