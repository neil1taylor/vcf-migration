// Migration Timeline Slide (consolidated from wave planning + timeline)

import type PptxGenJS from 'pptxgenjs';
import type { RVToolsData } from '@/types/rvtools';
import type { TimelinePhase } from '@/types/timeline';
import { calculateTimelineTotals } from '@/services/migration/timelineEstimation';
import { COLORS, FONTS, BODY, type PptxExportOptions } from '../types';
import { addSlideTitle, addTable, fmt } from '../utils';
import { getStrategyLabel } from '../utils/waveCalculations';

export function addWavePlanningSlide(
  pres: PptxGenJS,
  _rawData: RVToolsData,
  options: PptxExportOptions
): void {
  const preference = options.wavePlanningPreference;
  const phases = options.timelinePhases;
  const hasPhases = phases && phases.length > 0;

  // Nothing configured at all — show placeholder
  if (!preference && !hasPhases) {
    const slide = pres.addSlide({ masterName: 'CONTENT' });
    addSlideTitle(slide, 'Migration Timeline');
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

  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Migration Timeline');

  let nextY = 1.25;

  // Strategy subtitle (when wave preference is available)
  if (preference) {
    const strategyLabel = getStrategyLabel(preference);
    slide.addText(
      `The migration uses a ${strategyLabel} grouping strategy. Wave groupings are preliminary — the migration partner will refine based on application dependencies.`,
      {
        x: BODY.x,
        y: nextY,
        w: BODY.w,
        h: 0.93,
        fontSize: FONTS.bodySize,
        fontFace: FONTS.face,
        color: COLORS.ibmBlue,
        bold: true,
      }
    );
    nextY += 1.0;
  }

  // Phase table
  if (hasPhases) {
    const totals = calculateTimelineTotals(phases, options.timelineStartDate);

    // Summary line
    let summaryText = `Total estimated duration: ${totals.totalWeeks} weeks across ${totals.phaseCount} phases (${totals.waveCount} production wave${totals.waveCount !== 1 ? 's' : ''})`;
    if (totals.estimatedEndDate) {
      const startStr = formatDate(options.timelineStartDate!);
      const endStr = formatDate(totals.estimatedEndDate);
      summaryText += ` — ${startStr} to ${endStr}`;
    }

    // If no preference subtitle was shown, put summary at top position
    if (!preference) {
      nextY = 1.25;
    }

    slide.addText(summaryText, {
      x: BODY.x,
      y: nextY,
      w: BODY.w,
      h: 0.93,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.ibmBlue,
      bold: true,
    });

    // Explanatory text about pilot wave and duration estimation
    const explainY = nextY + 0.93;
    slide.addText(
      'The pilot wave migrates a small set of test VMs to prove the migration process before production waves begin. For this initial timeline, wave durations are estimated based on data volume at 500 GB/day throughput (with a minimum of 0.25 days per VM), rounded up to the nearest week.',
      {
        x: BODY.x,
        y: explainY,
        w: BODY.w,
        h: 1.07,
        fontSize: FONTS.smallSize,
        fontFace: FONTS.face,
        color: COLORS.darkGray,
      }
    );

    const tableY = explainY + 1.07;

    // Build phase table
    const tableHeaders = ['Phase', 'Source', 'VMs', 'Data (GiB)', 'Duration (wks)', 'Start Week', 'End Week'];

    const tableRows = phases.map((phase: TimelinePhase) => [
      phase.name,
      phase.waveSourceName || phaseTypeLabel(phase.type),
      phase.waveVmCount != null ? fmt(phase.waveVmCount) : '—',
      phase.waveStorageGiB != null ? fmt(Math.round(phase.waveStorageGiB)) : '—',
      String(phase.durationWeeks),
      String(phase.startWeek),
      String(phase.endWeek),
    ]);

    addTable(slide, tableHeaders, tableRows, {
      y: tableY,
      fontSize: 21,
      colW: [5.33, 4.8, 2.13, 2.67, 3.2, 2.93, 2.93],
    });
  } else {
    // Preference exists but no timeline phases configured
    slide.addText('Configure timeline phases on the Migration Comparison page to include the migration schedule.', {
      x: BODY.x,
      y: nextY + 1.15,
      w: BODY.w,
      h: 1.33,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      italic: true,
    });
  }
}

function phaseTypeLabel(type: string): string {
  switch (type) {
    case 'preparation': return 'Preparation';
    case 'pilot': return 'Pilot';
    case 'production': return 'Production';
    case 'validation': return 'Validation';
    case 'buffer': return 'Buffer';
    default: return type;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
