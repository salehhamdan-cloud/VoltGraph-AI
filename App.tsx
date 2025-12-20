
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Diagram } from './components/Diagram';
import { InputPanel } from './components/InputPanel';
import { PrintSettingsPanel } from './components/PrintSettingsPanel';
import { AnalysisModal } from './components/AnalysisModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ExportModal } from './components/ExportModal';
import { AboutModal } from './components/AboutModal';
import { ElectricalNode, NewNodeData, AnalysisResult, Project, Page, ComponentType, ConnectionStyle, PrintMetadata } from './types';
import { DEFAULT_PROJECT, DEFAULT_CONNECTION_STYLE, DEFAULT_PRINT_METADATA } from './constants';
import { analyzeCircuit } from './services/geminiService';
import { translations } from './translations';

type Language = 'en' | 'he' | 'ar';
type Theme = 'light' | 'dark';

// --- Helper Functions ---

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const findNodeInTree = (node: ElectricalNode, id: string): ElectricalNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
        const found = findNodeInTree(child, id);
        if (found) return found;
    }
    return null;
};

const findNode = (roots: ElectricalNode[], id: string): ElectricalNode | null => {
  for (const root of roots) {
      if (root.id === id) return root;
      const found = findNodeInTree(root, id);
      if (found) return found;
  }
  return null;
};

const addNodeToTree = (currentNode: ElectricalNode, parentId: string, newNode: ElectricalNode): ElectricalNode => {
  if (currentNode.id === parentId) {
    return { ...currentNode, children: [...currentNode.children, newNode] };
  }
  return { ...currentNode, children: currentNode.children.map(child => addNodeToTree(child, parentId, newNode)) };
};

const editNodeInTree = (currentNode: ElectricalNode, nodeId: string, updatedData: Partial<ElectricalNode>): ElectricalNode => {
  if (currentNode.id === nodeId) {
    return { ...currentNode, ...updatedData };
  }
  return { ...currentNode, children: currentNode.children.map(child => editNodeInTree(child, nodeId, updatedData)) };
};

const addExtraConnectionToTree = (currentNode: ElectricalNode, nodeId: string, targetId: string): ElectricalNode => {
  if (currentNode.id === nodeId) {
      const currentExtras = currentNode.extraConnections || [];
      if (currentExtras.includes(targetId)) return currentNode;
      return { ...currentNode, extraConnections: [...currentExtras, targetId] };
  }
  return { ...currentNode, children: currentNode.children.map(child => addExtraConnectionToTree(child, nodeId, targetId)) };
};

const removeExtraConnectionFromTree = (currentNode: ElectricalNode, targetIdToRemove: string): ElectricalNode => {
    let newNode = { ...currentNode };
    if (newNode.extraConnections && newNode.extraConnections.includes(targetIdToRemove)) {
        newNode.extraConnections = newNode.extraConnections.filter(id => id !== targetIdToRemove);
    }
    newNode.children = newNode.children.map(child => removeExtraConnectionFromTree(child, targetIdToRemove));
    return newNode;
};

const deleteNodeInTree = (currentNode: ElectricalNode, nodeIdToDelete: string): ElectricalNode => {
   const isDirectChild = currentNode.children.some(child => child.id === nodeIdToDelete);
   if (isDirectChild) {
       return {
           ...currentNode,
           children: currentNode.children.filter(child => child.id !== nodeIdToDelete)
       };
   }
   return {
       ...currentNode,
       children: currentNode.children.map(child => deleteNodeInTree(child, nodeIdToDelete))
   };
};

