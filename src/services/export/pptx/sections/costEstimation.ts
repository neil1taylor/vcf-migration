// Cost Estimation Slide — KPI tiles + cost breakdown table with pricing caveat

import type PptxGenJS from 'pptxgenjs';
import type { ROKSSizing, VSIMapping } from '../../docx/types';
import type { PptxExportOptions } from '../types';
import { COLORS, FONTS } from '../types';
import { addSlideTitle, addKPINumber, fmtCurrency, fmt } from '../utils';

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

  // Blue subtitle
  slide.addText('Estimated IBM Cloud Compute Costs', {
    x: 0.5, y: 0.47, w: 9.0, h: 0.35,
    fontSize: FONTS.bodySize, fontFace: FONTS.face,
    color: COLORS.ibmBlue, bold: true,
  });

  // Explanatory paragraph
  slide.addText(
    'Based on current IBM Cloud US South region list prices. A detailed pricing proposal will be provided at the next stage. Costs do not include storage, networking, or support.',
    {
      x: 0.5, y: 0.77, w: 9.0, h: 0.4,
      fontSize: FONTS.smallSize, fontFace: FONTS.face,
      color: COLORS.darkGray,
    }
  );

  const cellOpts = { fontSize: 8, fontFace: FONTS.face, color: COLORS.darkGray };
  const rightCellOpts = { ...cellOpts, align: 'right' as const };
  const headerOpts = { bold: true, fill: { color: COLORS.ibmBlue }, color: COLORS.white, fontSize: 8, fontFace: FONTS.face };

  // Pre-calculate totals for KPI tiles
  let roksMonthly = 0;
  let vsiMonthly = 0;
  let totalCount = 0;

  if (includeROKS) {
    totalCount += roksSizing.workerNodes;
    roksMonthly = roksSizing.monthlyCost;
  }
  if (includeVSI) {
    for (const vm of vsiMappings) {
      totalCount++;
      vsiMonthly += vm.monthlyCost;
    }
  }
  const totalMonthly = roksMonthly + vsiMonthly;
  const totalAnnual = totalMonthly * 12;

  // KPI tiles
  const kpiY = 1.15;
  if (includeROKS && includeVSI) {
    // 4 KPIs: separate ROKS and VSI costs
    const kpiW = 2.25;
    addKPINumber(slide, 'ROKS Monthly', fmtCurrency(roksMonthly), { x: 0.5, y: kpiY, w: kpiW });
    addKPINumber(slide, 'VSI Monthly', fmtCurrency(vsiMonthly), { x: 0.5 + kpiW, y: kpiY, w: kpiW });
    addKPINumber(slide, 'ROKS Annual', fmtCurrency(roksMonthly * 12), { x: 0.5 + kpiW * 2, y: kpiY, w: kpiW });
    addKPINumber(slide, 'VSI Annual', fmtCurrency(vsiMonthly * 12), { x: 0.5 + kpiW * 3, y: kpiY, w: kpiW });
  } else {
    // 3 KPIs: single platform
    const kpiW = 3.0;
    addKPINumber(slide, 'Total Monthly', fmtCurrency(totalMonthly), { x: 0.5, y: kpiY, w: kpiW });
    addKPINumber(slide, 'Total Annual', fmtCurrency(totalAnnual), { x: 0.5 + kpiW, y: kpiY, w: kpiW });
    addKPINumber(slide, 'Total VMs / Nodes', fmt(totalCount), { x: 0.5 + kpiW * 2, y: kpiY, w: kpiW });
  }

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

  // ROKS section
  if (includeROKS) {
    const roksMonthlyCost = roksSizing.monthlyCost;
    const roksAnnualCost = roksMonthlyCost * 12;

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

  tableRows.push([
    { text: 'Total', options: boldCellOpts },
    { text: '', options: boldCellOpts },
    { text: String(totalCount), options: boldRightOpts },
    { text: fmtCurrency(totalMonthly), options: boldRightOpts },
    { text: fmtCurrency(totalAnnual), options: boldRightOpts },
  ]);

  slide.addTable(tableRows, {
    x: 0.5,
    y: 1.95,
    w: 9.0,
    colW: [1.8, 2.2, 0.8, 2.0, 2.2],
    border: { type: 'solid', pt: 0.5, color: COLORS.mediumGray },
    autoPage: false,
  });
}
