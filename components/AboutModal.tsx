import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: any;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, t }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-600/20 to-transparent pointer-events-none"></div>

        <div className="flex flex-col items-center text-center relative z-10">
           <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                 <span className="material-icons-round text-white text-4xl">electrical_services</span>
           </div>
           
           <h2 className="text-2xl font-bold text-white mb-1">{t.about.title}</h2>
           <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full mb-6">{t.about.version}</span>

           <p className="text-slate-300 text-sm leading-relaxed mb-6">
               {t.about.description}
           </p>
           
           <div className="w-full h-px bg-slate-700 mb-6"></div>

           <div className="flex flex-col items-center gap-1 mb-6">
                <span className="text-xs text-slate-500 uppercase tracking-wider">{t.about.developedBy}</span>
                <span className="text-lg font-bold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    {t.about.developerName}
                </span>
           </div>

           <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition-colors text-sm font-medium"
            >
                {t.inputPanel.close}
            </button>
        </div>
      </div>
    </div>
  );
};