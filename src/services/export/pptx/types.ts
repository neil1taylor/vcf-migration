// PPTX Generator Types and Constants

import type { PlatformSelectionExport, VMReadiness, WavePlanningPreference } from '../docx/types';
export type { PlatformSelectionExport, VMReadiness, WavePlanningPreference };

export interface PptxExportOptions {
  clientName?: string;
  preparedBy?: string;
  companyName?: string;
  includeROKS?: boolean;
  includeVSI?: boolean;
  includeCosts?: boolean;
  platformSelection?: PlatformSelectionExport | null;
  wavePlanningPreference?: WavePlanningPreference | null;
}

// 16:9 slide layout (inches)
export const SLIDE_LAYOUT = 'LAYOUT_16x9' as const;
export const SLIDE_WIDTH = 10;
export const SLIDE_HEIGHT = 5.625;

// Title bar styling
export const TITLE_BAR = {
  x: 0,
  y: 0,
  w: SLIDE_WIDTH,
  h: 0.7,
  bgColor: '0f62fe',
  fontColor: 'ffffff',
  fontSize: 20,
  fontFace: 'IBM Plex Sans',
} as const;

// Body content area
export const BODY = {
  x: 0.5,
  y: 1.0,
  w: 9.0,
  maxH: 4.2,
} as const;

// Font defaults
export const FONTS = {
  face: 'IBM Plex Sans Light',
  titleSize: 28,
  subtitleSize: 16,
  headingSize: 20,
  bodySize: 12,
  smallSize: 10,
  kpiSize: 36,
} as const;

// IBM Design colors (hex without #)
export const COLORS = {
  ibmBlue: '0f62fe',
  darkGray: '393939',
  mediumGray: '8d8d8d',
  lightGray: 'f4f4f4',
  white: 'ffffff',
  green: '24a148',
  orange: 'ff832b',
  red: 'da1e28',
  purple: '8a3ffc',
  teal: '009d9a',
  cyan: '1192e8',
} as const;

// Chart colors array (hex without #)
export const PPTX_CHART_COLORS = [
  '24a148', // Green (Ready)
  'ff832b', // Orange (Warning)
  'da1e28', // Red (Blocker)
];
