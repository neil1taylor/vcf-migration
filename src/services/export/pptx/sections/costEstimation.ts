// Cost Estimation Slide — cost breakdown table with pricing caveat

import type PptxGenJS from 'pptxgenjs';
import type { ROKSSizing, VSIMapping } from '../../docx/types';
import type { PptxExportOptions } from '../types';
import { COLORS, FONTS } from '../types';
import { addSlideTitle, fmtCurrency } from '../utils';

export function addCostEstimationSlide(
  pres: PptxGenJS,
  roksSizing: ROKSSizing,
  vsiMappings: VSIMapping[],
  options: PptxExportOptions
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Cost Estimation');

  const includeROKS = options.includeROKS !== false;
  const includeVSI = options.includeVSI !== false;

  // Blue subtitle (pricing caveat promoted)
  slide.addText(
    'Estimated pricing based on current IBM Cloud list prices. A detailed pricing proposal will be provided at the next stage.',
    {
      x: 0.5, y: 0.85, w: 9.0, h: 0.35,
      fontSize: FONTS.bodySize, fontFace: FONTS.face,
      color: COLORS.ibmBlue, bold: true,
    }
  );

  const cellOpts = { fontSize: FONTS.smallSize, fontFace: FONTS.face, color: COLORS.darkGray };
  const rightCellOpts = { ...cellOpts, align: 'right' as const };
  const headerOpts = { bold: true, fill: { color: COLORS.ibmBlue }, color: COLORS.white, fontSize: FONTS.smallSize, fontFace: FONTS.face };

  // Detailed cost breakdown table
  const tableRows: PptxGenJS.TableRow[] = [];

  // Header
  tableRows.push([
    { text: 'Component', options: headerOpts },
    { text: 'Profile / Detail', options: headerOpts },
    { text: 'Qty', options: { ...headerOpts, align: 'right' as const } },
    { text: 'Monthly', options: { ...headerOpts, align: 'right' as const } },
    { text: 'Annual', options: { ...headerOpts, align: 'right' as const } },
  ]);

  let totalCount = 0;
  let totalMonthly = 0;

  // ROKS section
  if (includeROKS) {
    const roksMonthlyCost = roksSizing.monthlyCost;
    const roksAnnualCost = roksMonthlyCost * 12;
    totalCount += roksSizing.workerNodes;
    totalMonthly += roksMonthlyCost;

    tableRows.push([
      { text: 'ROKS Worker Nodes', options: cellOpts },
      { text: roksSizing.profileName, options: cellOpts },
      { text: String(roksSizing.workerNodes), options: rightCellOpts },
      { text: fmtCurrency(roksMonthlyCost), options: rightCellOpts },
      { text: fmtCurrency(roksAnnualCost), options: rightCellOpts },
    ]);
  }

  // VSI section — group by profile
  if (includeVSI) {
    const profileGroups = new Map<string, { count: number; monthly: number }>();
    for (const vm of vsiMappings) {
      const existing = profileGroups.get(vm.profile) || { count: 0, monthly: 0 };
      existing.count++;
      existing.monthly += vm.monthlyCost;
      profileGroups.set(vm.profile, existing);
    }

    let isFirst = true;
    for (const [profile, group] of profileGroups) {
      totalCount += group.count;
      totalMonthly += group.monthly;
      const annualCost = group.monthly * 12;

      tableRows.push([
        { text: isFirst ? 'VPC VSI' : '', options: cellOpts },
        { text: profile, options: cellOpts },
        { text: String(group.count), options: rightCellOpts },
        { text: fmtCurrency(group.monthly), options: rightCellOpts },
        { text: fmtCurrency(annualCost), options: rightCellOpts },
      ]);
      isFirst = false;
    }
  }

  // Totals row
  const boldCellOpts = { ...cellOpts, bold: true };
  const boldRightOpts = { ...rightCellOpts, bold: true };
  const totalAnnual = totalMonthly * 12;

  tableRows.push([
    { text: 'Total', options: boldCellOpts },
    { text: '', options: boldCellOpts },
    { text: String(totalCount), options: boldRightOpts },
    { text: fmtCurrency(totalMonthly), options: boldRightOpts },
    { text: fmtCurrency(totalAnnual), options: boldRightOpts },
  ]);

  slide.addTable(tableRows, {
    x: 0.5,
    y: 1.25,
    w: 9.0,
    colW: [1.8, 2.2, 0.8, 2.0, 2.2],
    border: { type: 'solid', pt: 0.5, color: COLORS.mediumGray },
    autoPage: false,
  });
}
