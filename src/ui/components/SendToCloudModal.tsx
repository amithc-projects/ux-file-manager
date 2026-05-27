import { useEffect, useRef } from 'react';
import { X, Cloud, Settings } from 'lucide-react';
import { StcConfig } from './SettingsModal';

interface SendToCloudModalProps {
  isOpen: boolean;
  files: File[];
  config: StcConfig;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export function SendToCloudModal({ isOpen, files, config, onClose, onOpenSettings }: SendToCloudModalProps) {
  const stcRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !stcRef.current || mountedRef.current) return;
    mountedRef.current = true;

    // Create the <send-to-cloud> web component and inject it
    const stc = document.createElement('send-to-cloud') as any;
    stc.setAttribute('endpoint', config.endpoint);
    stc.setAttribute('token', config.token);
    stc.setAttribute('no-dropzone', '');
    stcRef.current.appendChild(stc);

    // Pass files once the component is connected
    setTimeout(() => {
      if (typeof stc.setFiles === 'function') stc.setFiles(files);
    }, 0);

    return () => {
      mountedRef.current = false;
      if (stcRef.current) stcRef.current.innerHTML = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700 shrink-0">
          <div className="flex items-center gap-2">
            <Cloud size={18} className="text-blue-400" />
            <h2 className="text-base font-semibold text-white">
              Send to Cloud
              <span className="ml-2 text-sm font-normal text-gray-400">{files.length} file{files.length !== 1 ? 's' : ''}</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* send-to-cloud component mount point */}
        <div ref={stcRef} className="flex-1 overflow-y-auto" />

        {/* Settings hint footer */}
        <div className="px-5 py-3 border-t border-dark-700 bg-dark-900/50 shrink-0 flex items-center gap-2 text-xs text-gray-500">
          <span>Having trouble?</span>
          {onOpenSettings ? (
            <button
              onClick={() => { onClose(); onOpenSettings(); }}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Settings size={11} /> Check your cloud settings
            </button>
          ) : (
            <span>Check your cloud endpoint and token in Settings.</span>
          )}
        </div>
      </div>
    </div>
  );
}
