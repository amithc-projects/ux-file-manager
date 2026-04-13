import { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

interface PathPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (path: string) => void;
}

export function PathPromptModal({ isOpen, onClose, onSubmit }: PathPromptModalProps) {
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-dark-800 border border-dark-600 shadow-2xl shadow-blue-500/10 rounded-xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center gap-3 px-6 py-4 border-b border-dark-700 bg-dark-900/50">
          <FolderPlus size={20} className="text-blue-400 shrink-0" />
          <h2 className="font-semibold text-lg text-gray-100 truncate">
            Create Path / Directory
          </h2>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-dark-700 rounded-full transition-colors shrink-0">
            <X size={18} className="text-gray-400 hover:text-white" />
          </button>
        </div>

        <div className="p-6">
           <label className="block text-sm font-medium text-gray-400 mb-2">
             Provide the desired path string (e.g. <span className="text-blue-300 font-mono bg-blue-500/20 px-1 rounded">folder/sub/sub2</span>)
           </label>
           <input 
              type="text" 
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSubmit(value.trim()); }}
              placeholder="assets/images/heroes..."
              className="w-full bg-dark-900 border border-dark-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-2.5 text-gray-100 transition-shadow outline-none font-mono"
           />
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-dark-900/50 border-t border-dark-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700 transition-colors">
            Cancel
          </button>
          <button 
            disabled={!value.trim()}
            onClick={() => onSubmit(value.trim())}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-lg bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            Create
          </button>
        </div>

      </div>
    </div>
  );
}
