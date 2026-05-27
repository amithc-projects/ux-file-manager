import { useState, useEffect } from 'react';
import { X, Cloud, Save, Trash2, Sun, Moon } from 'lucide-react';

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

  useEffect(() => {
    if (isOpen) {
      setEndpoint(localStorage.getItem(LS_ENDPOINT) || '');
      setToken   (localStorage.getItem(LS_TOKEN)    || '');
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
