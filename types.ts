
export enum ComponentType {
  SYSTEM_ROOT = 'SYSTEM_ROOT',
  TRANSFORMER = 'TRANSFORMER',
  METER = 'METER',
  DISTRIBUTION_BOARD = 'DISTRIBUTION_BOARD',
  BREAKER = 'BREAKER',
  SWITCH = 'SWITCH',
  LOAD = 'LOAD',
  GENERATOR = 'GENERATOR'
}

export interface ConnectionStyle {
  strokeColor?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  startMarker?: 'none' | 'arrow' | 'circle' | 'diamond';
  endMarker?: 'none' | 'arrow' | 'circle' | 'diamond';
}

export interface ElectricalNode {
  id: string;
  name: string;
  componentNumber?: string;
  type: ComponentType;
  model?: string;
  amps?: number;
  voltage?: number; // Volts
  kva?: number; // Kilovolt-Amperes
  description?: string;
  
  // Appearance
  customColor?: string;

  // Meter Property
  hasMeter?: boolean;
  meterNumber?: string;
  
  // Generator Connection Property
  hasGeneratorConnection?: boolean;
  generatorName?: string;

  // Positioning (Offset from tree layout)
  manualX?: number;
  manualY?: number;

  children: ElectricalNode[];
  extraConnections?: string[]; // IDs of additional upstream parents (visual connections)
  connectionStyle?: ConnectionStyle; // Style of the link coming INTO this node
  isCollapsed?: boolean; // View state: Hide children
}

export interface NewNodeData {
  name: string;
  componentNumber?: string;
  type: ComponentType;
  model?: string;
  amps?: number;
  voltage?: number;
  kva?: number;
  description?: string;
  customColor?: string;
  hasMeter?: boolean;
  meterNumber?: string;
  hasGeneratorConnection?: boolean;
  generatorName?: string;
}

export interface Page {
  id: string;
  name: string;
  items: ElectricalNode[]; // Changed from rootNode to items array to support multiple disconnected trees
}

export interface PrintMetadata {
  engineer: string;
  approvedBy: string;
  date: string;
  revision: string;
  organization: string;
}

export interface Project {
  id: string;
  name: string;
  pages: Page[];
  printMetadata?: PrintMetadata;
}

export interface AnalysisResult {
  status: 'safe' | 'warning' | 'danger';
  summary: string;
  issues: string[];
  recommendations: string[];
}