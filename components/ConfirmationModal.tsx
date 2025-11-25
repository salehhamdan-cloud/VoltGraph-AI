import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: any;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, title, message, onConfirm, onCancel, t 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="material-icons-round text-red-500 text-xl">warning</span>
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        
        <p className="text-slate-300 text-sm mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            {t.inputPanel.close}
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <span className="material-icons-round text-sm">delete</span>
            {t.inputPanel.deleteComponent}
          </button>
        </div>
      </div>
    </div>
  );
};