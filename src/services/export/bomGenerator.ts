// Bill of Materials (BOM) Generator
import type { CostEstimate } from '../costEstimation';
import { formatCurrency, formatCurrencyPrecise } from '../costEstimation';

/**
 * Generate BOM as formatted text
 */
export function generateBOMText(estimate: CostEstimate, title: string = 'IBM Cloud Migration'): string {
  const lines: string[] = [];
  const width = 110;
  const divider = '='.repeat(width);
  const thinDivider = '-'.repeat(width);

  lines.push(divider);
  lines.push(`IBM CLOUD - BILL OF MATERIALS`);
  lines.push(`${title}`);
  lines.push(divider);
  lines.push('');
  lines.push(`Architecture:    ${estimate.architecture}`);
  lines.push(`Region:          ${estimate.regionName} (${estimate.region})`);
  lines.push(`Pricing:         ${estimate.discountType === 'onDemand' ? 'On-Demand' : estimate.discountType}`);
  lines.push(`Generated:       ${new Date(estimate.metadata.generatedAt).toLocaleString()}`);
  lines.push(`Pricing Version: ${estimate.metadata.pricingVersion}`);
  lines.push('');
  lines.push(thinDivider);
  lines.push('LINE ITEMS');
  lines.push(thinDivider);
  lines.push('');

  // Header
  const header = [
    'Category'.padEnd(20),
    'Description'.padEnd(30),
    'Qty'.padStart(8),
    'Unit'.padEnd(12),
    'Unit Cost'.padStart(12),
    'Monthly'.padStart(14),
    'Annual'.padStart(14),
  ].join('');
  lines.push(header);
  lines.push(thinDivider);

  // Line items
  for (const item of estimate.lineItems) {
    const line = [
      item.category.substring(0, 20).padEnd(20),
      item.description.substring(0, 30).padEnd(30),
      item.quantity.toLocaleString().padStart(8),
      item.unit.substring(0, 12).padEnd(12),
      formatCurrencyPrecise(item.unitCost).padStart(12),
      formatCurrency(item.monthlyCost).padStart(14),
      formatCurrency(item.annualCost).padStart(14),
    ].join('');
    lines.push(line);

    if (item.notes) {
      lines.push(`${''.padEnd(21)}└─ ${item.notes}`);
    }
  }

  lines.push(thinDivider);

  // Subtotal
  const subtotalLine = [
    'SUBTOTAL'.padEnd(82),
    formatCurrency(estimate.subtotalMonthly).padStart(14),
    formatCurrency(estimate.subtotalAnnual).padStart(14),
  ].join('');
  lines.push(subtotalLine);

  // Discount
  if (estimate.discountPct > 0) {
    const discountLine = [
      `Discount (${estimate.discountPct}% - ${estimate.discountType})`.padEnd(82),
      `-${formatCurrency(estimate.discountAmountMonthly)}`.padStart(14),
      `-${formatCurrency(estimate.discountAmountAnnual)}`.padStart(14),
    ].join('');
    lines.push(discountLine);
    lines.push(thinDivider);
  }

  // Total
  const totalLine = [
    'TOTAL'.padEnd(82),
    formatCurrency(estimate.totalMonthly).padStart(14),
    formatCurrency(estimate.totalAnnual).padStart(14),
  ].join('');
  lines.push(totalLine);
  lines.push(divider);

  // Summary
  lines.push('');
  lines.push('SUMMARY');
  lines.push(thinDivider);
  lines.push(`  Monthly Cost:      ${formatCurrency(estimate.totalMonthly).padStart(15)}`);
  lines.push(`  Annual Cost:       ${formatCurrency(estimate.totalAnnual).padStart(15)}`);

  if (estimate.discountPct > 0) {
    lines.push(`  Discount Applied:  ${estimate.discountPct.toFixed(1).padStart(14)}%`);
    lines.push(`  Annual Savings:    ${formatCurrency(estimate.discountAmountAnnual).padStart(15)}`);
  }

  lines.push('');
  lines.push('NOTES');
  lines.push(thinDivider);
  for (const note of estimate.metadata.notes) {
    lines.push(`  • ${note}`);
  }

  lines.push('');
  lines.push(divider);

  return lines.join('\n');
}

/**
 * Generate BOM as JSON
 */
export function generateBOMJSON(estimate: CostEstimate, title: string = 'IBM Cloud Migration'): string {
  const bom = {
    title,
    ...estimate,
    summary: {
      monthlyCost: estimate.totalMonthly,
      annualCost: estimate.totalAnnual,
      discountApplied: estimate.discountPct > 0,
      annualSavings: estimate.discountAmountAnnual,
    },
  };

  return JSON.stringify(bom, null, 2);
}

/**
 * Generate BOM as CSV
 */
