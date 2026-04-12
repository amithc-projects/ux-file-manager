import React from 'react';
import { AlertOctagon, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  onConfirm, 
  onCancel, 
  isDestructive = false 
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onCancel}
      />
      
      {/* Modal Container */}
      <div className="relative bg-dark-800 border border-dark-600 shadow-2xl shadow-red-500/10 rounded-xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b border-dark-700 ${isDestructive ? 'bg-red-500/10' : 'bg-dark-900/50'}`}>
          {isDestructive && <AlertOctagon size={24} className="text-red-400 shrink-0" />}
          <h2 className={`font-semibold text-lg truncate ${isDestructive ? 'text-red-400' : 'text-gray-100'}`}>
            {title}
          </h2>
          <button onClick={onCancel} className="ml-auto p-1.5 hover:bg-dark-700 rounded-full transition-colors shrink-0">
            <X size={18} className="text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-gray-300 text-sm leading-relaxed">
          {message}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-dark-900/50 border-t border-dark-700">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-lg ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' 
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
