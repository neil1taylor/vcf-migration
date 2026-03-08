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
    x: 1.33, y: 1.25, w: 24.0, h: 0.93,
    fontSize: FONTS.bodySize, fontFace: FONTS.face,
    color: COLORS.ibmBlue, bold: true,
  });

  // Explanatory paragraph
  slide.addText(
    'Based on current IBM Cloud US South region list prices. A detailed pricing proposal will be provided at the next stage. Costs do not include storage, networking, or support.',
    {
      x: 1.33, y: 2.05, w: 24.0, h: 1.07,
      fontSize: FONTS.smallSize, fontFace: FONTS.face,
      color: COLORS.darkGray,
    }
  );

  const cellOpts = { fontSize: 21, fontFace: FONTS.face, color: COLORS.darkGray };
  const rightCellOpts = { ...cellOpts, align: 'right' as const };
  const headerOpts = { bold: true, fill: { color: COLORS.ibmBlue }, color: COLORS.white, fontSize: 21, fontFace: FONTS.face };

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
  const kpiY = 3.07;
  if (includeROKS && includeVSI) {
    // 4 KPIs: separate ROKS and VSI costs
    const kpiW = 6.0;
    addKPINumber(slide, 'ROKS Monthly', fmtCurrency(roksMonthly), { x: 1.33, y: kpiY, w: kpiW });
    addKPINumber(slide, 'VSI Monthly', fmtCurrency(vsiMonthly), { x: 1.33 + kpiW, y: kpiY, w: kpiW });
    addKPINumber(slide, 'ROKS Annual', fmtCurrency(roksMonthly * 12), { x: 1.33 + kpiW * 2, y: kpiY, w: kpiW });
    addKPINumber(slide, 'VSI Annual', fmtCurrency(vsiMonthly * 12), { x: 1.33 + kpiW * 3, y: kpiY, w: kpiW });
  } else {
    // 3 KPIs: single platform
    const kpiW = 8.0;
    addKPINumber(slide, 'Total Monthly', fmtCurrency(totalMonthly), { x: 1.33, y: kpiY, w: kpiW });
    addKPINumber(slide, 'Total Annual', fmtCurrency(totalAnnual), { x: 1.33 + kpiW, y: kpiY, w: kpiW });
    addKPINumber(slide, 'Total VMs / Nodes', fmt(totalCount), { x: 1.33 + kpiW * 2, y: kpiY, w: kpiW });
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
    x: 1.33,
    y: 5.2,
    w: 24.0,
    colW: [4.8, 5.87, 2.13, 5.33, 5.87],
    border: { type: 'solid', pt: 0.5, color: COLORS.mediumGray },
    autoPage: false,
  });
}
