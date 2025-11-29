import React, { useState, useEffect, useRef } from 'react';
import { PrintMetadata } from '../types';

interface PrintSettingsPanelProps {
  metadata: PrintMetadata;
  projectName?: string;
  onChange: (metadata: PrintMetadata) => void;
  onUpdateProjectName?: (name: string) => void;
  onClose: () => void;
  focusField?: string;
  t: any;
}

export const PrintSettingsPanel: React.FC<PrintSettingsPanelProps> = ({ 
    metadata, 
    projectName = '', 
    onChange, 
    onUpdateProjectName, 
    onClose, 
    focusField,
    t 
}) => {
  const [formData, setFormData] = useState<PrintMetadata>(metadata);
  const [localProjectName, setLocalProjectName] = useState(projectName);
  
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Focus effect
  useEffect(() => {
    if (focusField && inputRefs.current[focusField]) {
        inputRefs.current[focusField]?.focus();
        inputRefs.current[focusField]?.select();
    }
  }, [focusField]);

  // Sync with prop changes
  useEffect(() => {
    setFormData(prev => {
        if (
            prev.engineer === metadata.engineer &&
            prev.organization === metadata.organization &&
            prev.date === metadata.date &&
            prev.revision === metadata.revision &&
            prev.approvedBy === metadata.approvedBy
        ) {
            return prev;
        }
        return metadata;
    });
  }, [metadata]);

  useEffect(() => {
      setLocalProjectName(projectName);
  }, [projectName]);

  // Debounced update for metadata
  useEffect(() => {
    const timer = setTimeout(() => {
        onChange(formData);
    }, 300);
    return () => clearTimeout(timer);
  }, [formData, onChange]);

  // Debounced update for project name
  useEffect(() => {
    const timer = setTimeout(() => {
        if (localProjectName !== projectName && onUpdateProjectName) {
            onUpdateProjectName(localProjectName);
        }
    }, 300);
    return () => clearTimeout(timer);
  }, [localProjectName, projectName, onUpdateProjectName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden sticky top-4">
      <div className="p-4 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <span className="material-icons-round text-blue-400">print</span>
            {t.printSettings.title}
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white" title={t.inputPanel.close}>
            <span className="material-icons-round">close</span>
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{t.printLayout.project}</label>
            <input
                ref={el => { inputRefs.current['projectName'] = el; }}
                type="text"
                value={localProjectName}
                onChange={(e) => setLocalProjectName(e.target.value)}
                placeholder="Project Name"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm font-bold"
            />
        </div>

        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{t.printSettings.organization}</label>
            <input
                ref={el => { inputRefs.current['organization'] = el; }}
                type="text"
                name="organization"
                value={formData.organization}
                onChange={handleChange}
                placeholder="Company Name"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
            />
        </div>

        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{t.printSettings.engineer}</label>
            <input
                ref={el => { inputRefs.current['engineer'] = el; }}
                type="text"
                name="engineer"
                value={formData.engineer}
                onChange={handleChange}
                placeholder="Engineer Name"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
            />
        </div>

        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{t.printSettings.approvedBy}</label>
            <input
                ref={el => { inputRefs.current['approvedBy'] = el; }}
                type="text"
                name="approvedBy"
                value={formData.approvedBy}
                onChange={handleChange}
                placeholder="Approver Name"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.printSettings.date}</label>
                <input
                    ref={el => { inputRefs.current['date'] = el; }}
                    type="text"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    placeholder="YYYY-MM-DD"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.printSettings.revision}</label>
                <input
                    ref={el => { inputRefs.current['revision'] = el; }}
                    type="text"
                    name="revision"
                    value={formData.revision}
                    onChange={handleChange}
                    placeholder="Rev A"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                />
            </div>
        </div>
        
        <div className="pt-2">
             <p className="text-[10px] text-slate-500 italic text-center">
                Changes are saved automatically.
             </p>
        </div>
      </div>
    </div>
  );
};