const cloneNodeTree = (node: ElectricalNode): ElectricalNode => {
    const newId = generateId(String(node.type));
    return {
        ...node,
        id: newId,
        children: node.children.map(child => cloneNodeTree(child)),
        extraConnections: [] 
    };
};

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const savedData = localStorage.getItem('voltgraph_data');
      let loadedProjects = savedData ? JSON.parse(savedData) : [DEFAULT_PROJECT];
      
      loadedProjects = loadedProjects.map((p: any) => ({
          ...p,
          pages: p.pages.map((page: any) => {
              if (page.rootNode && !page.items) {
                  return { ...page, items: [page.rootNode], rootNode: undefined };
              }
              return page;
          })
      }));
      
      return loadedProjects;
    } catch (e: any) {
      console.error("Failed to load data from local storage", e);
      return [DEFAULT_PROJECT];
    }
  });

  const [history, setHistory] = useState<Project[][]>([]);
  const [future, setFuture] = useState<Project[][]>([]);

  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0].id);
  const [activePageId, setActivePageId] = useState<string>(projects[0].pages[0].id);
  
  const [selectedNode, setSelectedNode] = useState<ElectricalNode | null>(null);
  const [multiSelection, setMultiSelection] = useState<Set<string>>(new Set<string>());
  const [selectionMode, setSelectionMode] = useState<'node' | 'link'>('node');
  const [clipboard, setClipboard] = useState<ElectricalNode | null>(null);
  const [selectedLinkParentId, setSelectedLinkParentId] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [showProjectSidebar, setShowProjectSidebar] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [printSettingsFocus, setPrintSettingsFocus] = useState<string | undefined>(undefined);
  const [isCleanView, setIsCleanView] = useState(false);
  
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  
  const [annotations, setAnnotations] = useState<{id: string, path: string, color: string}[]>([]);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationColor, setAnnotationColor] = useState('#ef4444');
  
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('light');
  const [showAddIndependentMenu, setShowAddIndependentMenu] = useState(false);

  const t = translations[language] as any;
  const isRTL = language === 'he' || language === 'ar';
  const isDark = theme === 'dark';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectionSource, setConnectionSource] = useState<ElectricalNode | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const activePage = activeProject.pages.find(p => p.id === activePageId) || activeProject.pages[0];

  const requestConfirmation = (title: string, message: string, action: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        action();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAnnotationAdd = (path: string, color: string) => {
    setAnnotations(prev => [...prev, { id: generateId('ant'), path, color }]);
  };

  const handleClearAnnotations = () => setAnnotations([]);
  
  const toggleFilter = (filterKey: string) => {
      setActiveFilters(prev => {
          const newSet = new Set(prev);
          if (newSet.has(filterKey)) {
              newSet.delete(filterKey);
          } else {
              newSet.add(filterKey);
          }
          return newSet;
      });
  };

  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(projects))]);
    setFuture([]);
  }, [projects]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setFuture(prev => [JSON.parse(JSON.stringify(projects)), ...prev]);
    setProjects(previousState);
    setHistory(newHistory);
  }, [history, projects]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const nextState = future[0];
    const newFuture = future.slice(1);
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(projects))]);
    setProjects(nextState);
    setFuture(newFuture);
  }, [future, projects]);

  const updatePage = useCallback((updater: (page: Page) => Page) => {
      setProjects(prevProjects => {
          return prevProjects.map(p => {
              if (p.id !== activeProjectId) return p;
              return {
                  ...p,
                  pages: p.pages.map(page => {
                      if (page.id !== activePageId) return page;
                      return updater(page);
                  })
              };
          });
      });
  }, [activeProjectId, activePageId]);

  const handleUpdatePrintMetadata = useCallback((metadata: PrintMetadata) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return { ...p, printMetadata: metadata };
      }));
  }, [activeProjectId]);

  const handleUpdateProjectName = useCallback((name: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          return { ...p, name };
      }));
  }, [activeProjectId]);

  const handleCopy = useCallback(() => {
      if (selectedNode) {
          const freshNode = findNode(activePage.items, selectedNode.id);
          if (freshNode) {
              try {
                  const copy = JSON.parse(JSON.stringify(freshNode));
                  setClipboard(copy);
              } catch (e: any) {
                  console.error("Copy failed:", e);
              }
          }
      }
  }, [selectedNode, activePage.items]);

  const handlePaste = useCallback(() => {
      if (!clipboard) return;
      saveToHistory();
      
      const nodeToClone = clipboard as ElectricalNode;
      const newNode = cloneNodeTree(nodeToClone);
      newNode.name = `${newNode.name} (Copy)`;

      updatePage((page) => {
          if (selectedNode) {
              const parentNode = selectedNode as ElectricalNode;
              const items = page.items.map(root => addNodeToTree(root, parentNode.id, newNode));
              return { ...page, items };
          } else {
              return { ...page, items: [...page.items, newNode] };
          }
      });
  }, [clipboard, selectedNode, saveToHistory, updatePage]); 

  const executeBulkDelete = (idsToDelete: Set<string>) => {
      if (idsToDelete.size === 0) return;
      saveToHistory();

      updatePage((page) => {
          let newItems = page.items.filter(item => !idsToDelete.has(item.id));
          const filterChildren = (node: ElectricalNode): ElectricalNode => ({
              ...node,
              children: node.children
                  .filter(c => !idsToDelete.has(c.id))
                  .map(filterChildren)
          });
          newItems = newItems.map(filterChildren);
          const cleanConnections = (node: ElectricalNode): ElectricalNode => ({
              ...node,
              extraConnections: node.extraConnections?.filter(id => !idsToDelete.has(id)),
              children: node.children.map(cleanConnections)
          });
          newItems = newItems.map(cleanConnections);
          return { ...page, items: newItems };
      });

      setMultiSelection(new Set<string>());
      setSelectedNode(null);
      setIsConnectMode(false);
      setConnectionSource(null);
  };

  const executeDeleteNode = (node: ElectricalNode) => {
      saveToHistory(); 
      updatePage((page) => {
          let newItems;
          if (page.items.some(n => n.id === node.id)) {
              newItems = page.items.filter(n => n.id !== node.id);
          } else {
              newItems = page.items.map(root => deleteNodeInTree(root, node.id));
          }
          newItems = newItems.map(root => removeExtraConnectionFromTree(root, node.id));
          return { ...page, items: newItems };
      });
      if (selectedNode?.id === node.id) {
        setSelectedNode(null);
        setSelectionMode('node');
      }
      setIsConnectMode(false);
      setConnectionSource(null);
  };

  const handleDeleteNodeClick = useCallback((node?: ElectricalNode) => {
      const nodeToDelete = node || selectedNode;
      if (!nodeToDelete) return;
      requestConfirmation(`${t.dialogs.deleteNodeTitle}`, `${t.dialogs.deleteNode}`, () => executeDeleteNode(nodeToDelete));
  }, [selectedNode, t, executeDeleteNode]);

  const handleDisconnectLink = () => {
      if (!selectedNode || !selectedLinkParentId) return;
      const childId = selectedNode.id;
      const parentId = selectedLinkParentId;
      
      saveToHistory();
      
      updatePage((page) => {
          const child = findNode(page.items, childId);
          if (child && child.extraConnections?.includes(parentId)) {
              const removeExtra = (n: ElectricalNode): ElectricalNode => {
                  if (n.id === childId) {
                      return { ...n, extraConnections: n.extraConnections?.filter(id => id !== parentId) };
                  }
                  return { ...n, children: n.children.map(removeExtra) };
              };
              return { ...page, items: page.items.map(removeExtra) };
          }

          const freshChild = findNode(page.items, childId);
          if (!freshChild) return page;

          const newItemsWithRemoval = page.items.map(root => {
             const remove = (n: ElectricalNode): ElectricalNode => {
                 if (n.id === parentId) {
                     return { ...n, children: n.children.filter(c => c.id !== childId) };
                 }
                 return { ...n, children: n.children.map(remove) };
             };
             return remove(root);
          });

          return { ...page, items: [...newItemsWithRemoval, freshChild] };
      });

      setSelectedNode(null);
      setSelectedLinkParentId(null);
      setSelectionMode('node');
  };

  const handleLinkClick = (sourceId: string, targetId: string) => {
      const targetNode = findNode(activePage.items, targetId);
      if (targetNode) {
          setSelectedNode(targetNode);
          setSelectedLinkParentId(sourceId); 
          setSelectionMode('link');
          setMultiSelection(new Set<string>());
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (!isInput) {
          if (isCtrl && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            e.shiftKey ? handleRedo() : handleUndo();
          }
          if (isCtrl && e.key.toLowerCase() === 'y') {
              e.preventDefault();
              handleRedo();
          }
          
          if (e.key === 'Delete' || e.key === 'Backspace') {
             if (multiSelection.size > 0) {
                 if(window.confirm(`${t.dialogs.deleteNode}`)) { 
                     executeBulkDelete(multiSelection);
                 }
             } else if (selectedNode) {
                 if(window.confirm(`${t.dialogs.deleteNode}`)) {
                    executeDeleteNode(selectedNode);
                 }
             }
          }

          if (isCtrl && e.key.toLowerCase() === 'c') {
              e.preventDefault();
              handleCopy();
          }
          
          if (isCtrl && e.key.toLowerCase() === 'v') {
              e.preventDefault();
              handlePaste();
          }

          if (e.key === 'Escape') {
              e.preventDefault();
              if (isCleanView) {
                  setIsCleanView(false);
              } else {
                  setSelectionMode('node');
                  setSelectedNode(null);
                  setMultiSelection(new Set<string>());
                  setIsConnectMode(false);
                  setConnectionSource(null);
              }
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
      selectedNode, 
      multiSelection, 
      clipboard, 
      handleUndo, 
      handleRedo, 
      handleCopy, 
      handlePaste, 
      t, 
      isCleanView
  ]); 

  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('voltgraph_data', JSON.stringify(projects));
        setSaveStatus('saved');
      } catch (e: any) {
        setSaveStatus('unsaved');
      }
    }, 1000); 
    return () => clearTimeout(timer);
  }, [projects]);

  useEffect(() => {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
  }, [isRTL, language]);

  const getRandomHexColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

  const handleBackgroundClick = () => {
    setSelectedNode(null);
    setSelectionMode('node');
    setMultiSelection(new Set<string>());
    setIsConnectMode(false);
    setConnectionSource(null);
    setShowAddIndependentMenu(false);
  };

  const handleConnectNodes = (inputChildId: string, inputParentId: string) => {
      if (inputChildId === inputParentId) return;
      let childId = inputChildId;
      let parentId = inputParentId;
      const childNode = findNode(activePage.items, childId);
      const parentNode = findNode(activePage.items, parentId);
      if (!childNode || !parentNode) return;
      const isChildSourceType = childNode.type === ComponentType.GENERATOR || childNode.type === ComponentType.SYSTEM_ROOT;
      const isParentSourceType = parentNode.type === ComponentType.GENERATOR || parentNode.type === ComponentType.SYSTEM_ROOT;
      const isChildRoot = activePage.items.some(root => root.id === childId);
      if (isChildRoot && isChildSourceType && !isParentSourceType) {
          const temp = childId;
          childId = parentId;
          parentId = temp;
      }
      const targetChildNode = findNode(activePage.items, childId);
      if (!targetChildNode) return;
      const isTargetChildRoot = activePage.items.some(root => root.id === childId);
      saveToHistory();
      updatePage((page) => {
          if (isTargetChildRoot) {
              let items = [...page.items];
              let movedNodeData = targetChildNode;
              items = items.filter(item => item.id !== childId);
              const newParent = findNode(items, parentId);
              const connectionColor = (newParent && newParent.children.length > 0)
                  ? newParent.children[0].connectionStyle?.strokeColor
                  : getRandomHexColor();
              const updatedNode = {
                  ...movedNodeData,
                  connectionStyle: { ...movedNodeData.connectionStyle, strokeColor: connectionColor }
              };
              items = items.map(root => addNodeToTree(root, parentId, updatedNode));
              return { ...page, items };
          } 
          else {
              if (targetChildNode.extraConnections?.includes(parentId)) return page;
              if (targetChildNode.children.some(c => c.id === parentId)) {
                  alert(`${t.dialogs.cycle}`);
                  return page;
              }
              const items = page.items.map(root => addExtraConnectionToTree(root, childId, parentId));
              return { ...page, items };
          }
      });
  };

  const handleNodeClick = (node: ElectricalNode, isShiftKey: boolean) => {
    if (isCleanView) return;

    if (isConnectMode) {
        if (!connectionSource) {
            setConnectionSource(node); 
        } else {
            if (connectionSource && node.id === connectionSource.id) {
                setConnectionSource(null);
                return;
            }
            if (connectionSource) {
                handleConnectNodes(connectionSource.id, node.id);
            }
            setConnectionSource(null);
            setIsConnectMode(false);
        }
    } else {
        if (isShiftKey) {
            setMultiSelection(prev => {
                const newSet = new Set<string>(prev);
                if (newSet.has(node.id)) newSet.delete(node.id);
                else newSet.add(node.id);
                if (newSet.size === 1) {
                    const id = Array.from(newSet)[0];
                    if (typeof id === 'string') {
                        const singleNode = findNode(activePage.items, id);
                        if(singleNode) setSelectedNode(singleNode);
                    }
                } else {
                    setSelectedNode(null);
                }
                return newSet;
            });
        } else {
            setSelectedNode(node);
            setMultiSelection(new Set<string>([node.id]));
            setSelectionMode('node');
        }
    }
  };

  const handleDetachNode = (nodeId: string) => {
      if(confirm(`${t.dialogs.detach}`)) {
          saveToHistory();
          updatePage((page) => {
             const node = findNode(page.items, nodeId);
             if (!node) return page;
             let items = page.items.map(root => deleteNodeInTree(root, nodeId));
             items.push(node);
             return { ...page, items };
          });
      }
  };

  const handleStartConnection = (nodeId: string) => {
      const node = findNode(activePage.items, nodeId);
      if (node) {
          setConnectionSource(node);
          setIsConnectMode(true);
      }
  };

  const handleNavigateToNode = (nodeId: string) => {
      const node = findNode(activePage.items, nodeId);
      if (node) {
          setSelectedNode(node);
          setMultiSelection(new Set<string>([node.id]));
          setSelectionMode('node');
      }
  };

  const handleAddIndependentNode = (type: ComponentType) => {
      saveToHistory();
      setShowAddIndependentMenu(false);
      let name = t.componentTypes[type] as string;
      let desc = 'Independent Node';
      switch(type) {
          case ComponentType.SYSTEM_ROOT: desc = t.defaultDesc.grid; break;
          case ComponentType.GENERATOR: desc = t.defaultDesc.gen; break;
          case ComponentType.TRANSFORMER: desc = t.defaultDesc.trans; break;
          case ComponentType.LOAD: desc = t.defaultDesc.load; break;
          case ComponentType.UPS: desc = t.defaultDesc.ups; break;
      }
      const newNode: ElectricalNode = {
        id: generateId(String(type).toLowerCase()),
        name: name,
        type: type,
        description: desc,
        children: [],
        extraConnections: [],
        isCollapsed: false,
        connectionStyle: DEFAULT_CONNECTION_STYLE,
        manualX: 0,
        manualY: 0,
        place: '',
        building: '',
        floor: ''
      };
      updatePage((page) => ({
          ...page,
          items: [...page.items, newNode]
      }));
  };

  const handleAddNode = (data: NewNodeData) => {
    if (!selectedNode) return;
    saveToHistory();
    updatePage((page) => {
        const currentParentNode = findNode(page.items, selectedNode.id) || selectedNode;
        let connectionColor = getRandomHexColor();
        if (currentParentNode.children && currentParentNode.children.length > 0) {
            const siblingStyle = currentParentNode.children[0].connectionStyle;
            if (siblingStyle && siblingStyle.strokeColor) {
                connectionColor = siblingStyle.strokeColor;
            }
        }
        const newNode: ElectricalNode = {
            id: generateId(String(data.type)),
            name: data.name || String(data.type),
            type: data.type,
            componentNumber: data.componentNumber,
            model: data.model,
            amps: data.amps,
            voltage: data.voltage,
            kva: data.kva,
            description: data.description,
            place: data.place,
            building: data.building,
            floor: data.floor,
            customColor: data.customColor,
            customBgColor: data.customBgColor,
            hasMeter: data.hasMeter,
            meterNumber: data.meterNumber,
            hasGeneratorConnection: data.hasGeneratorConnection,
            generatorName: data.generatorName,
            isExcludedFromMeter: data.isExcludedFromMeter,
            isAirConditioning: data.isAirConditioning,
            isReserved: data.isReserved,
            shape: data.shape,
            customImage: data.customImage,
            children: [],
            extraConnections: [],
            connectionStyle: { ...DEFAULT_CONNECTION_STYLE, strokeColor: connectionColor },
            isCollapsed: false
        };
        const items = page.items.map(root => addNodeToTree(root, selectedNode.id, newNode));
        return { ...page, items };
    });
  };

  const handleAddDuplicatedChild = (node: ElectricalNode) => {
      saveToHistory();
       let connectionColor = getRandomHexColor();
       const findParent = (n: ElectricalNode, childId: string): ElectricalNode | null => {
           if (n.children.some(c => c.id === childId)) return n;
           for (const c of n.children) {
               const p = findParent(c, childId);
               if (p) return p;
           }
           return null;
       };
       let parent = null;
       for(const root of activePage.items) {
           parent = findParent(root, node.id);
           if(parent) break;
       }
       if (parent && parent.children.length > 0) {
            const siblingStyle = parent.children[0].connectionStyle;
            if(siblingStyle?.strokeColor) connectionColor = siblingStyle.strokeColor;
       }
      updatePage((page) => {
          const newNode: ElectricalNode = {
              ...node,
              id: generateId(String(node.type)),
              name: `${node.name} Copy`,
              children: [], 
              extraConnections: [],
              connectionStyle: { ...DEFAULT_CONNECTION_STYLE, strokeColor: connectionColor },
              isCollapsed: false
          };
          const items = page.items.map(root => addNodeToTree(root, node.id, newNode));
          return { ...page, items };
      });
  };

  const handleEditNode = (data: NewNodeData) => {
    if (!selectedNode) return;
    saveToHistory();
    updatePage((page) => {
        const items = page.items.map(root => editNodeInTree(root, selectedNode.id, {
            name: data.name || selectedNode.name,
            componentNumber: data.componentNumber,
            type: data.type,
            model: data.model,
            amps: data.amps,
            voltage: data.voltage,
            kva: data.kva,
            description: data.description,
            place: data.place,
            building: data.building,
            floor: data.floor,
            customColor: data.customColor,
            customBgColor: data.customBgColor,
            hasMeter: data.hasMeter,
            meterNumber: data.meterNumber,
            hasGeneratorConnection: data.hasGeneratorConnection,
            generatorName: data.generatorName,
            isExcludedFromMeter: data.isExcludedFromMeter,
            isAirConditioning: data.isAirConditioning,
            isReserved: data.isReserved,
            shape: data.shape,
            customImage: data.customImage
        }));
        const newNode = findNode(items, selectedNode.id);
        if (newNode) setSelectedNode(newNode);
        return { ...page, items };
    });
  };

  const handleBulkEdit = (updates: Partial<NewNodeData>) => {
      saveToHistory();
      updatePage((page) => {
          let items = page.items;
          multiSelection.forEach(id => {
              items = items.map(root => editNodeInTree(root, id, updates));
          });
          return { ...page, items };
      });
  };

  const updateNodeConnectionStyle = (newStyle: ConnectionStyle) => {
      if (!selectedNode) return;
      saveToHistory();
      updatePage((page) => {
          const items = page.items.map(root => editNodeInTree(root, selectedNode.id, {
              connectionStyle: newStyle
          }));
          return { ...page, items };
      });
  };

  const handleNodeMove = (updates: {id: string, x: number, y: number}[]) => {
      const updateMap = new Map(updates.map(u => [u.id, u]));
      updatePage((page) => {
          const updateTree = (node: ElectricalNode): ElectricalNode => {
              const update = updateMap.get(node.id);
              let newNode = node;
              if (update) {
                  newNode = { ...node, manualX: update.x, manualY: update.y };
              }
              return {
                  ...newNode,
                  children: newNode.children.map(updateTree)
              };
          };
          return { ...page, items: page.items.map(updateTree) };
      });
  };

  const handleToggleCollapse = (node: ElectricalNode) => {
      saveToHistory();
      updatePage((page) => {
         const items = page.items.map(root => editNodeInTree(root, node.id, {
             isCollapsed: !node.isCollapsed
         }));
         return { ...page, items };
      });
  };

  const handleGroupNode = (nodeToGroup: ElectricalNode) => {
      if (nodeToGroup.type === ComponentType.SYSTEM_ROOT) return;
      saveToHistory();
      updatePage((page) => {
          const newGroupId = `GROUP-${Date.now()}`;
          const groupNode: ElectricalNode = {
              id: newGroupId,
              name: 'New Group',
              type: ComponentType.DISTRIBUTION_BOARD,
              description: 'Grouped Components',
              children: [nodeToGroup],
              extraConnections: [],
              connectionStyle: nodeToGroup.connectionStyle,
              isCollapsed: false,
              place: nodeToGroup.place,
              building: nodeToGroup.building,
              floor: nodeToGroup.floor
          };
          const replaceNodeInTree = (current: ElectricalNode, targetId: string, replacement: ElectricalNode): ElectricalNode => {
            if (current.children.some(c => c.id === targetId)) {
                return { ...current, children: current.children.map(c => c.id === targetId ? replacement : c) };
            }
            return { ...current, children: current.children.map(c => replaceNodeInTree(c, targetId, replacement)) };
          };
          const items = page.items.map(root => replaceNodeInTree(root, nodeToGroup.id, groupNode));
          return { ...page, items };
      });
  };

  const handleAnalyze = async () => {
    if (activePage.items.length === 0) {
        alert("Diagram not found.");
        return;
    }
    setShowAnalysis(true);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await analyzeCircuit(activePage.items);
      setAnalysisResult(result);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getFullSVGString = () => {
      const svgElement = document.getElementById('diagram-svg') as unknown as SVGSVGElement;
      if (!svgElement) return null;

      // 1. Clone the SVG to manipulate it
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      const cloneGroup = clone.querySelector('g');
      if (!cloneGroup) return null;

      // 2. Clear user view transformations (zoom/pan) to get real coordinates
      cloneGroup.setAttribute('transform', 'translate(0,0) scale(1)');

      // 3. Remove temporary/UI elements that shouldn't be in the export
      clone.querySelectorAll('.action-buttons, .temp-drawing, .print-layout-edit-btn, .link-hit').forEach(el => el.remove());

      // 4. Browsers need the element in the DOM to calculate BBox accurately
      const hiddenContainer = document.createElement('div');
      hiddenContainer.style.position = 'absolute';
      hiddenContainer.style.visibility = 'hidden';
      hiddenContainer.style.width = '0';
      hiddenContainer.style.height = '0';
      hiddenContainer.style.overflow = 'hidden';
      document.body.appendChild(hiddenContainer);
      hiddenContainer.appendChild(clone);

      // 5. Calculate bounding box of all contents
      const bbox = (cloneGroup as SVGGElement).getBBox();
      const padding = 60;
      
      const width = bbox.width + padding * 2;
      const height = bbox.height + padding * 2;
      
      // 6. Finalize SVG attributes
      clone.setAttribute('width', width.toString());
      clone.setAttribute('height', height.toString());
      clone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
      clone.style.backgroundColor = isDark ? '#0f172a' : '#ffffff';
      clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // 7. Embed styles for fonts and high-quality rendering
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = `
          @import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');
          text { font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          .node text { pointer-events: none; }
          .node-bg { transition: none !important; shape-rendering: geometricPrecision; }
          path { shape-rendering: geometricPrecision; }
      `;
      clone.insertBefore(style, clone.firstChild);

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clone);
      
      // Cleanup
      document.body.removeChild(hiddenContainer);

      // Fix missing namespaces for standalone viewer compatibility
      if(!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
          svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if(!svgString.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)){
          svgString = svgString.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }

      return svgString;
  };

  const triggerDownload = (href: string, name: string) => {
      const downloadLink = document.createElement("a");
      downloadLink.href = href;
      downloadLink.download = name;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
  };

  const handleBackupAll = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects, null, 2));
      const date = new Date().toISOString().slice(0, 10);
      triggerDownload(dataStr, `VoltGraph_FullBackup_${date}.json`);
  };

  const handleDownloadProject = (project: Project) => {
      const safeName = project.name.trim().replace(/[^\w\u0590-\u05FF\u0600-\u06FF\s-]/g, '_');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
      triggerDownload(dataStr, `${safeName}_ProjectBackup.json`);
  };

  const handleExport = async (format: 'svg' | 'png' | 'json' | 'excel' | 'pdf') => {
      const safeProjectName = activeProject.name.trim().replace(/[^\w\u0590-\u05FF\u0600-\u06FF\s-]/g, '_');
      const safePageName = activePage.name.trim().replace(/[^\w\u0590-\u05FF\u0600-\u06FF\s-]/g, '_');
      const baseFileName = `${safeProjectName} - ${safePageName}`;
      
      if (format === 'json') {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeProject, null, 2));
          triggerDownload(dataStr, `${baseFileName}.json`);
          setShowExportModal(false);
          return;
      }
      
      if (format === 'excel') {
          const rows: any[] = [];
          const columns = ['name', 'type', 'componentNum', 'model', 'amps', 'voltage', 'kva', 'parent', 'description', 'hasMeter', 'meterNum', 'place', 'building', 'floor'];
          const traverse = (node: ElectricalNode, parentName: string) => {
              const row: any = {};
              row[t.csvHeaders.name] = node.name;
              row[t.csvHeaders.type] = t.componentTypes[node.type] || node.type;
              row[t.csvHeaders.componentNum] = node.componentNumber || '';
              row[t.csvHeaders.model] = node.model || '';
              row[t.csvHeaders.amps] = node.amps || '';
              row[t.csvHeaders.voltage] = node.voltage || '';
              row[t.csvHeaders.kva] = node.kva || '';
              row[t.csvHeaders.parent] = parentName;
              row[t.csvHeaders.description] = node.description || '';
              row[t.csvHeaders.hasMeter] = node.hasMeter ? t.csvHeaders.yes : t.csvHeaders.no;
              row[t.csvHeaders.meterNum] = node.meterNumber || '';
              row[t.csvHeaders.place] = node.place || '';
              row[t.csvHeaders.building] = node.building || '';
              row[t.csvHeaders.floor] = node.floor || '';
              rows.push(row);
              node.children.forEach(child => traverse(child, node.name));
          };
          activePage.items.forEach(root => traverse(root, t.csvHeaders.na));
          if (rows.length > 0) {
              const headerMap: Record<string, string> = {
                  'name': t.csvHeaders.name, 'type': t.csvHeaders.type, 'componentNum': t.csvHeaders.componentNum,
                  'model': t.csvHeaders.model, 'amps': t.csvHeaders.amps, 'voltage': t.csvHeaders.voltage,
                  'kva': t.csvHeaders.kva, 'parent': t.csvHeaders.parent, 'description': t.csvHeaders.description,
                  'hasMeter': t.csvHeaders.hasMeter, 'meterNum': t.csvHeaders.meterNum,
                  'place': t.csvHeaders.place, 'building': t.csvHeaders.building, 'floor': t.csvHeaders.floor
              };
              const headers = columns.map(k => headerMap[k]);
              const csvContent = [
                  headers.join(','),
                  ...rows.map(row => headers.map(header => {
                      const val = row[header];
                      const valStr = val !== undefined && val !== null ? String(val) : '';
                      return `"${valStr.replace(/"/g, '""')}"`;
                  }).join(','))
              ].join('\n');
              const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              triggerDownload(url, `${baseFileName}.csv`);
          }
          setShowExportModal(false);
          return;
      }

      const svgString = getFullSVGString();
      if (!svgString) return;

      if (format === 'svg') {
          const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
          triggerDownload(url, `${baseFileName}.svg`);
          setShowExportModal(false);
          return;
      }

      // Logic for PNG/PDF (Canvas-based)
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const svg = doc.documentElement;
      const width = parseFloat(svg.getAttribute('width') || '800');
      const height = parseFloat(svg.getAttribute('height') || '600');
      
      const scale = format === 'pdf' ? 3 : 2; // High DPI
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;
      ctx.scale(scale, scale);

      const img = new Image();
      const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
          // Fill background for non-SVG formats
          ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);

          if (format === 'png') {
              const pngUrl = canvas.toDataURL('image/png');
              triggerDownload(pngUrl, `${baseFileName}.png`);
          } else if (format === 'pdf') {
              const pngUrl = canvas.toDataURL('image/png');
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                  printWindow.document.write(`
                      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${language}">
                          <head>
                              <title>${baseFileName}</title>
                              <style>
                                  body { margin: 0; display: flex; flex-direction: column; align-items: center; background: #f0f0f0; font-family: sans-serif; }
                                  img { max-width: 100%; height: auto; box-shadow: 0 0 40px rgba(0,0,0,0.15); background: white; margin: 40px 0; }
                                  @media print {
                                      body { background: white; padding: 0; }
                                      img { box-shadow: none; margin: 0; width: 100%; }
                                      @page { margin: 1cm; size: auto; }
                                  }
                              </style>
                          </head>
                          <body>
                              <img src="${pngUrl}" />
                              <script>
                                  window.onload = () => {
                                      setTimeout(() => { 
                                          window.print(); 
                                          window.close(); 
                                      }, 800);
                                  };
                              </script>
                          </body>
                      </html>
                  `);
                  printWindow.document.close();
              }
          }
          setShowExportModal(false);
      };
      
      img.onerror = (e) => {
          console.error("SVG Rendering Error:", e);
          URL.revokeObjectURL(url);
          alert("Could not process high-resolution render. Falling back to SVG/JSON.");
          setShowExportModal(false);
      };

      img.src = url;
  };

  const handleImportProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = reader.result;
            if (typeof content !== 'string') return;
            
            let importedData: any = JSON.parse(content);
            if (Array.isArray(importedData)) {
                saveToHistory();
                const restoredProjects = importedData.map((p: any) => {
                    if (!p.pages) return null;
                    const migratedPages = p.pages.map((page: any) => {
                        if (page.rootNode && !page.items) {
                            return { ...page, items: [page.rootNode], rootNode: undefined };
                        }
                        return page;
                    });
                    return { ...p, id: generateId('proj'), pages: migratedPages };
                }).filter(Boolean) as Project[];
                if(restoredProjects.length > 0) {
                    setProjects(prev => [...prev, ...restoredProjects]);
                    alert(`${t.dialogs.restoreSuccess}`);
                } else {
                    alert(`${t.dialogs.importError}`);
                }
            } 
            else {
                if(importedData.pages && importedData.pages[0].rootNode && !importedData.pages[0].items) {
                     importedData = {
                         ...importedData,
                         pages: importedData.pages.map((p: any) => ({
                             ...p,
                             items: [p.rootNode],
                             rootNode: undefined
                         }))
                     };
                }
                if (importedData.id && importedData.pages) {
                    saveToHistory();
                    const exists = projects.some(p => p.id === importedData.id);
                    if (exists) importedData = { ...importedData, id: generateId('proj') };
                    setProjects(prev => [...prev, importedData]);
                    setActiveProjectId(importedData.id);
                    setActivePageId(importedData.pages[0].id);
                } else {
                    alert(`${t.dialogs.importError}`);
                }
            }
        } catch (error: any) {
            alert(`${t.dialogs.importError}`);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleAddProject = () => {
      saveToHistory();
      const newProj: Project = {
          id: generateId('proj'),
          name: `${t.projects} ${projects.length + 1}`,
          pages: [{
              id: generateId('page'),
              name: 'Page 1',
              items: []
          }]
      };
      setProjects([...projects, newProj]);
      setActiveProjectId(newProj.id);
      setActivePageId(newProj.pages[0].id);
  };

  const handleAddPage = () => {
      saveToHistory();
      const newPage: Page = {
        id: generateId('page'),
        name: `${t.pages} ${activeProject.pages.length + 1}`,
        items: []
      };
      setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, pages: [...p.pages, newPage] } : p));
      setActivePageId(newPage.id);
  };

  const deletePage = (projectId: string, pageId: string) => {
      const project = projects.find(p => p.id === projectId);
      if (!project || project.pages.length <= 1) { alert("Cannot delete last page."); return; }
      saveToHistory();
      const newPages = project.pages.filter(p => p.id !== pageId);
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, pages: newPages } : p));
      if (activePageId === pageId) setActivePageId(newPages[0].id);
  };

  const handleDeletePageClick = (projectId: string, pageId: string) => {
      requestConfirmation(`${t.dialogs.deletePageTitle}`, `${t.dialogs.deletePage}`, () => deletePage(projectId, pageId));
  }

  const deleteProject = (projId: string) => {
      if (projects.length <= 1) return;
      saveToHistory();
      const newProjs = projects.filter(p => p.id !== projId);
      setProjects(newProjs);
      if (activeProjectId === projId) {
          setActiveProjectId(newProjs[0].id);
          setActivePageId(newProjs[0].pages[0].id);
      }
  };

  const handleDeleteProjectClick = (projId: string) => {
      requestConfirmation(`${t.dialogs.deleteProjectTitle}`, `${t.dialogs.deleteProject}`, () => deleteProject(projId));
  }

  const startEditing = (id: string, currentName: string) => {
      setEditingId(id);
      setEditName(currentName);
  };

  const saveEdit = () => {
      if (!editingId) return;
      const projIndex = projects.findIndex(p => p.id === editingId);
      if (projIndex !== -1) {
          if(projects[projIndex].name !== editName) {
              saveToHistory();
              setProjects(prev => prev.map((p, idx) => idx === projIndex ? { ...p, name: editName } : p));
          }
      } else {
          if (activeProject.pages.some(p => p.id === editingId)) {
               saveToHistory();
               setProjects(prev => prev.map(p => {
                   if (p.id !== activeProjectId) return p;
                   return {
                       ...p,
                       pages: p.pages.map(pg => pg.id === editingId ? { ...pg, name: editName } : pg)
                   };
               }));
          }
      }
      setEditingId(null);
      setEditName('');
  };

  const handleReset = () => {
      if(confirm(`${t.dialogs.reset}`)) {
          saveToHistory();
          setProjects([DEFAULT_PROJECT]);
          setActiveProjectId(DEFAULT_PROJECT.id);
          setActivePageId(DEFAULT_PROJECT.pages[0].id);
          setSelectedNode(null);
          setIsConnectMode(false);
      }
  };

  const searchMatches = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const matches = new Set<string>();
    const term = searchTerm.toLowerCase();
    const traverse = (node: ElectricalNode) => {
      if (
        (node.name && node.name.toLowerCase().includes(term)) || 
        (node.model && node.model.toLowerCase().includes(term)) ||
        (node.componentNumber && node.componentNumber.toLowerCase().includes(term)) ||
        (node.meterNumber && node.meterNumber.toLowerCase().includes(term)) ||
        (node.place && node.place.toLowerCase().includes(term)) ||
        (node.building && node.building.toLowerCase().includes(term)) ||
        (node.floor && node.floor.toLowerCase().includes(term)) ||
        (node.description && node.description.toLowerCase().includes(term)) ||
        node.type.toLowerCase().includes(term)
      ) {
        matches.add(node.id);
      }
      node.children.forEach(traverse);
    };
    activePage.items.forEach(traverse);
    return matches;
  }, [activePage.items, searchTerm]);

  const handleEditPrintSettings = useCallback((focusField?: string) => {
      setIsPrintMode(true);
      setShowProjectSidebar(true);
      setSelectedNode(null);
      setMultiSelection(new Set<string>());
      setSelectionMode('node');
      setIsConnectMode(false);
      setConnectionSource(null);
      setPrintSettingsFocus(focusField);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col font-sans ${isDark ? 'text-slate-200 bg-slate-900' : 'text-slate-800 bg-slate-50'} ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      
      {!isCleanView && (
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
             <button onClick={() => setShowProjectSidebar(!showProjectSidebar)} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
                <span className="material-icons-round">menu</span>
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center shadow-lg">
                 <span className="material-icons-round text-white text-lg">electrical_services</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block leading-none">{t.appName}</h1>
              <div className="flex items-center gap-1 mt-1">
                 <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saved' ? 'bg-green-500' : saveStatus === 'saving' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></span>
                 <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{t.saveStatus[saveStatus]}</span>
              </div>
            </div>
        </div>
        
        <div className="flex-1 max-w-md mx-6 relative">
            <span className="absolute top-1/2 -translate-y-1/2 material-icons-round text-slate-500 left-3">search</span>
            <input 
                type="text" 
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-500"
            />
        </div>

        <div className="flex items-center gap-3">
             {isPrintMode && (
                <button 
                    onClick={() => {
                        handleEditPrintSettings();
                    }}
                    className="p-2 bg-blue-600 text-white border border-blue-500 shadow-lg shadow-blue-900/20 rounded-lg animate-pulse hover:bg-blue-500 transition-colors"
                    title={t.printSettings.title}
                >
                    <span className="material-icons-round">settings</span>
                </button>
             )}

             <div className="relative">
                 <button 
                    onClick={() => setShowAddIndependentMenu(!showAddIndependentMenu)}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 flex items-center gap-2"
                    title={t.addIndependent}
                 >
                     <span className="material-icons-round text-green-400">add_circle_outline</span>
                     <span className="text-xs font-medium hidden md:block">{t.addIndependent}</span>
                     <span className="material-icons-round text-sm">expand_more</span>
                 </button>
                 {showAddIndependentMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-fadeIn">
                         <button onClick={() => handleAddIndependentNode(ComponentType.SYSTEM_ROOT)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2">
                             <span className="material-icons-round text-slate-400">domain</span>
                             {t.addGrid}
                         </button>
                         <button onClick={() => handleAddIndependentNode(ComponentType.GENERATOR)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2">
                             <span className="material-icons-round text-red-400">settings_power</span>
                             {t.addGen}
                         </button>
                         <button onClick={() => handleAddIndependentNode(ComponentType.TRANSFORMER)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2">
                             <span className="material-icons-round text-yellow-400">electric_bolt</span>
                             {t.addTrans}
                         </button>
                         <button onClick={() => handleAddIndependentNode(ComponentType.UPS)} className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2">
                             <span className="material-icons-round text-cyan-500">battery_charging_full</span>
                             UPS
                         </button>
                    </div>
                 )}
             </div>

             <div className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden mr-2">
                 <button onClick={handleUndo} disabled={history.length === 0} className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30">
                     <span className="material-icons-round text-sm">undo</span>
                 </button>
                 <div className="w-px bg-slate-700"></div>
                 <button onClick={handleRedo} disabled={future.length === 0} className="px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30">
                     <span className="material-icons-round text-sm">redo</span>
                 </button>
             </div>

             <div className="flex bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                 {(['en', 'he', 'ar'] as Language[]).map((lang) => (
                     <button key={lang} onClick={() => setLanguage(lang)} className={`px-2 py-1 text-xs font-medium ${language === lang ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                         {lang.toUpperCase()}
                     </button>
                 ))}
             </div>

             <button onClick={() => setShowAboutModal(true)} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700" title="About">
                <span className="material-icons-round">info</span>
            </button>

             <button 
                onClick={() => {
                    const newState = !isPrintMode;
                    setIsPrintMode(newState);
                    if (newState) {
                        handleEditPrintSettings();
                    }
                }} 
                className={`p-2 text-slate-400 hover:text-white rounded-lg border border-slate-700 ${isPrintMode ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`} 
                title={t.togglePrintMode}
            >
                <span className="material-icons-round">picture_as_pdf</span>
            </button>
            
             <button 
                onClick={() => setIsCleanView(true)} 
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700"
                title={t.cleanView}
             >
                <span className="material-icons-round">fullscreen</span>
            </button>

             <button onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700">
                <span className="material-icons-round">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
            </button>

             <button 
                onClick={() => {
                    setIsConnectMode(!isConnectMode);
                    setConnectionSource(null);
                    if(!isConnectMode) setSelectedNode(null);
                }}
                className={`p-2 rounded-lg transition-colors flex items-center gap-2 border ${isConnectMode ? 'bg-amber-600 text-white border-amber-500 shadow-lg' : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700'}`}
                title={t.linkComponents}
            >
                <span className="material-icons-round">link</span>
                {isConnectMode && <span className="text-xs font-bold px-1">{t.linking}</span>}
            </button>

             <button onClick={() => setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700">
                <span className="material-icons-round transform transition-transform duration-300" style={{ rotate: orientation === 'vertical' ? '90deg' : '0deg' }}>schema</span>
            </button>

             <button onClick={() => setShowExportModal(true)} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700">
                <span className="material-icons-round">save_alt</span>
            </button>

            <button onClick={handleAnalyze} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition-all flex items-center gap-2 text-sm">
                <span className="material-icons-round text-lg">auto_awesome</span>
                {t.analyze}
            </button>
        </div>
      </nav>
      )}

      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        {showProjectSidebar && !isCleanView && (
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="font-bold text-slate-300 text-sm uppercase tracking-wider">{t.projects}</h2>
                    <div className="flex gap-1">
                         <input type="file" ref={fileInputRef} onChange={handleImportProject} accept=".json" className="hidden" />
                         <button onClick={handleBackupAll} className="text-slate-400 hover:text-green-400 p-1 hover:bg-slate-800 rounded" title={t.backupAll}>
                            <span className="material-icons-round text-lg">archive</span>
                         </button>
                         <button onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded" title={t.importProject}>
                            <span className="material-icons-round text-lg">upload_file</span>
                        </button>
                        <button onClick={handleAddProject} className="text-blue-400 hover:text-blue-300 p-1 hover:bg-slate-800 rounded" title="Add Project">
                            <span className="material-icons-round text-lg">add_box</span>
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-4">
                    {projects.map(project => (
                        <div key={project.id} className="space-y-1">
                            <div 
                                className={`px-3 py-2 rounded flex items-center justify-between group ${activeProjectId === project.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50'}`}
                                onClick={() => { setActiveProjectId(project.id); setActivePageId(project.pages[0].id); }}
                            >
                                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                    <span className="material-icons-round text-sm shrink-0">folder</span>
                                    {editingId === project.id ? (
                                        <input 
                                            type="text" value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} autoFocus
                                            className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white" onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="font-medium text-sm truncate">{project.name}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {editingId !== project.id && <button onClick={(e) => { e.stopPropagation(); handleDownloadProject(project); }} className="text-slate-600 hover:text-green-400" title={t.backupProject}><span className="material-icons-round text-sm">save_alt</span></button>}
                                    {editingId !== project.id && <button onClick={(e) => { e.stopPropagation(); startEditing(project.id, project.name); }} className="text-slate-600 hover:text-blue-400"><span className="material-icons-round text-sm">edit</span></button>}
                                    {projects.length > 1 && editingId !== project.id && <button onClick={(e) => { e.stopPropagation(); handleDeleteProjectClick(project.id); }} className="text-slate-600 hover:text-red-400"><span className="material-icons-round text-sm">delete</span></button>}
                                </div>
                            </div>
                            
                            {activeProjectId === project.id && (
                                <div className={`space-y-1 border-slate-800 mx-2 ${isRTL ? 'border-r-2 pr-4' : 'border-l-2 pl-4'}`}>
                                    {project.pages.map(page => (
                                        <div key={page.id} className={`px-3 py-1.5 rounded cursor-pointer flex items-center justify-between group ${activePageId === page.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => setActivePageId(page.id)}>
                                            <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                                <span className="material-icons-round text-xs shrink-0">description</span>
                                                {editingId === page.id ? (
                                                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} autoFocus className="w-full bg-slate-700 border border-slate-600 rounded px-1 py-0.5 text-xs text-white" onClick={(e) => e.stopPropagation()} />
                                                ) : (
                                                    <span className="text-xs truncate">{page.name}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {editingId !== page.id && <button onClick={(e) => { e.stopPropagation(); startEditing(page.id, page.name); }} className="text-slate-600 hover:text-blue-400"><span className="material-icons-round text-[10px]">edit</span></button>}
                                                {project.pages.length > 1 && editingId !== page.id && <button onClick={(e) => { e.stopPropagation(); handleDeletePageClick(project.id, page.id); }} className="text-slate-600 hover:text-red-400"><span className="material-icons-round text-[10px]">close</span></button>}
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={handleAddPage} className={`px-3 py-1.5 w-full text-xs text-slate-600 hover:text-blue-400 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                                        <span className="material-icons-round text-sm">add</span>
                                        {t.addPage}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </aside>
        )}

        <div className="flex-1 relative p-4 flex flex-col bg-slate-950/50 overflow-hidden">
            {/* Clean View Controls */}
            {isCleanView && (
                <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-xl border border-slate-700 shadow-2xl">
                    <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-2 relative group">
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 rounded-lg transition-colors">
                            <span className="material-icons-round text-slate-500 text-sm">filter_alt</span>
                            <span>{t.filters.title} {activeFilters.size > 0 && `(${activeFilters.size})`}</span>
                            <span className="material-icons-round text-sm">expand_more</span>
                        </button>
                        
                        <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl hidden group-hover:block p-2 max-h-80 overflow-y-auto">
                            <div className="space-y-1">
                                <div className="px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.filters.title}</div>
                                {['meter', 'no-meter', 'generator', 'ac', 'reserved'].map(key => (
                                    <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.has(key)}
                                            onChange={() => toggleFilter(key)}
                                            className="rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-offset-slate-800"
                                        />
                                        <span className="text-sm text-slate-300">{t.filters[key === 'no-meter' ? 'noMeter' : key]}</span>
                                    </label>
                                ))}
                                
                                <div className="border-t border-slate-700 my-2"></div>
                                <div className="px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.filters.byType}</div>
                                
                                {Object.values(ComponentType).map(type => (
                                    <label key={type} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.has(type)}
                                            onChange={() => toggleFilter(type)}
                                            className="rounded bg-slate-900 border-slate-600 text-blue-600 focus:ring-offset-slate-800"
                                        />
                                        <span className="text-sm text-slate-300">{t.componentTypes[type]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsAnnotating(!isAnnotating)}
                        className={`p-2 rounded-lg transition-colors border ${isAnnotating ? 'bg-purple-600 text-white border-purple-500' : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border-transparent'}`}
                        title={isAnnotating ? t.annotations.disable : t.annotations.enable}
                    >
                        <span className="material-icons-round">edit</span>
                    </button>

                    {isAnnotating && (
                        <>
                            <input 
                                type="color" 
                                value={annotationColor} 
                                onChange={(e) => setAnnotationColor(e.target.value)} 
                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                                title={t.annotations.color}
                            />
                            <button
                                onClick={handleClearAnnotations}
                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-colors"
                                title={t.annotations.clear}
                            >
                                <span className="material-icons-round">delete_sweep</span>
                            </button>
                            <div className="w-px h-6 bg-slate-700 mx-1"></div>
                        </>
                    )}

                    <div className="w-px h-6 bg-slate-700"></div>

                    <button
                        onClick={() => setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal')}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                        title={t.toggleOrientation}
                    >
                        <span className="material-icons-round transform transition-transform duration-300" style={{ rotate: orientation === 'vertical' ? '90deg' : '0deg' }}>schema</span>
                    </button>

                    <button
                        onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                        title={t.toggleTheme}
                    >
                        <span className="material-icons-round">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
                    </button>

                     <div className="w-px h-6 bg-slate-700 mx-1"></div>

                    <button
                        onClick={() => setIsCleanView(false)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2 font-medium"
                        title={t.exitCleanView}
                    >
                        <span className="material-icons-round text-base">fullscreen_exit</span>
                        {t.exitCleanView}
                    </button>
                </div>
            )}

            {!isCleanView && (
                <div className="mb-2 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{t.active}:</span>
                        <span className="text-sm font-medium text-slate-200">{activeProject.name} / {activePage.name}</span>
                     </div>
                     {isConnectMode && (
                        <div className="bg-amber-900/40 border border-amber-700/50 px-3 py-1 rounded text-xs text-amber-300 animate-pulse font-bold">
                            {connectionSource ? t.connectMode.target : t.connectMode.source}
                        </div>
                     )}
                </div>
            )}
            <div className={`flex-1 rounded-xl border shadow-xl relative overflow-hidden ${isConnectMode ? 'border-amber-600/50 shadow-amber-900/20' : 'border-slate-800'} ${theme === 'light' ? 'bg-white' : 'bg-slate-900'}`}>
                <Diagram 
                    data={activePage.items} 
                    onNodeClick={handleNodeClick} 
                    onLinkClick={handleLinkClick}
                    onDuplicateChild={handleAddDuplicatedChild}
                    onDeleteNode={handleDeleteNodeClick}
                    onToggleCollapse={handleToggleCollapse}
                    onGroupNode={handleGroupNode}
                    onNodeMove={handleNodeMove}
                    onAddRoot={() => handleAddIndependentNode(ComponentType.SYSTEM_ROOT)}
                    onAddGenerator={() => handleAddIndependentNode(ComponentType.GENERATOR)}
                    onBackgroundClick={handleBackgroundClick}
                    selectedNodeId={selectedNode?.id || null}
                    multiSelection={multiSelection}
                    selectedLinkId={selectionMode === 'link' ? selectedNode?.id || null : null}
                    orientation={orientation}
                    searchMatches={searchMatches}
                    isConnectMode={isConnectMode}
                    connectionSourceId={connectionSource?.id || null}
                    isPrintMode={isPrintMode}
                    activeProject={activeProject}
                    onDisconnectLink={handleDisconnectLink}
                    onEditPrintSettings={handleEditPrintSettings}
                    t={t}
                    language={language}
                    theme={theme}
                    isCleanView={isCleanView}
                    activeFilters={activeFilters}
                    annotations={annotations}
                    isAnnotating={isAnnotating}
                    annotationColor={annotationColor}
                    onAnnotationAdd={handleAnnotationAdd}
                />
            </div>
        </div>

        {/* Input/Settings Panel */}
        {!isCleanView && (
            <aside className="w-96 bg-slate-900 border-l border-slate-800 overflow-y-auto flex flex-col z-30 shadow-2xl">
                {isPrintMode && !selectedNode ? (
                    <div className="flex flex-col h-full">
                         <div className="p-4 border-b border-slate-800 bg-slate-800/30">
                            <button 
                                onClick={() => handleEditPrintSettings()}
                                className="w-full py-2 px-4 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors flex items-center justify-center gap-2 mb-2"
                            >
                                <span className="material-icons-round text-sm">edit</span>
                                <span className="text-sm font-bold">{t.printSettings.title}</span>
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            <PrintSettingsPanel 
                                key={activeProjectId}
                                metadata={activeProject.printMetadata || DEFAULT_PRINT_METADATA}
                                projectName={activeProject.name}
                                onChange={handleUpdatePrintMetadata}
                                onUpdateProjectName={handleUpdateProjectName}
                                onClose={() => setIsPrintMode(false)}
                                focusField={printSettingsFocus}
                                t={t}
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-slate-800 bg-slate-800/30">
                            <h2 className="font-bold text-slate-200 flex items-center gap-2">
                                <span className="material-icons-round text-blue-400">tune</span>
                                {t.propertiesActions}
                            </h2>
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto">
                            <InputPanel 
                                selectedNode={selectedNode}
                                selectionMode={selectionMode}
                                multiSelectionCount={multiSelection.size}
                                onAdd={handleAddNode}
                                onAddIndependent={handleAddIndependentNode}
                                onEdit={handleEditNode}
                                onBulkEdit={handleBulkEdit}
                                onEditConnection={updateNodeConnectionStyle}
                                onDelete={() => {
                                    if (multiSelection.size > 0) {
                                        if(confirm(`${t.dialogs.deleteNode}`)) {
                                            executeBulkDelete(multiSelection);
                                        }
                                    } else if (selectedNode) {
                                        handleDeleteNodeClick(selectedNode);
                                    }
                                }}
                                onCancel={() => { setSelectedNode(null); setMultiSelection(new Set<string>()); setSelectionMode('node'); }}
                                onDetach={handleDetachNode}
                                onStartConnection={handleStartConnection}
                                onNavigate={handleNavigateToNode}
                                onDisconnectLink={handleDisconnectLink}
                                t={t}
                            />
                        </div>
                    </>
                )}
                
                <div className="p-4 border-t border-slate-800 text-center">
                     <button onClick={handleReset} className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors">
                        {t.resetDiagram}
                    </button>
                </div>
            </aside>
        )}
      </main>

      <AnalysisModal isOpen={showAnalysis} onClose={() => setShowAnalysis(false)} loading={isAnalyzing} result={analysisResult} t={t} />
      <ConfirmationModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} t={t} />
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onExport={handleExport} t={t} />
      <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} t={t} />
    </div>
  );
}