export function generateBOMCSV(estimate: CostEstimate): string {
  const headers = ['Category', 'Description', 'Quantity', 'Unit', 'Unit Cost', 'Monthly Cost', 'Annual Cost', 'Notes'];
  const rows: string[][] = [];

  // Add line items
  for (const item of estimate.lineItems) {
    rows.push([
      `"${item.category}"`,
      `"${item.description}"`,
      item.quantity.toString(),
      `"${item.unit}"`,
      item.unitCost.toFixed(2),
      item.monthlyCost.toFixed(2),
      item.annualCost.toFixed(2),
      `"${item.notes || ''}"`,
    ]);
  }

  // Add subtotal
  rows.push(['', '', '', '', '', '', '', '']);
  rows.push(['"SUBTOTAL"', '', '', '', '', estimate.subtotalMonthly.toFixed(2), estimate.subtotalAnnual.toFixed(2), '']);

  // Add discount
  if (estimate.discountPct > 0) {
    rows.push([
      `"Discount (${estimate.discountPct}%)"`,
      '',
      '',
      '',
      '',
      (-estimate.discountAmountMonthly).toFixed(2),
      (-estimate.discountAmountAnnual).toFixed(2),
      '',
    ]);
  }

  // Add total
  rows.push(['"TOTAL"', '', '', '', '', estimate.totalMonthly.toFixed(2), estimate.totalAnnual.toFixed(2), '']);

  // Add metadata
  rows.push(['', '', '', '', '', '', '', '']);
  rows.push(['"Architecture"', `"${estimate.architecture}"`, '', '', '', '', '', '']);
  rows.push(['"Region"', `"${estimate.regionName}"`, '', '', '', '', '', '']);
  rows.push(['"Pricing Version"', `"${estimate.metadata.pricingVersion}"`, '', '', '', '', '', '']);
  rows.push(['"Generated"', `"${estimate.metadata.generatedAt}"`, '', '', '', '', '', '']);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Download BOM file
 */
export function downloadBOM(
  estimate: CostEstimate,
  format: 'text' | 'json' | 'csv' = 'text',
  filename?: string
): void {
  let content: string;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case 'json':
      content = generateBOMJSON(estimate);
      mimeType = 'application/json';
      extension = 'json';
      break;
    case 'csv':
      content = generateBOMCSV(estimate);
      mimeType = 'text/csv';
      extension = 'csv';
      break;
    default:
      content = generateBOMText(estimate);
      mimeType = 'text/plain';
      extension = 'txt';
  }

  const defaultFilename = `ibm-cloud-bom-${estimate.region}-${new Date().toISOString().split('T')[0]}.${extension}`;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate comparison table between two estimates
 */
export function generateComparisonText(
  estimate1: CostEstimate,
  estimate2: CostEstimate,
  label1: string = 'Option A',
  label2: string = 'Option B'
): string {
  const lines: string[] = [];
  const width = 80;
  const divider = '='.repeat(width);

  lines.push(divider);
  lines.push('IBM CLOUD - ARCHITECTURE COMPARISON');
  lines.push(divider);
  lines.push('');
  lines.push(`${label1.padEnd(30)} vs ${label2}`);
  lines.push('');

  lines.push('-'.repeat(width));
  lines.push(['Metric'.padEnd(30), label1.padStart(20), label2.padStart(20), 'Difference'.padStart(15)].join(''));
  lines.push('-'.repeat(width));

  // Monthly cost
  const monthlyDiff = estimate2.totalMonthly - estimate1.totalMonthly;
  lines.push(
    [
      'Monthly Cost'.padEnd(30),
      formatCurrency(estimate1.totalMonthly).padStart(20),
      formatCurrency(estimate2.totalMonthly).padStart(20),
      `${monthlyDiff >= 0 ? '+' : ''}${formatCurrency(monthlyDiff)}`.padStart(15),
    ].join('')
  );

  // Annual cost
  const annualDiff = estimate2.totalAnnual - estimate1.totalAnnual;
  lines.push(
    [
      'Annual Cost'.padEnd(30),
      formatCurrency(estimate1.totalAnnual).padStart(20),
      formatCurrency(estimate2.totalAnnual).padStart(20),
      `${annualDiff >= 0 ? '+' : ''}${formatCurrency(annualDiff)}`.padStart(15),
    ].join('')
  );

  // Percentage difference
  const pctDiff = ((estimate2.totalAnnual - estimate1.totalAnnual) / estimate1.totalAnnual) * 100;
  lines.push(
    [
      'Cost Difference'.padEnd(30),
      ''.padStart(20),
      ''.padStart(20),
      `${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(1)}%`.padStart(15),
    ].join('')
  );

  lines.push('-'.repeat(width));

  // Recommendation
  lines.push('');
  if (estimate1.totalAnnual < estimate2.totalAnnual) {
    lines.push(`RECOMMENDATION: ${label1} is ${formatCurrency(Math.abs(annualDiff))} cheaper annually`);
  } else if (estimate2.totalAnnual < estimate1.totalAnnual) {
    lines.push(`RECOMMENDATION: ${label2} is ${formatCurrency(Math.abs(annualDiff))} cheaper annually`);
  } else {
    lines.push('RECOMMENDATION: Both options have equal cost');
  }

  lines.push('');
  lines.push(divider);

  return lines.join('\n');
}
