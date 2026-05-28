/**
 * OfficeViewer
 *
 * Gate-keeps docMentis rendering behind:
 *   1. Per-format enable/disable setting
 *   2. Telemetry consent (accepted / declined / not-yet-asked)
 *
 * Shows the consent modal on first use and delegates rendering to
 * DocMentisViewer once accepted.
 */
import { Settings } from 'lucide-react';
import { DocMentisConsentModal } from './DocMentisConsentModal';
import { DocMentisViewer } from './DocMentisViewer';
import { useDocMentisSettings } from './useDocMentisSettings';
import type { ConsentState } from './useDocMentisSettings';

interface Props {
  file: File;
  ext: 'docx' | 'pptx' | 'xlsx';
  onOpenSettings?: () => void;
}

export function OfficeViewer({ file, ext, onOpenSettings }: Props) {
  const { settings, setConsent } = useDocMentisSettings();

  const formatEnabled =
    ext === 'docx' ? settings.previewDocx :
    ext === 'pptx' ? settings.previewPptx :
                     settings.previewXlsx;

  const formatLabel = ext.toUpperCase();

  // ── Format disabled in settings ──────────────────────────────────────────
  if (!formatEnabled) {
    return (
      <Blocked
        title={`${formatLabel} preview is disabled`}
        message={`You can enable it in Settings → Office Preview.`}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  // ── Not yet asked ─────────────────────────────────────────────────────────
  if (settings.consent === null) {
    return <DocMentisConsentModal onDecide={(v: ConsentState) => setConsent(v)} />;
  }

  // ── User declined ─────────────────────────────────────────────────────────
  if (settings.consent === 'declined') {
    return (
      <Blocked
        title="Office preview unavailable"
        message="You chose not to allow the docMentis telemetry required for previewing DOCX, PPTX, and XLSX files. You can change this in Settings → Office Preview."
        onOpenSettings={onOpenSettings}
      />
    );
  }

  // ── Accepted — render the viewer ──────────────────────────────────────────
  return (
    <DocMentisViewer
      file={file}
      licenseKey={settings.licenseKey || undefined}
    />
  );
}

// ── Shared "blocked" state ────────────────────────────────────────────────────
function Blocked({ title, message, onOpenSettings }: {
  title: string;
  message: string;
  onOpenSettings?: () => void;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 opacity-70">
      <div className="w-14 h-14 rounded-2xl bg-dark-700 border border-dark-600 flex items-center justify-center">
        <Settings size={28} className="text-gray-500" />
      </div>
      <div className="text-center max-w-xs">
        <p className="text-gray-300 font-semibold text-sm mb-1">{title}</p>
        <p className="text-gray-500 text-xs leading-relaxed">{message}</p>
      </div>
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="px-4 py-2 text-sm text-blue-400 hover:text-white border border-blue-500/40 hover:bg-blue-600 rounded-xl transition-colors"
        >
          Open Settings
        </button>
      )}
    </div>
  );
}
