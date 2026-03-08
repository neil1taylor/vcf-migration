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
      h: 2.67,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      italic: true,
    });
    return;
  }

  // Merged subtitle with strategy and disclaimer
  const strategyLabel = getStrategyLabel(preference);
  slide.addText(
    `The waves below use a ${strategyLabel} grouping strategy. Wave groupings are preliminary — the migration partner will refine based on application dependencies.`,
    {
      x: BODY.x,
      y: 1.25,
      w: BODY.w,
      h: 0.93,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.ibmBlue,
      bold: true,
    }
  );

  // Compute waves — use VSI as default since it's the primary migration target
  const migrationMode = options.includeVSI ? 'vsi' : 'roks';
  const waves = computeWavesForExport(rawData, migrationMode, preference);

  if (waves.length === 0) {
    slide.addText('No active VMs found for wave planning.', {
      x: BODY.x,
      y: 3.73,
      w: BODY.w,
      h: 1.33,
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
    ? ['Wave', 'VMs', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Blockers', 'Avg Complexity']
    : ['Wave', 'VMs', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Blockers'];

  const rows = waves.map((wave, idx) => {
    const waveName = isComplexity
      ? wave.name
      : `Wave ${idx + 1}: ${wave.name.length > 20 ? wave.name.substring(0, 17) + '...' : wave.name}`;

    const row: (string | number)[] = [
      waveName,
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
    ? [4.8, 1.87, 2.13, 3.2, 3.2, 2.4, 3.2]
    : [6.67, 2.13, 2.13, 3.2, 3.2, 2.67];

  addTable(slide, headers, rows, {
    y: 2.4,
    fontSize: 21,
    colW,
  });
}
