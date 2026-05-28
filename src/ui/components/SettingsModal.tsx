import { useState, useEffect } from 'react';
import { X, Cloud, Save, Trash2, Sun, Moon, FileText, Key } from 'lucide-react';
import { useDocMentisSettings } from './office/useDocMentisSettings';

const LS_ENDPOINT = 'zl_fb_stc_endpoint';
const LS_TOKEN    = 'zl_fb_stc_token';
export const LS_THEME = 'zl_fb_theme';

export type Theme = 'dark' | 'light';

export function loadTheme(): Theme {
  return (localStorage.getItem(LS_THEME) as Theme) || 'dark';
}

export interface StcConfig {
  endpoint: string;
  token: string;
}

export function loadStcConfig(): StcConfig | null {
  const endpoint = localStorage.getItem(LS_ENDPOINT) || '';
  const token    = localStorage.getItem(LS_TOKEN) || '';
  if (!endpoint || !token) return null;
  return { endpoint, token };
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cfg: StcConfig | null) => void;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  /** When set, the host forces a theme and the toggle is disabled */
  forcedTheme?: Theme;
}

export function SettingsModal({ isOpen, onClose, onSave, theme, onThemeChange, forcedTheme }: SettingsModalProps) {
  const [endpoint, setEndpoint] = useState('');
  const [token,    setToken]    = useState('');

  const { settings, setConsent, setLicenseKey, setPreviewEnabled } = useDocMentisSettings();
  const [licenseInput, setLicenseInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEndpoint(localStorage.getItem(LS_ENDPOINT) || '');
      setToken   (localStorage.getItem(LS_TOKEN)    || '');
      setLicenseInput(settings.licenseKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const ep = endpoint.trim();
    const tk = token.trim();
    if (ep && tk) {
      localStorage.setItem(LS_ENDPOINT, ep);
      localStorage.setItem(LS_TOKEN,    tk);
      onSave({ endpoint: ep, token: tk });
    } else {
      handleClear();
    }
    onClose();
  };

  const handleClear = () => {
    localStorage.removeItem(LS_ENDPOINT);
    localStorage.removeItem(LS_TOKEN);
    onSave(null);
    onClose();
  };

  const handleThemeToggle = () => {
    if (forcedTheme) return;
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(LS_THEME, next);
    onThemeChange(next);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-600 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
          <h2 className="text-base font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-6">

          {/* Theme toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Appearance</label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                {theme === 'dark' ? <Moon size={15} className="text-blue-400" /> : <Sun size={15} className="text-yellow-400" />}
                <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
                {forcedTheme && <span className="text-xs text-gray-500">(set by host)</span>}
              </div>
              <button
                onClick={handleThemeToggle}
                disabled={!!forcedTheme}
                title={forcedTheme ? 'Theme is controlled by the host application' : 'Toggle theme'}
                className={`relative w-11 h-6 rounded-full transition-colors ${theme === 'light' ? 'bg-blue-500' : 'bg-dark-600'} ${forcedTheme ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${theme === 'light' ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Send to Cloud */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cloud size={12} /> Send to Cloud
            </label>
            <p className="text-xs text-gray-400">
              Configure your Send to Cloud facade endpoint and API token. Stored in your browser's local storage.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-300">Endpoint URL</label>
              <input
                type="url"
                placeholder="https://your-facade.example.com"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-300">API Token</label>
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={token}
                onChange={e => setToken(e.target.value)}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Office Preview */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={12} /> Office Preview
            </label>
            <p className="text-xs text-gray-400 leading-relaxed">
              DOCX, PPTX and XLSX previews use the{' '}
              <a href="https://github.com/docMentis/docmentis-udoc-viewer" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                docMentis viewer
              </a>
              {' '}which sends anonymous telemetry once per document open.
            </p>

            {/* Consent status */}
            <div className="flex items-center justify-between bg-dark-900 border border-dark-600 rounded-lg px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-300">Telemetry consent</span>
                <span className={`text-xs mt-0.5 ${
                  settings.consent === 'accepted' ? 'text-green-400' :
                  settings.consent === 'declined' ? 'text-red-400' :
                  'text-gray-500'
                }`}>
                  {settings.consent === 'accepted' ? '✓ Accepted' :
                   settings.consent === 'declined' ? '✗ Declined — preview disabled' :
                   'Not yet decided'}
                </span>
              </div>
              {settings.consent !== null && (
                <button
                  onClick={() => setConsent(null)}
                  className="text-xs text-blue-400 hover:text-blue-300 hover:bg-dark-700 px-2 py-1 rounded-lg transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Per-format toggles */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-400">Enable preview by format</span>
              {(['docx', 'pptx', 'xlsx'] as const).map(ext => {
                const enabled =
                  ext === 'docx' ? settings.previewDocx :
                  ext === 'pptx' ? settings.previewPptx :
                                   settings.previewXlsx;
                return (
                  <div key={ext} className="flex items-center justify-between py-1.5 px-3 bg-dark-900 border border-dark-600 rounded-lg">
                    <span className="text-xs font-mono text-gray-300 uppercase">.{ext}</span>
                    <button
                      onClick={() => setPreviewEnabled(ext, !enabled)}
                      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-blue-500' : 'bg-dark-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* License key */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Key size={11} /> Licence key
                <span className="text-gray-600 font-normal">(disables telemetry &amp; attribution badge)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="dm_live_••••••••"
                  value={licenseInput}
                  onChange={e => setLicenseInput(e.target.value)}
                  className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
                <button
                  onClick={() => setLicenseKey(licenseInput)}
                  className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-gray-300 hover:text-white text-xs rounded-lg transition-colors border border-dark-600"
                >
                  Save
                </button>
              </div>
              {settings.licenseKey && (
                <button
                  onClick={() => { setLicenseKey(''); setLicenseInput(''); }}
                  className="text-xs text-red-400 hover:text-red-300 self-start"
                >
                  Remove licence key
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-dark-700 bg-dark-900/50">
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <Trash2 size={14} /> Clear cloud config
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!endpoint.trim() || !token.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Save size={14} /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
