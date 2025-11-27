
import React, { useState, useEffect } from 'react';
import { ComponentType, NewNodeData, ElectricalNode, ConnectionStyle } from '../types';
import { COMMON_MODELS, COMPONENT_CONFIG, DEFAULT_CONNECTION_STYLE } from '../constants';

interface InputPanelProps {
  selectedNode: ElectricalNode | null;
  selectionMode: 'node' | 'link';
  multiSelectionCount?: number;
  onAdd: (data: NewNodeData) => void;
  onAddIndependent: (type: ComponentType) => void;
  onEdit: (data: NewNodeData) => void;
  onBulkEdit?: (updates: Partial<NewNodeData>) => void;
  onEditConnection: (style: ConnectionStyle) => void;
  onDelete: () => void;
  onCancel: () => void;
  onDetach?: (nodeId: string) => void;
  onStartConnection?: (nodeId: string) => void;
  onNavigate?: (nodeId: string) => void;
  onDisconnectLink?: () => void; // New prop
  t: any;
}

export const InputPanel: React.FC<InputPanelProps> = ({ 
    selectedNode, 
    selectionMode,
    multiSelectionCount = 0,
    onAdd, 
    onAddIndependent,
    onEdit, 
    onBulkEdit,
    onEditConnection,
    onDelete, 
    onCancel,
    onDetach,
    onStartConnection,
    onNavigate,
    onDisconnectLink,
    t
}) => {
  const [activeTab, setActiveTab] = useState<'add' | 'edit'>('add');
  
  const [formData, setFormData] = useState<NewNodeData>({
    name: '',
    componentNumber: '',
    type: ComponentType.BREAKER,
    model: '',
    amps: undefined,
    voltage: undefined,
    kva: undefined,
    description: '',
    customColor: undefined,
    hasMeter: false,
    meterNumber: '',
    hasGeneratorConnection: false,
    generatorName: ''
  });

  const [connectionData, setConnectionData] = useState<ConnectionStyle>(DEFAULT_CONNECTION_STYLE);

  useEffect(() => {
    if (activeTab === 'edit' && selectedNode) {
        setFormData({
            name: selectedNode.name,
            componentNumber: selectedNode.componentNumber || '',
            type: selectedNode.type,
            model: selectedNode.model || '',
            amps: selectedNode.amps,
            voltage: selectedNode.voltage,
            kva: selectedNode.kva,
            description: selectedNode.description || '',
            customColor: selectedNode.customColor,
            hasMeter: selectedNode.hasMeter || false,
            meterNumber: selectedNode.meterNumber || '',
            hasGeneratorConnection: selectedNode.hasGeneratorConnection || false,
            generatorName: selectedNode.generatorName || ''
        });
    } else if (activeTab === 'add') {
        setFormData({
            name: '',
            componentNumber: '',
            type: ComponentType.BREAKER,
            model: '',
            amps: undefined,
            voltage: undefined,
            kva: undefined,
            description: '',
            customColor: undefined,
            hasMeter: false,
            meterNumber: '',
            hasGeneratorConnection: false,
            generatorName: ''
        });
    }
  }, [activeTab, selectedNode]);

  useEffect(() => {
      if (!selectedNode && multiSelectionCount <= 1) {
          setActiveTab('add');
      }
  }, [selectedNode, multiSelectionCount]);

  useEffect(() => {
      if (selectedNode && selectionMode === 'link') {
          setConnectionData({
              strokeColor: selectedNode.connectionStyle?.strokeColor || COMPONENT_CONFIG[selectedNode.type]?.color || '#475569',
              lineStyle: selectedNode.connectionStyle?.lineStyle || 'solid',
              startMarker: selectedNode.connectionStyle?.startMarker || 'none',
              endMarker: selectedNode.connectionStyle?.endMarker || 'none'
          });
      }
  }, [selectedNode, selectionMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : (name === 'amps' || name === 'voltage' || name === 'kva') 
            ? (value === '' ? undefined : Number(value)) 
            : value
    }));
  };

  const handleConnectionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      const newStyle = { ...connectionData, [name]: value };
      setConnectionData(newStyle);
      onEditConnection(newStyle);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (multiSelectionCount > 1 && onBulkEdit) {
        onBulkEdit(formData);
    } else if (activeTab === 'add') {
        onAdd(formData);
        setFormData(prev => ({ 
            ...prev, 
            name: '', 
            componentNumber: '',
            model: '',
            amps: undefined, 
            voltage: undefined,
            kva: undefined,
            description: '',
            customColor: undefined,
            hasMeter: false,
            meterNumber: '',
            hasGeneratorConnection: false,
            generatorName: ''
        }));
    } else {
        onEdit(formData);
    }
  };

  // --- Bulk Editing Mode ---
  if (multiSelectionCount > 1) {
      return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden sticky top-4">
            <div className="p-4 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
                 <h3 className="font-bold text-white text-sm flex items-center gap-2">
                     <span className="material-icons-round text-blue-400">layers</span>
                     {t.inputPanel.bulkEdit}
                 </h3>
                 <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                     {multiSelectionCount} {t.inputPanel.itemsSelected}
                 </span>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.customColor}</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="color" 
                            name="customColor"
                            value={formData.customColor || '#475569'}
                            onChange={handleChange}
                            className="h-8 w-12 bg-transparent border border-slate-700 rounded cursor-pointer"
                        />
                        <span className="text-xs text-slate-500">Apply to all</span>
                    </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.model}</label>
                  <input
                    list="models"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    placeholder="Update Model for all"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  <datalist id="models">
                    {COMMON_MODELS.map(model => (
                        <option key={model} value={model} />
                    ))}
                  </datalist>
                </div>
                
                <div className="pt-2">
                    <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm">
                        {t.inputPanel.applyBulk}
                    </button>
                    <button type="button" onClick={onCancel} className="w-full py-2 mt-2 text-slate-400 hover:text-white text-sm">
                        {t.inputPanel.close}
                    </button>
                </div>
            </form>
        </div>
      );
  }

  if (!selectedNode) {
    return (
      <div className="flex flex-col gap-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-icons-round text-sm">add_circle_outline</span>
                  {t.addIndependent}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => onAddIndependent(ComponentType.SYSTEM_ROOT)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-left flex items-center gap-2 transition-colors">
                      <span className="material-icons-round text-slate-400 text-sm">domain</span>
                      <span className="text-xs text-slate-200">{t.componentTypes[ComponentType.SYSTEM_ROOT]}</span>
                  </button>
                  <button onClick={() => onAddIndependent(ComponentType.GENERATOR)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-left flex items-center gap-2 transition-colors">
                      <span className="material-icons-round text-red-400 text-sm">settings_power</span>
                      <span className="text-xs text-slate-200">{t.componentTypes[ComponentType.GENERATOR]}</span>
                  </button>
                  <button onClick={() => onAddIndependent(ComponentType.TRANSFORMER)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-left flex items-center gap-2 transition-colors">
                      <span className="material-icons-round text-yellow-400 text-sm">electric_bolt</span>
                      <span className="text-xs text-slate-200">{t.componentTypes[ComponentType.TRANSFORMER]}</span>
                  </button>
                   <button onClick={() => onAddIndependent(ComponentType.LOAD)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-left flex items-center gap-2 transition-colors">
                      <span className="material-icons-round text-purple-400 text-sm">lightbulb</span>
                      <span className="text-xs text-slate-200">{t.componentTypes[ComponentType.LOAD]}</span>
                  </button>
              </div>
          </div>

          <div className="p-6 text-center text-slate-500 bg-slate-900/30 rounded-lg border border-dashed border-slate-800 h-32 flex flex-col items-center justify-center">
            <span className="material-icons-round text-4xl mb-3 opacity-50">touch_app</span>
            <p className="text-xs">Select a component in the diagram to view properties.</p>
          </div>

           <div className="mt-2 p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t.quickTips}</h4>
                <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
                    <li>{t.tip1}</li>
                    <li>{t.tip2}</li>
                    <li>{t.tip3}</li>
                    <li>{t.tip4}</li>
                </ul>
            </div>
      </div>
    );
  }

  // --- Link Styling Mode ---
  if (selectionMode === 'link') {
      return (
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden sticky top-4">
              <div className="p-4 border-b border-slate-700 bg-slate-900 flex items-center justify-between">
                 <h3 className="font-bold text-white text-sm flex items-center gap-2">
                     <span className="material-icons-round text-amber-400">timeline</span>
                     {t.inputPanel.linkStyle}
                 </h3>
                 <button onClick={onCancel} className="text-slate-400 hover:text-white">
                     <span className="material-icons-round">close</span>
                 </button>
              </div>
              <div className="p-5 space-y-4">
                  <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.strokeColor}</label>
                      <div className="flex items-center gap-2">
                        <input 
                            type="color" 
                            name="strokeColor"
                            value={connectionData.strokeColor}
                            onChange={handleConnectionChange}
                            className="h-8 w-12 bg-transparent border border-slate-700 rounded cursor-pointer"
                        />
                        <input 
                            type="text"
                            name="strokeColor"
                            value={connectionData.strokeColor}
                            onChange={handleConnectionChange}
                            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded px-3 py-1.5 text-sm uppercase"
                        />
                      </div>
                  </div>
                  
                  <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.lineStyle}</label>
                      <select 
                        name="lineStyle"
                        value={connectionData.lineStyle}
                        onChange={handleConnectionChange}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm"
                      >
                          <option value="solid">{t.inputPanel.patterns.solid}</option>
                          <option value="dashed">{t.inputPanel.patterns.dashed}</option>
                          <option value="dotted">{t.inputPanel.patterns.dotted}</option>
                      </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.startMarker}</label>
                          <select 
                            name="startMarker"
                            value={connectionData.startMarker}
                            onChange={handleConnectionChange}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm"
                          >
                              <option value="none">{t.inputPanel.markers.none}</option>
                              <option value="arrow">{t.inputPanel.markers.arrow}</option>
                              <option value="circle">{t.inputPanel.markers.circle}</option>
                              <option value="diamond">{t.inputPanel.markers.diamond}</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.endMarker}</label>
                          <select 
                            name="endMarker"
                            value={connectionData.endMarker}
                            onChange={handleConnectionChange}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm"
                          >
                              <option value="none">{t.inputPanel.markers.none}</option>
                              <option value="arrow">{t.inputPanel.markers.arrow}</option>
                              <option value="circle">{t.inputPanel.markers.circle}</option>
                              <option value="diamond">{t.inputPanel.markers.diamond}</option>
                          </select>
                      </div>
                  </div>
                  
                  <div className="pt-2 text-xs text-slate-500 italic border-t border-slate-700 mt-2">
                      Styling the connection to: <strong>{selectedNode.name}</strong>
                  </div>

                  <button 
                    type="button"
                    onClick={onDisconnectLink}
                    className="w-full py-2 mt-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <span className="material-icons-round text-sm">link_off</span>
                    {t.inputPanel.disconnect || "Disconnect Link"}
                  </button>
              </div>
          </div>
      );
  }

  // --- Normal Node Edit Mode ---

  const showMeterOptions = formData.type === ComponentType.BREAKER || formData.type === ComponentType.SWITCH || formData.type === ComponentType.DISTRIBUTION_BOARD;
  const showKvaOption = formData.type === ComponentType.TRANSFORMER || formData.type === ComponentType.GENERATOR;
  const isSystemRoot = selectedNode.type === ComponentType.SYSTEM_ROOT;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden sticky top-4">
      
      <div className="flex border-b border-slate-700">
          <button 
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'add' 
                ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' 
                : 'bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}
          >
             <span className="material-icons-round text-base">add_circle</span>
             {t.inputPanel.addConnection}
          </button>
          <button 
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'edit' 
                ? 'bg-slate-800 text-yellow-400 border-b-2 border-yellow-500' 
                : 'bg-slate-900 text-slate-500 hover:text-slate-300'
            }`}
          >
             <span className="material-icons-round text-base">edit</span>
             {t.inputPanel.editComponent}
          </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white">
                {activeTab === 'add' ? t.inputPanel.newDownstream : t.inputPanel.editSelected}
            </h3>
            {activeTab === 'add' && (
                 <span className="text-xs text-slate-400">{t.inputPanel.parent}: {selectedNode.name}</span>
            )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.componentType}</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            disabled={activeTab === 'edit' && isSystemRoot}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
          >
            {Object.values(ComponentType).map(type => (
              <option key={type} value={type}>{t.componentTypes[type]}</option>
            ))}
          </select>
        </div>

        {activeTab === 'edit' && (
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.customColor}</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="color" 
                        name="customColor"
                        value={formData.customColor || COMPONENT_CONFIG[formData.type]?.color || '#475569'}
                        onChange={handleChange}
                        className="h-8 w-12 bg-transparent border border-slate-700 rounded cursor-pointer"
                    />
                     <span className="text-xs text-slate-500">
                        {formData.customColor || 'Default'}
                    </span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.name}</label>
                <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Name"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.componentNumber}</label>
                <input
                    type="text"
                    name="componentNumber"
                    value={formData.componentNumber}
                    onChange={handleChange}
                    placeholder="e.g. CB-1"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                />
            </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.model}</label>
          <input
            list="models"
            name="model"
            value={formData.model}
            onChange={handleChange}
            placeholder="Select or type model"
            className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
          />
          <datalist id="models">
            {COMMON_MODELS.map(model => (
                <option key={model} value={model} />
            ))}
          </datalist>
        </div>

        <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50 space-y-3">
            {showMeterOptions && (
                <>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="hasMeter"
                            name="hasMeter"
                            checked={formData.hasMeter}
                            onChange={handleChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 bg-slate-700 border-slate-600"
                        />
                        <label htmlFor="hasMeter" className="text-xs font-medium text-slate-300 select-none">
                            {t.inputPanel.includesMeter}
                        </label>
                    </div>
                    
                    {formData.hasMeter && (
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.meterNumber}</label>
                            <input
                            type="text"
                            name="meterNumber"
                            value={formData.meterNumber}
                            onChange={handleChange}
                            placeholder="e.g. M-001"
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                            />
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="hasGeneratorConnection"
                    name="hasGeneratorConnection"
                    checked={formData.hasGeneratorConnection}
                    onChange={handleChange}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500 bg-slate-700 border-slate-600"
                />
                <label htmlFor="hasGeneratorConnection" className="text-xs font-medium text-slate-300 select-none">
                    {t.inputPanel.includesGenerator}
                </label>
            </div>
            {formData.hasGeneratorConnection && (
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.generatorName}</label>
                    <input
                    type="text"
                    name="generatorName"
                    value={formData.generatorName}
                    onChange={handleChange}
                    placeholder="e.g. Gen-1"
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                    />
                </div>
            )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.amperage}</label>
            <input
              type="number"
              name="amps"
              value={formData.amps === undefined ? '' : formData.amps}
              onChange={handleChange}
              placeholder="Optional"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.voltage}</label>
            <input
              type="number"
              name="voltage"
              value={formData.voltage === undefined ? '' : formData.voltage}
              onChange={handleChange}
              placeholder="Optional"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {showKvaOption && (
            <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.kva}</label>
                <input
                type="number"
                name="kva"
                value={formData.kva === undefined ? '' : formData.kva}
                onChange={handleChange}
                placeholder="e.g. 1000"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm"
                />
            </div>
        )}

        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{t.inputPanel.description}</label>
            <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm resize-none"
            />
        </div>

        {/* Downstream Connections List */}
        {activeTab === 'edit' && (
            <div className="mt-4 pt-4 border-t border-slate-700">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t.inputPanel.downstreamConnections}</h4>
                {selectedNode.children.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-2">{t.inputPanel.noConnections}</p>
                ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {selectedNode.children.map(child => (
                            <div key={child.id} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 group hover:border-slate-600 transition-colors">
                                <div 
                                    className="flex items-center gap-2 overflow-hidden cursor-pointer"
                                    onClick={() => onNavigate?.(child.id)}
                                    title="Select this component"
                                >
                                    <span className="material-icons-round text-sm text-slate-500" style={{ color: child.customColor || COMPONENT_CONFIG[child.type]?.color }}>{COMPONENT_CONFIG[child.type]?.icon}</span>
                                    <div className="flex flex-col truncate">
                                        <span className="text-xs font-medium text-slate-300 truncate">{child.name}</span>
                                        <span className="text-[10px] text-slate-500">{child.componentNumber || child.type}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        type="button"
                                        onClick={() => onStartConnection?.(child.id)} 
                                        title="Re-route (Link to another parent)"
                                        className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded"
                                    >
                                        <span className="material-icons-round text-sm">link</span>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => onDetach?.(child.id)} 
                                        title="Detach (Move to Root)"
                                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded"
                                    >
                                        <span className="material-icons-round text-sm">link_off</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        <div className="pt-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <button
                type="submit"
                className={`flex-1 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 shadow-lg ${
                    activeTab === 'add' 
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20' 
                    : 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-900/20'
                }`}
            >
                <span className="material-icons-round text-lg">
                    {activeTab === 'add' ? 'add_circle' : 'save'}
                </span>
                {activeTab === 'add' ? t.inputPanel.addToDiagram : t.inputPanel.saveChanges}
            </button>
            <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            >
                {t.inputPanel.close}
            </button>
          </div>
          
          {activeTab === 'edit' && !isSystemRoot && (
              <button
                type="button"
                onClick={() => onDelete()}
                className="w-full py-2 px-4 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <span className="material-icons-round text-sm">delete</span>
                {t.inputPanel.deleteComponent}
              </button>
          )}
        </div>
      </form>
    </div>
  );
};
