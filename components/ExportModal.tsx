
import React from 'react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'svg' | 'png' | 'json' | 'excel' | 'pdf') => void;
  t: any;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport, t }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="material-icons-round text-blue-400 text-xl">save_alt</span>
            </div>
            <h3 className="text-lg font-bold text-white">{t.export.title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <span className="material-icons-round">close</span>
          </button>
        </div>
        
        <p className="text-slate-400 text-sm mb-6">
          {t.export.subtitle}
        </p>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <button 
            onClick={() => onExport('png')}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-purple-400 text-2xl">image</span>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-200 group-hover:text-white">{t.export.formats.png}</div>
                <div className="text-xs text-slate-500">{t.export.desc.png}</div>
              </div>
            </div>
            <span className="material-icons-round text-slate-500 group-hover:text-blue-400">arrow_forward</span>
          </button>

          <button 
            onClick={() => onExport('svg')}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-amber-400 text-2xl">polyline</span>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-200 group-hover:text-white">{t.export.formats.svg}</div>
                <div className="text-xs text-slate-500">{t.export.desc.svg}</div>
              </div>
            </div>
            <span className="material-icons-round text-slate-500 group-hover:text-blue-400">arrow_forward</span>
          </button>

          <button 
            onClick={() => onExport('pdf')}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-red-400 text-2xl">picture_as_pdf</span>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-200 group-hover:text-white">{t.export.formats.pdf}</div>
                <div className="text-xs text-slate-500">{t.export.desc.pdf}</div>
              </div>
            </div>
            <span className="material-icons-round text-slate-500 group-hover:text-blue-400">arrow_forward</span>
          </button>

          <button 
            onClick={() => onExport('excel')}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-emerald-400 text-2xl">table_view</span>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-200 group-hover:text-white">{t.export.formats.excel}</div>
                <div className="text-xs text-slate-500">{t.export.desc.excel}</div>
              </div>
            </div>
            <span className="material-icons-round text-slate-500 group-hover:text-blue-400">arrow_forward</span>
          </button>

          <button 
            onClick={() => onExport('json')}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-cyan-400 text-2xl">data_object</span>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-200 group-hover:text-white">{t.export.formats.json}</div>
                <div className="text-xs text-slate-500">{t.export.desc.json}</div>
              </div>
            </div>
            <span className="material-icons-round text-slate-500 group-hover:text-blue-400">arrow_forward</span>
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
          >
            {t.inputPanel.close}
          </button>
        </div>
      </div>
    </div>
  );
};
