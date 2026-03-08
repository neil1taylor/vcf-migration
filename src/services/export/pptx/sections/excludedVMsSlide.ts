// Excluded VMs Slide — summary table by exclusion reason

import type PptxGenJS from 'pptxgenjs';
import type { RVToolsData, VirtualMachine } from '@/types/rvtools';
import { COLORS, FONTS } from '../types';
import { getAutoExclusion } from '@/utils/autoExclusion';
import { addSlideTitle, fmt } from '../utils';

export function addExcludedVMsSlide(
  pres: PptxGenJS,
  rawData: RVToolsData
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Excluded VMs');

  slide.addText('VMs Not Requiring Migration', {
    x: 0.5,
    y: 0.47,
    w: 9.0,
    h: 0.35,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  slide.addText(
    'Not all VMs in the source environment require migration. VMs such as templates, powered-off instances, vCenter management appliances, and infrastructure tooling (e.g. backup proxies, monitoring agents) are automatically excluded as they will be reprovisioned natively on the target platform or are no longer needed.',
    {
      x: 0.5,
      y: 0.77,
      w: 9.0,
      h: 0.6,
      fontSize: FONTS.smallSize,
      fontFace: FONTS.face,
      color: COLORS.darkGray,
    }
  );

  // Group VMs by exclusion reason label
  const labelCounts = new Map<string, number>();
  let totalExcluded = 0;

  for (const vm of rawData.vInfo as VirtualMachine[]) {
    const result = getAutoExclusion(vm);
    if (result.isAutoExcluded) {
      totalExcluded++;
      for (const label of result.labels) {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }
    }
  }

  const rows = [...labelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => [label, fmt(count)]);

  if (rows.length > 0) {
    const fontSize = FONTS.smallSize;
    const headerOpts = { bold: true, fill: { color: COLORS.ibmBlue }, color: COLORS.white, fontSize, fontFace: FONTS.face, valign: 'middle' as const, align: 'left' as const };
    const cellOpts = { fontSize, fontFace: FONTS.face, color: COLORS.darkGray, valign: 'middle' as const, align: 'left' as const };
    const boldCellOpts = { ...cellOpts, bold: true };

    const tableRows: PptxGenJS.TableRow[] = [
      [
        { text: 'Exclusion Reason', options: headerOpts },
        { text: 'VM Count', options: headerOpts },
      ],
      ...rows.map((row, rowIdx) => [
        { text: row[0], options: { ...cellOpts, fill: { color: rowIdx % 2 === 0 ? COLORS.white : COLORS.lightGray } } },
        { text: row[1], options: { ...cellOpts, fill: { color: rowIdx % 2 === 0 ? COLORS.white : COLORS.lightGray } } },
      ]),
      // Bold total row
      [
        { text: 'Total Excluded', options: { ...boldCellOpts, fill: { color: rows.length % 2 === 0 ? COLORS.white : COLORS.lightGray } } },
        { text: fmt(totalExcluded), options: { ...boldCellOpts, fill: { color: rows.length % 2 === 0 ? COLORS.white : COLORS.lightGray } } },
      ],
    ];

    slide.addTable(tableRows, {
      x: 0.5,
      y: 1.25,
      w: 9.0,
      colW: [6.0, 3.0],
      border: { type: 'solid', pt: 0.5, color: COLORS.mediumGray },
      autoPage: false,
    });
  } else {
    slide.addText('No VMs are auto-excluded.', {
      x: 0.5,
      y: 2.5,
      w: 9.0,
      h: 2.0,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      align: 'center',
      valign: 'middle',
    });
  }
}
