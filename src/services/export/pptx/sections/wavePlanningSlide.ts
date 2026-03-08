// Migration Wave Planning Slide

import type PptxGenJS from 'pptxgenjs';
import type { RVToolsData } from '@/types/rvtools';
import { COLORS, FONTS, BODY, type PptxExportOptions } from '../types';
import { addSlideTitle, addTable, fmt } from '../utils';
import { computeWavesForExport, getStrategyLabel } from '../utils/waveCalculations';

export function addWavePlanningSlide(
  pres: PptxGenJS,
  rawData: RVToolsData,
  options: PptxExportOptions
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Migration Wave Planning');

  const preference = options.wavePlanningPreference;

  if (!preference) {
    slide.addText('No wave planning strategy was configured. Configure wave planning on the Migration Comparison page to include wave data.', {
      x: BODY.x,
      y: BODY.y,
      w: BODY.w,
      h: 1.0,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      italic: true,
    });
    return;
  }

  // Strategy label
  const strategyLabel = getStrategyLabel(preference);
  slide.addText(`Strategy: ${strategyLabel}`, {
    x: BODY.x,
    y: 0.85,
    w: BODY.w,
    h: 0.35,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  // Compute waves — use VSI as default since it's the primary migration target
  const migrationMode = options.includeVSI ? 'vsi' : 'roks';
  const waves = computeWavesForExport(rawData, migrationMode, preference);

  if (waves.length === 0) {
    slide.addText('No active VMs found for wave planning.', {
      x: BODY.x,
      y: 1.4,
      w: BODY.w,
      h: 0.5,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      italic: true,
    });
    return;
  }

  const isComplexity = preference.wavePlanningMode === 'complexity';

  // Build table
  const headers = isComplexity
    ? ['Wave', 'Description', 'VMs', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Blockers', 'Avg Complexity']
    : ['Wave', 'Description', 'VMs', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Blockers'];

  const rows = waves.map((wave, idx) => {
    const waveName = isComplexity
      ? wave.name
      : `Wave ${idx + 1}: ${wave.name.length > 20 ? wave.name.substring(0, 17) + '...' : wave.name}`;
    const desc = wave.description.length > 35
      ? wave.description.substring(0, 32) + '...'
      : wave.description;

    const row: (string | number)[] = [
      waveName,
      desc,
      fmt(wave.vmCount),
      fmt(wave.vcpus),
      fmt(wave.memoryGiB),
      fmt(wave.storageGiB),
      wave.hasBlockers ? 'Yes' : 'No',
    ];

    if (isComplexity) {
      const avg = wave.avgComplexity ?? (wave.vms.length > 0
        ? Math.round(wave.vms.reduce((s, v) => s + v.complexity, 0) / wave.vms.length)
        : 0);
      row.push(avg);
    }

    return row;
  });

  const colW = isComplexity
    ? [1.2, 2.0, 0.6, 0.7, 1.1, 1.1, 0.8, 1.1]
    : [1.5, 2.5, 0.7, 0.7, 1.1, 1.1, 0.9];

  addTable(slide, headers, rows, {
    y: 1.25,
    fontSize: 9,
    colW,
  });

  // Caveat text
  slide.addText(
    'Wave groupings are preliminary suggestions. The migration partner will refine based on application dependencies and business priorities.',
    {
      x: BODY.x,
      y: 4.9,
      w: BODY.w,
      h: 0.4,
      fontSize: 8,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      italic: true,
    }
  );
}
