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

// 16:9 slide layout (inches) — matches IBM reference deck dimensions
export const SLIDE_WIDTH = 26.67;
export const SLIDE_HEIGHT = 15;
export const CUSTOM_LAYOUT_NAME = 'LAYOUT_WIDE_16x9';

// Title bar styling
export const TITLE_BAR = {
  x: 0,
  y: 0,
  w: SLIDE_WIDTH,
  h: 1.87,
  bgColor: '0f62fe',
  fontColor: 'ffffff',
  fontSize: 53,
  fontFace: 'IBM Plex Sans',
} as const;

// Body content area
export const BODY = {
  x: 1.33,
  y: 2.67,
  w: 24.0,
  maxH: 11.2,
} as const;

// Font defaults
export const FONTS = {
  face: 'IBM Plex Sans Light',
  titleSize: 75,
  subtitleSize: 43,
  headingSize: 53,
  bodySize: 32,
  smallSize: 27,
  kpiSize: 64,
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
