import React from 'react';
import { AnalysisResult } from '../types';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  result: AnalysisResult | null;
  t: any;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, loading, result, t }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 w-full max-w-2xl rounded-xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
             <span className="material-icons-round text-purple-400 text-3xl">auto_awesome</span>
             <h2 className="text-xl font-bold text-white">{t.analysis.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-blue-400 font-medium animate-pulse">{t.analysis.analyzing}</p>
              <p className="text-slate-500 text-sm mt-2">{t.analysis.analyzingSub}</p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              
              {/* Status Banner */}
              <div className={`p-4 rounded-lg border flex items-start gap-4 ${
                result.status === 'safe' ? 'bg-green-500/10 border-green-500/30' :
                result.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                'bg-red-500/10 border-red-500/30'
              }`}>
                <span className={`material-icons-round text-2xl ${
                    result.status === 'safe' ? 'text-green-400' :
                    result.status === 'warning' ? 'text-yellow-400' :
                    'text-red-400'
                }`}>
                    {result.status === 'safe' ? 'verified_user' : result.status === 'warning' ? 'warning' : 'dangerous'}
                </span>
                <div>
                    <h3 className={`font-bold capitalize ${
                        result.status === 'safe' ? 'text-green-400' :
                        result.status === 'warning' ? 'text-yellow-400' :
                        'text-red-400'
                    }`}>
                        {result.status === 'safe' ? t.analysis.safe : 
                         result.status === 'warning' ? t.analysis.warning : 
                         t.analysis.danger}
                    </h3>
                    <p className="text-slate-300 text-sm mt-1">{result.summary}</p>
                </div>
              </div>

              {/* Issues */}
              {result.issues.length > 0 && (
                  <div>
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                          <span className="material-icons-round text-red-400">error_outline</span>
                          {t.analysis.issues}
                      </h4>
                      <ul className="space-y-2">
                          {result.issues.map((issue, idx) => (
                              <li key={idx} className="text-slate-300 text-sm bg-slate-800 p-3 rounded border border-slate-700">
                                  • {issue}
                              </li>
                          ))}
                      </ul>
                  </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                   <div>
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                          <span className="material-icons-round text-blue-400">tips_and_updates</span>
                          {t.analysis.recommendations}
                      </h4>
                      <ul className="space-y-2">
                          {result.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-slate-300 text-sm bg-slate-800 p-3 rounded border border-slate-700">
                                  • {rec}
                              </li>
                          ))}
                      </ul>
                  </div>
              )}

            </div>
          ) : (
            <div className="text-center text-slate-500">{t.analysis.noData}</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
             <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors font-medium"
            >
                {t.inputPanel.close}
            </button>
        </div>
      </div>
    </div>
  );
};