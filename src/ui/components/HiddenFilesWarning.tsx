/**
 * HiddenFilesWarning — optional orange banner shown when the host tells us
 * that some files in the current folder are hidden from the browser.
 *
 * Props are passed by the host via attributes on <zumilabs-file-browser>:
 *   hidden-files-count="5"
 *   hidden-files-message="5 rejected files are hidden"
 */

import { AlertTriangle } from 'lucide-react';

interface HiddenFilesWarningProps {
  count: number;
  message?: string;
}

export function HiddenFilesWarning({ count, message }: HiddenFilesWarningProps) {
  if (!count || count <= 0) return null;

  const text = message || `${count} file${count !== 1 ? 's' : ''} in this folder are hidden`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/15 border-b border-orange-500/30 text-orange-400 text-xs shrink-0">
      <AlertTriangle size={14} className="shrink-0" />
      <span>{text}</span>
    </div>
  );
}
