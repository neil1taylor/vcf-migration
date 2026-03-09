// Cost Estimation Slide — KPI tiles + cost breakdown table with pricing caveat

import type PptxGenJS from 'pptxgenjs';
import type { CostEstimate } from '@/services/costEstimation';
import type { ROKSSizing, VSIMapping } from '../../docx/types';
import type { PptxExportOptions } from '../types';
import { COLORS, FONTS } from '../types';
import { addSlideTitle, addKPINumber, fmtCurrency, fmt } from '../utils';

export function addCostEstimationSlide(
  pres: PptxGenJS,
  roksSizing: ROKSSizing,
  vsiMappings: VSIMapping[],
  options: PptxExportOptions,
  roksCostEstimate?: CostEstimate | null,
  vsiCostEstimate?: CostEstimate | null,
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Cost Estimation');

  const includeROKS = options.includeROKS !== false;
  const includeVSI = options.includeVSI !== false;
  const hasCachedRoks = includeROKS && !!roksCostEstimate;
  const hasCachedVsi = includeVSI && !!vsiCostEstimate;

  // Blue subtitle — indicate full platform costs when cached data available
  const subtitleText = hasCachedRoks || hasCachedVsi
    ? 'Estimated IBM Cloud Platform Costs'
    : 'Estimated IBM Cloud Compute Costs';
  slide.addText(subtitleText, {
    x: 1.33, y: 1.25, w: 24.0, h: 0.93,
    fontSize: FONTS.bodySize, fontFace: FONTS.face,
    color: COLORS.ibmBlue, bold: true,
  });

  // Explanatory paragraph
  const disclaimerText = hasCachedRoks || hasCachedVsi
    ? 'Based on current IBM Cloud list prices matching the Sizing Calculator configuration. Includes compute, licensing, storage, and platform services. A detailed pricing proposal will be provided at the next stage.'
    : 'Based on current IBM Cloud US South region list prices. A detailed pricing proposal will be provided at the next stage. Costs do not include storage, networking, or support.';
  slide.addText(disclaimerText, {
    x: 1.33, y: 2.05, w: 24.0, h: 1.07,
    fontSize: FONTS.smallSize, fontFace: FONTS.face,
    color: COLORS.darkGray,
  });

  // Count VSI profile groups to determine table density
  const profileGroupCount = includeVSI
    ? new Set(vsiMappings.map(vm => vm.profile)).size
    : 0;
  // Use smaller font when both platforms + many rows
  const roksLineItemCount = hasCachedRoks ? roksCostEstimate.lineItems.length : 1;
  const isCompact = includeROKS && includeVSI && (profileGroupCount + roksLineItemCount) > 8;
  const tableFontSize = isCompact ? 17 : 21;

  const cellOpts = { fontSize: tableFontSize, fontFace: FONTS.face, color: COLORS.darkGray };
  const rightCellOpts = { ...cellOpts, align: 'right' as const };
  const headerOpts = { bold: true, fill: { color: COLORS.ibmBlue }, color: COLORS.white, fontSize: tableFontSize, fontFace: FONTS.face };

  // Pre-calculate totals for KPI tiles
  let roksMonthly = 0;
  let vsiMonthly = 0;
  let totalCount = 0;

  if (includeROKS) {
    totalCount += roksSizing.workerNodes;
    roksMonthly = hasCachedRoks ? roksCostEstimate.totalMonthly : roksSizing.monthlyCost;
  }
  if (includeVSI) {
    if (hasCachedVsi) {
      vsiMonthly = vsiCostEstimate.totalMonthly;
      totalCount += vsiMappings.length;
    } else {
      for (const vm of vsiMappings) {
        totalCount++;
        vsiMonthly += vm.monthlyCost;
      }
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

  // Detailed cost breakdown table(s)
  const colW = [4.8, 5.87, 2.13, 5.33, 5.87];
  const tableOpts = {
    x: 1.33,
    w: 24.0,
    colW,
    border: { type: 'solid' as const, pt: 0.5, color: COLORS.mediumGray },
    autoPage: false,
  };

  const boldCellOpts = { ...cellOpts, bold: true };
  const boldRightOpts = { ...rightCellOpts, bold: true };

  const makeHeader = (): PptxGenJS.TableRow => [
    { text: 'Component', options: headerOpts },
    { text: 'Profile / Detail', options: headerOpts },
    { text: 'Qty', options: { ...headerOpts, align: 'right' as const } },
    { text: 'Monthly', options: { ...headerOpts, align: 'right' as const } },
    { text: 'Annual', options: { ...headerOpts, align: 'right' as const } },
  ];

  /** Build ROKS table rows from cached line items or fallback to simplified row */
  const buildRoksRows = (): PptxGenJS.TableRow[] => {
    const rows: PptxGenJS.TableRow[] = [makeHeader()];

    if (hasCachedRoks) {
      // Render each line item from the cached cost estimate
      for (const item of roksCostEstimate.lineItems) {
        rows.push([
          { text: item.category, options: cellOpts },
          { text: item.description, options: cellOpts },
          { text: String(item.quantity), options: rightCellOpts },
          { text: fmtCurrency(item.monthlyCost), options: rightCellOpts },
          { text: fmtCurrency(item.annualCost), options: rightCellOpts },
        ]);
      }

      // Discount row if applicable
      if (roksCostEstimate.discountPct > 0) {
        rows.push([
          { text: `Discount (${roksCostEstimate.discountType})`, options: { ...cellOpts, color: COLORS.green } },
          { text: `${roksCostEstimate.discountPct}%`, options: { ...cellOpts, color: COLORS.green } },
          { text: '', options: rightCellOpts },
          { text: `-${fmtCurrency(roksCostEstimate.discountAmountMonthly)}`, options: { ...rightCellOpts, color: COLORS.green } },
          { text: `-${fmtCurrency(roksCostEstimate.discountAmountAnnual)}`, options: { ...rightCellOpts, color: COLORS.green } },
        ]);
      }

      // Subtotal
      rows.push([
        { text: 'ROKS Subtotal', options: boldCellOpts },
        { text: '', options: boldCellOpts },
        { text: '', options: boldRightOpts },
        { text: fmtCurrency(roksCostEstimate.totalMonthly), options: boldRightOpts },
        { text: fmtCurrency(roksCostEstimate.totalAnnual), options: boldRightOpts },
      ]);
    } else {
      // Fallback: simplified single row
      const roksAnnualCost = roksSizing.monthlyCost * 12;
      rows.push([
        { text: 'ROKS Worker Nodes', options: cellOpts },
        { text: roksSizing.profileName, options: cellOpts },
        { text: String(roksSizing.workerNodes), options: rightCellOpts },
        { text: fmtCurrency(roksSizing.monthlyCost), options: rightCellOpts },
        { text: fmtCurrency(roksAnnualCost), options: rightCellOpts },
      ]);
      rows.push([
        { text: 'ROKS Subtotal', options: boldCellOpts },
        { text: '', options: boldCellOpts },
        { text: String(roksSizing.workerNodes), options: boldRightOpts },
        { text: fmtCurrency(roksSizing.monthlyCost), options: boldRightOpts },
        { text: fmtCurrency(roksAnnualCost), options: boldRightOpts },
      ]);
    }

    return rows;
  };

  /** Build VSI table rows from cached line items or fallback to profile groups */
  const buildVsiRows = (): PptxGenJS.TableRow[] => {
    const rows: PptxGenJS.TableRow[] = [makeHeader()];

    if (hasCachedVsi) {
      for (const item of vsiCostEstimate.lineItems) {
        rows.push([
          { text: item.category, options: cellOpts },
          { text: item.description, options: cellOpts },
          { text: String(item.quantity), options: rightCellOpts },
          { text: fmtCurrency(item.monthlyCost), options: rightCellOpts },
          { text: fmtCurrency(item.annualCost), options: rightCellOpts },
        ]);
      }

      if (vsiCostEstimate.discountPct > 0) {
        rows.push([
          { text: `Discount (${vsiCostEstimate.discountType})`, options: { ...cellOpts, color: COLORS.green } },
          { text: `${vsiCostEstimate.discountPct}%`, options: { ...cellOpts, color: COLORS.green } },
          { text: '', options: rightCellOpts },
          { text: `-${fmtCurrency(vsiCostEstimate.discountAmountMonthly)}`, options: { ...rightCellOpts, color: COLORS.green } },
          { text: `-${fmtCurrency(vsiCostEstimate.discountAmountAnnual)}`, options: { ...rightCellOpts, color: COLORS.green } },
        ]);
      }

      rows.push([
        { text: 'VSI Subtotal', options: boldCellOpts },
        { text: '', options: boldCellOpts },
        { text: '', options: boldRightOpts },
        { text: fmtCurrency(vsiCostEstimate.totalMonthly), options: boldRightOpts },
        { text: fmtCurrency(vsiCostEstimate.totalAnnual), options: boldRightOpts },
      ]);
    } else {
      // Fallback: group by profile
      const profileGroups = new Map<string, { count: number; monthly: number }>();
      for (const vm of vsiMappings) {
        const existing = profileGroups.get(vm.profile) || { count: 0, monthly: 0 };
        existing.count++;
        existing.monthly += vm.monthlyCost;
        profileGroups.set(vm.profile, existing);
      }

      let isFirst = true;
      let vsiCount = 0;
      for (const [profile, group] of profileGroups) {
        vsiCount += group.count;
        rows.push([
          { text: isFirst ? 'VPC VSI' : '', options: cellOpts },
          { text: profile, options: cellOpts },
          { text: String(group.count), options: rightCellOpts },
          { text: fmtCurrency(group.monthly), options: rightCellOpts },
          { text: fmtCurrency(group.monthly * 12), options: rightCellOpts },
        ]);
        isFirst = false;
      }
      rows.push([
        { text: 'VSI Subtotal', options: boldCellOpts },
        { text: '', options: boldCellOpts },
        { text: String(vsiCount), options: boldRightOpts },
        { text: fmtCurrency(vsiMonthly), options: boldRightOpts },
        { text: fmtCurrency(vsiMonthly * 12), options: boldRightOpts },
      ]);
    }

    return rows;
  };

  if (includeROKS && includeVSI) {
    // Two separate tables when both platforms are present
    const roksRows = buildRoksRows();
    slide.addTable(roksRows, { ...tableOpts, y: 5.2 });

    const vsiRows = buildVsiRows();
    const rowH = isCompact ? 0.43 : 0.53;
    const vsiTableY = 5.2 + (roksRows.length * rowH) + 0.27;
    slide.addTable(vsiRows, { ...tableOpts, y: vsiTableY });
  } else {
    // Single platform — one table with total
    const tableRows: PptxGenJS.TableRow[] = [makeHeader()];

    if (includeROKS) {
      if (hasCachedRoks) {
        for (const item of roksCostEstimate.lineItems) {
          tableRows.push([
            { text: item.category, options: cellOpts },
            { text: item.description, options: cellOpts },
            { text: String(item.quantity), options: rightCellOpts },
            { text: fmtCurrency(item.monthlyCost), options: rightCellOpts },
            { text: fmtCurrency(item.annualCost), options: rightCellOpts },
          ]);
        }
        if (roksCostEstimate.discountPct > 0) {
          tableRows.push([
            { text: `Discount (${roksCostEstimate.discountType})`, options: { ...cellOpts, color: COLORS.green } },
            { text: `${roksCostEstimate.discountPct}%`, options: { ...cellOpts, color: COLORS.green } },
            { text: '', options: rightCellOpts },
            { text: `-${fmtCurrency(roksCostEstimate.discountAmountMonthly)}`, options: { ...rightCellOpts, color: COLORS.green } },
            { text: `-${fmtCurrency(roksCostEstimate.discountAmountAnnual)}`, options: { ...rightCellOpts, color: COLORS.green } },
          ]);
        }
      } else {
        const roksAnnualCost = roksSizing.monthlyCost * 12;
        tableRows.push([
          { text: 'ROKS Worker Nodes', options: cellOpts },
          { text: roksSizing.profileName, options: cellOpts },
          { text: String(roksSizing.workerNodes), options: rightCellOpts },
          { text: fmtCurrency(roksSizing.monthlyCost), options: rightCellOpts },
          { text: fmtCurrency(roksAnnualCost), options: rightCellOpts },
        ]);
      }
    }

    if (includeVSI) {
      if (hasCachedVsi) {
        for (const item of vsiCostEstimate.lineItems) {
          tableRows.push([
            { text: item.category, options: cellOpts },
            { text: item.description, options: cellOpts },
            { text: String(item.quantity), options: rightCellOpts },
            { text: fmtCurrency(item.monthlyCost), options: rightCellOpts },
            { text: fmtCurrency(item.annualCost), options: rightCellOpts },
          ]);
        }
        if (vsiCostEstimate.discountPct > 0) {
          tableRows.push([
            { text: `Discount (${vsiCostEstimate.discountType})`, options: { ...cellOpts, color: COLORS.green } },
            { text: `${vsiCostEstimate.discountPct}%`, options: { ...cellOpts, color: COLORS.green } },
            { text: '', options: rightCellOpts },
            { text: `-${fmtCurrency(vsiCostEstimate.discountAmountMonthly)}`, options: { ...rightCellOpts, color: COLORS.green } },
            { text: `-${fmtCurrency(vsiCostEstimate.discountAmountAnnual)}`, options: { ...rightCellOpts, color: COLORS.green } },
          ]);
        }
      } else {
        const profileGroups = new Map<string, { count: number; monthly: number }>();
        for (const vm of vsiMappings) {
          const existing = profileGroups.get(vm.profile) || { count: 0, monthly: 0 };
          existing.count++;
          existing.monthly += vm.monthlyCost;
          profileGroups.set(vm.profile, existing);
        }

        let isFirst = true;
        for (const [profile, group] of profileGroups) {
          tableRows.push([
            { text: isFirst ? 'VPC VSI' : '', options: cellOpts },
            { text: profile, options: cellOpts },
            { text: String(group.count), options: rightCellOpts },
            { text: fmtCurrency(group.monthly), options: rightCellOpts },
            { text: fmtCurrency(group.monthly * 12), options: rightCellOpts },
          ]);
          isFirst = false;
        }
      }
    }

    tableRows.push([
      { text: 'Total', options: boldCellOpts },
      { text: '', options: boldCellOpts },
      { text: String(totalCount), options: boldRightOpts },
      { text: fmtCurrency(totalMonthly), options: boldRightOpts },
      { text: fmtCurrency(totalAnnual), options: boldRightOpts },
    ]);

    slide.addTable(tableRows, { ...tableOpts, y: 5.2 });
  }
}
