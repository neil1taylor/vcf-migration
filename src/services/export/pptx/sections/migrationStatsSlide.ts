// Migration Readiness Slide — remediation pre-flight checks table

import type PptxGenJS from 'pptxgenjs';
import type { RVToolsData } from '@/types/rvtools';
import type { MigrationMode } from '@/services/migration';
import { generateRemediationItems } from '@/services/migration';
import { COLORS, FONTS } from '../types';
import { addSlideTitle, addTable } from '../utils';
import { calculatePreflightCounts } from '../../docx/utils/calculations';

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

export function addMigrationStatsSlide(
  pres: PptxGenJS,
  rawData: RVToolsData,
  leaning: string
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Migration Readiness');

  // Determine mode from platform leaning
  const mode: MigrationMode = leaning === 'roks' ? 'roks' : 'vsi';

  // Calculate pre-flight counts and generate remediation items
  const counts = calculatePreflightCounts(rawData, mode);
  // VSI gets all checks (pass + fail); ROKS only gets issues (no all-checks variant)
  const includeAllChecks = mode === 'vsi';
  const items = generateRemediationItems(counts, mode, includeAllChecks);

  // Filter out unverifiable items (can't be checked from RVTools data)
  const visibleItems = items.filter(item => !item.isUnverifiable);

  const modeLabel = mode === 'roks' ? 'ROKS (OpenShift Virtualization)' : 'VPC VSI';

  // Blue subtitle
  slide.addText('Pre-flight Compatibility Checks', {
    x: 0.5, y: 0.85, w: 9.0, h: 0.35,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  // Explanatory paragraph
  slide.addText(`Automated checks against the RVTools data to identify potential blockers and warnings before migration. Items flagged may require remediation to ensure a smooth transition to ${modeLabel}.`, {
    x: 0.5, y: 1.2, w: 9.0, h: 0.6,
    fontSize: FONTS.smallSize,
    fontFace: FONTS.face,
    color: COLORS.darkGray,
  });

  // Build table rows
  const rows: string[][] = visibleItems.map(item => [
    item.name,
    severityLabel(item.severity),
    formatAffected(item.affectedCount, item.severity),
  ]);

  if (rows.length > 0) {
    addTable(
      slide,
      ['Pre-flight Check', 'Status', 'Affected'],
      rows,
      { y: 1.8, colW: [5.0, 2.0, 2.0], fontSize: 9 }
    );
  }
}
