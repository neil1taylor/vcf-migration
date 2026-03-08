// Migration Readiness Slide — remediation pre-flight checks with color-coded status

import type PptxGenJS from 'pptxgenjs';
import type { RVToolsData } from '@/types/rvtools';
import type { MigrationMode } from '@/services/migration';
import { generateRemediationItems } from '@/services/migration';
import { runPreFlightChecks, derivePreflightCounts } from '@/services/preflightChecks';
import { COLORS, FONTS } from '../types';
import { addSlideTitle } from '../utils';

/** Map severity to a human-readable status label */
function severityLabel(severity: string): string {
  switch (severity) {
    case 'blocker': return 'Blocker';
    case 'warning': return 'Warning';
    case 'success': return 'Pass';
    case 'info': return 'Info';
    case 'unknown': return 'Unknown';
    default: return severity.charAt(0).toUpperCase() + severity.slice(1);
  }
}

/** Format affected count for display */
function formatAffected(count: number, severity: string): string {
  if (severity === 'success' || count === 0) return '—';
  return `${count} VM${count !== 1 ? 's' : ''}`;
}

/** Map severity to fill color */
function severityFillColor(severity: string): string {
  switch (severity) {
    case 'success': return COLORS.green;
    case 'blocker': return COLORS.red;
    case 'warning': return COLORS.orange;
    case 'info': return COLORS.cyan;
    case 'unknown': return COLORS.mediumGray;
    default: return COLORS.mediumGray;
  }
}

export function addMigrationStatsSlide(
  pres: PptxGenJS,
  rawData: RVToolsData,
  leaning: string
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Migration Readiness');

  // Determine mode from platform leaning
  const mode: MigrationMode = leaning === 'roks' ? 'roks' : 'vsi';

  // Run pre-flight checks using the shared service and derive counts
  const checkResults = runPreFlightChecks(rawData, mode);
  const counts = derivePreflightCounts(checkResults, mode);
  const includeAllChecks = mode === 'vsi';
  const items = generateRemediationItems(counts, mode, includeAllChecks);

  // Filter out unverifiable items
  const visibleItems = items.filter(item => !item.isUnverifiable);

  const modeLabel = mode === 'roks' ? 'ROKS (OpenShift Virtualization)' : 'VPC VSI';

  // Blue subtitle
  slide.addText('Pre-flight Compatibility Checks', {
    x: 1.33, y: 1.25, w: 24.0, h: 0.93,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  // Explanatory paragraph
  slide.addText(`Automated checks against the RVTools data to identify potential blockers and warnings before migration. Items flagged may require remediation to ensure a smooth transition to ${modeLabel}.`, {
    x: 1.33, y: 2.05, w: 24.0, h: 1.6,
    fontSize: FONTS.smallSize,
    fontFace: FONTS.face,
    color: COLORS.darkGray,
  });

  if (visibleItems.length === 0) return;

  // Build custom table with color-coded status cells
  const headerOpts = {
    bold: true,
    fill: { color: COLORS.ibmBlue },
    color: COLORS.white,
    fontSize: 24,
    fontFace: FONTS.face,
    valign: 'middle' as const,
    align: 'left' as const,
  };

  const tableRows: PptxGenJS.TableRow[] = [];

  // Header row
  tableRows.push([
    { text: 'Pre-flight Check', options: headerOpts },
    { text: 'Status', options: headerOpts },
    { text: 'Affected', options: headerOpts },
  ]);

  // Data rows with color-coded status
  for (let i = 0; i < visibleItems.length; i++) {
    const item = visibleItems[i];
    const rowFill = i % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const baseCellOpts = {
      fontSize: 24,
      fontFace: FONTS.face,
      color: COLORS.darkGray,
      fill: { color: rowFill },
      valign: 'middle' as const,
      align: 'left' as const,
    };

    tableRows.push([
      { text: item.name, options: baseCellOpts },
      {
        text: severityLabel(item.severity),
        options: {
          fontSize: 24,
          fontFace: FONTS.face,
          color: COLORS.white,
          bold: true,
          fill: { color: severityFillColor(item.severity) },
          valign: 'middle' as const,
          align: 'center' as const,
        },
      },
      { text: formatAffected(item.affectedCount, item.severity), options: baseCellOpts },
    ]);
  }

  slide.addTable(tableRows, {
    x: 1.33,
    y: 4.0,
    w: 24.0,
    colW: [13.33, 5.33, 5.33],
    border: { type: 'solid', pt: 0.5, color: COLORS.mediumGray },
    autoPage: false,
  });
}
