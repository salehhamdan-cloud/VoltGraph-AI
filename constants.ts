




import { ComponentType, Project, ConnectionStyle, PrintMetadata } from "./types";

export const DEFAULT_CONNECTION_STYLE: ConnectionStyle = {
  strokeColor: '#334155', // Dark slate for white background visibility
  lineStyle: 'solid',
  startMarker: 'none',
  endMarker: 'arrow'
};

export const DEFAULT_PRINT_METADATA: PrintMetadata = {
  engineer: "Engineer Name",
  approvedBy: "Approver",
  date: new Date().toLocaleDateString(),
  revision: "A",
  organization: "My Organization"
};

// Default Project Structure - Starts Empty
export const DEFAULT_PROJECT: Project = {
  id: 'proj-1',
  name: 'My First Project',
  printMetadata: DEFAULT_PRINT_METADATA,
  pages: [
    {
      id: 'page-1',
      name: 'Main Distribution',
      items: [] // Empty list of roots
    }
  ]
};

export const COMPONENT_CONFIG = {
  [ComponentType.SYSTEM_ROOT]: { color: '#475569', icon: 'domain' }, // Slate/Grey for Grid
  [ComponentType.TRANSFORMER]: { color: '#eab308', icon: 'electric_bolt' }, // Yellow
  [ComponentType.METER]: { color: '#3b82f6', icon: 'speed' }, // Blue
  [ComponentType.DISTRIBUTION_BOARD]: { color: '#64748b', icon: 'dns' }, // Slate
  [ComponentType.BREAKER]: { color: '#f97316', icon: 'toggle_off' }, // Orange
  [ComponentType.SWITCH]: { color: '#22c55e', icon: 'toggle_on' }, // Green
  [ComponentType.LOAD]: { color: '#a855f7', icon: 'lightbulb' }, // Purple
  [ComponentType.GENERATOR]: { color: '#ef4444', icon: 'letter_g' }, // Red - Changed to letter G
  [ComponentType.UPS]: { color: '#0891b2', icon: 'battery_charging_full' }, // Cyan/Teal
};

export const ICON_PATHS: Record<string, string> = {
  domain: "M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z",
  electric_bolt: "M15 2L2.5 13 13 14l-5 7 1 1 12.5-11L11 10l5-7z",
  speed: "M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z",
  dns: "M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
  toggle_off: "M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zM7 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z",
  toggle_on: "M17 7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h10c2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z",
  lightbulb: "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z",
  settings_power: "M7 24h2v-2H7v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zM16.59 5.41L15.17 4L12 7.17L8.83 4L7.41 5.41L10.59 8.59C8.46 9.06 7 11.27 7 13.5V21h10v-7.5c0-2.23-1.46-4.44-3.59-4.91L16.59 5.41z",
  help: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z",
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  visibility: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24 5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3 3-1.34 3-3 3z",
  visibility_off: "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z",
  folder_open: "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
  delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  link_off: "M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.55-1.15 2.84-2.63 3.05l1.52 1.52C20.8 15.77 22 14.02 22 12c0-2.76-2.24-5-5-5zM3.27 3L2 4.27l3.11 3.11C3.29 8.12 2 9.91 2 12c0 2.76 2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1 0-.25.03-.5.08-.73L6.29 13.5l.6.6.3.3 3.74 3.74.6.6 8.2 8.2L21 25.73 3.27 3z",
  close: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  letter_g: "M20.64 12.2c0-.63-.06-1.25-.16-1.84H12v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.25h2.92c1.71-1.58 2.69-3.9 2.69-6.61zM12 21c2.43 0 4.47-.8 5.96-2.18l-2.91-2.25c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H3.85v2.33C5.33 18.97 8.47 21 12 21zM6.97 13.71c-.18-.53-.28-1.09-.28-1.67s.1-1.14.28-1.67V8.05H3.85a8.55 8.55 0 0 0 0 7.99l3.12-2.33zM12 6.88c1.32 0 2.51.45 3.45 1.35l2.58-2.59A9 9 0 0 0 12 3c-3.53 0-6.67 2.03-8.15 5.05l3.12 2.33c.71-2.13 2.69-3.71 5.03-3.71z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  battery_charging_full: "M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z M11 20v-5.5H9L13 7v5.5h2L11 20z",
  ac_unit: "M12 12c0-3 2.5-5.5 5.5-5.5S23 9 23 12H12zM12 12c0 3-2.5 5.5-5.5 5.5S1 15 1 12h11zM12 12c0-3-2.5-5.5-5.5-5.5S1 9 1 12h11zM12 12c0 3 2.5 5.5 5.5 5.5S23 15 23 12H12z", // FAN ICON
  power_off: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z", // X ICON
  lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2 .9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
};

export const COMMON_MODELS = [
  "Schneider Electric Acti9",
  "Siemens Sentron",
  "ABB S200",
  "Eaton xDigital",
  "Legrand DX3",
  "General Electric TE",
  "Generic Heavy Duty",
  "Smart Meter Three Phase",
  "Caterpillar C15 Generator",
  "Kohler Power System",
  "APC Smart-UPS",
  "Eaton 9PX UPS",
  "Vertiv Liebert"
];