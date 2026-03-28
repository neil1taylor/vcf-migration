// Cost Comparison Panel — Source BOM vs all ROKS/ROVe architectures vs VPC VSI
// Displays summary tiles, a horizontally scrollable comparison table with
// expandable category rows, and notes.

import { useState, useMemo } from 'react';
import { Grid, Column, Tag, Tile } from '@carbon/react';
import { ChevronDown, ChevronRight } from '@carbon/icons-react';
import { MetricCard } from '@/components/common';
import type { CostComparisonResult } from '@/hooks/useCostComparison';
import type { CostEstimate, CostLineItem } from '@/services/costEstimation';

// ===== HELPERS =====

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyDetailed(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getDeltaPct(source: number, target: number): number | null {
  if (source === 0) return null;
  return ((target - source) / source) * 100;
}

function DeltaTag({ sourceCost, targetCost }: { sourceCost: number; targetCost: number }) {
  const pct = getDeltaPct(sourceCost, targetCost);
  if (pct === null) return null;
  const isNegative = pct < 0;
  return (
    <Tag
      type={isNegative ? 'green' : 'red'}
      size="sm"
      style={{ marginLeft: '0.25rem', whiteSpace: 'nowrap' }}
    >
      {isNegative ? '' : '+'}{Math.round(pct)}%
    </Tag>
  );
}

// ===== CATEGORY GROUPING =====

const CATEGORIES = ['Compute', 'Storage', 'Networking', 'Licensing', 'ODF', 'ACM'] as const;

function groupLineItemsByCategory(estimate: CostEstimate): Record<string, CostLineItem[]> {
  const groups: Record<string, CostLineItem[]> = {};
  for (const item of estimate.lineItems) {
    const cat = item.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

function getCategoryTotal(items: CostLineItem[] | undefined): number {
  if (!items || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.monthlyCost, 0);
}

// ===== COLUMN DEFINITIONS =====

interface ColumnDef {
  key: string;
  label: string;
  sublabel?: string;
  estimate: CostEstimate;
  isFuture?: boolean;
}

function buildColumns(comparison: CostComparisonResult): ColumnDef[] {
  const cols: ColumnDef[] = [];

  // Group ROKS estimates by solution type, then variant
  for (const entry of comparison.roksEstimates) {
    const variantLabel = entry.variant === 'full' ? 'ROKS' : 'ROVe';
    cols.push({
      key: `${entry.solutionType}-${entry.variant}`,
      label: entry.label,
      sublabel: variantLabel,
      estimate: entry.estimate,
      isFuture: entry.isFuture,
    });
  }

  // VSI
  if (comparison.vsiEstimate) {
    cols.push({
      key: 'vsi',
      label: 'VPC VSI',
      estimate: comparison.vsiEstimate,
    });
  }

  return cols;
}

// ===== COMPONENT =====

interface CostComparisonPanelProps {
  comparison: CostComparisonResult;
}

export function CostComparisonPanel({ comparison }: CostComparisonPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const columns = useMemo(() => buildColumns(comparison), [comparison]);

  const sourceGroups = useMemo(
    () => comparison.sourceBOM ? groupLineItemsByCategory(comparison.sourceBOM) : {},
    [comparison.sourceBOM],
  );

  const columnGroups = useMemo(
    () => columns.map(col => groupLineItemsByCategory(col.estimate)),
    [columns],
  );

  // All categories present across all estimates
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    if (comparison.sourceBOM) {
      for (const item of comparison.sourceBOM.lineItems) cats.add(item.category);
    }
    for (const col of columns) {
      for (const item of col.estimate.lineItems) cats.add(item.category);
    }
    // Order by CATEGORIES, then any extras
    const ordered: string[] = [];
    for (const c of CATEGORIES) {
      if (cats.has(c)) ordered.push(c);
    }
    for (const c of cats) {
      if (!ordered.includes(c)) ordered.push(c);
    }
    return ordered;
  }, [comparison.sourceBOM, columns]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const hasSourceBOM = comparison.sourceBOM !== null;

  return (
    <Grid condensed>
      {/* Summary tiles */}
      <Column lg={3} md={2} sm={2} style={{ marginBottom: '1rem' }}>
        <MetricCard
          label="Source Monthly"
          value={hasSourceBOM ? formatCurrency(comparison.sourceBOM!.totalMonthly) : 'N/A'}
          detail="VMware on Classic"
          variant="default"
          tooltip="Source VMware infrastructure costed on IBM Cloud Classic bare metal"
        />
      </Column>
      <Column lg={3} md={2} sm={2} style={{ marginBottom: '1rem' }}>
        <MetricCard
          label="Cheapest ROKS"
          value={comparison.cheapestRoks ? formatCurrency(comparison.cheapestRoks.totalMonthly) : 'N/A'}
          detail={comparison.cheapestRoks?.label}
          variant="teal"
          tooltip="Lowest-cost available ROKS architecture"
        />
      </Column>
      <Column lg={3} md={2} sm={2} style={{ marginBottom: '1rem' }}>
        <MetricCard
          label="Cheapest ROVe"
          value={comparison.cheapestRov ? formatCurrency(comparison.cheapestRov.totalMonthly) : 'N/A'}
          detail={comparison.cheapestRov?.label}
          variant="purple"
          tooltip="Lowest-cost available ROVe architecture"
        />
      </Column>
      <Column lg={3} md={2} sm={2} style={{ marginBottom: '1rem' }}>
        <MetricCard
          label="VPC VSI"
          value={comparison.vsiEstimate ? formatCurrency(comparison.vsiEstimate.totalMonthly) : 'N/A'}
          variant="primary"
          tooltip="VPC Virtual Server Instance total monthly cost"
        />
      </Column>
      <Column lg={4} md={2} sm={2} style={{ marginBottom: '1rem' }}>
        <MetricCard
          label="Best Savings"
          value={comparison.bestSavingsPct !== null ? `${Math.round(comparison.bestSavingsPct)}%` : 'N/A'}
          detail="vs Source"
          variant={comparison.bestSavingsPct !== null && comparison.bestSavingsPct > 0 ? 'success' : 'warning'}
          tooltip="Best savings percentage across all target options relative to source"
        />
      </Column>

      {/* Comparison table */}
      <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
        <Tile>
          <h3 style={{ marginBottom: '0.5rem' }}>Cost Comparison by Category</h3>
          <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
            Source VMware BOM vs all target architecture options. Click a category row to expand line-item details.
            Region: {comparison.regionName} ({comparison.region}). Discount: {comparison.discountType}.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: `${200 + columns.length * 140}px` }}>
              <thead>
                {/* Header row 1: solution type labels */}
                <tr style={{ borderBottom: '2px solid var(--cds-border-strong)' }}>
                  <th style={{ ...stickyCol, textAlign: 'left', padding: '0.5rem', fontWeight: 600 }}>Category</th>
                  <th style={{ ...stickyCol2, textAlign: 'right', padding: '0.5rem', fontWeight: 600 }}>Source BOM</th>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      style={{
                        textAlign: 'right',
                        padding: '0.5rem',
                        fontWeight: 600,
                        opacity: col.isFuture ? 0.5 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div>{col.label}</div>
                      {col.sublabel && (
                        <div style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
                          {col.sublabel}
                        </div>
                      )}
                      {col.isFuture && <Tag type="purple" size="sm">Future</Tag>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeCategories.map(cat => {
                  const isExpanded = expandedCategories.has(cat);
                  const sourceTotal = getCategoryTotal(sourceGroups[cat]);

                  return (
                    <CategoryRow
                      key={cat}
                      category={cat}
                      sourceTotal={sourceTotal}
                      sourceItems={sourceGroups[cat]}
                      columns={columns}
                      columnGroups={columnGroups}
                      isExpanded={isExpanded}
                      onToggle={() => toggleCategory(cat)}
                    />
                  );
                })}

                {/* Total Monthly row */}
                <tr style={{ borderTop: '2px solid var(--cds-border-strong)', fontWeight: 700 }}>
                  <td style={{ ...stickyCol, padding: '0.75rem 0.5rem' }}>Total Monthly</td>
                  <td style={{ ...stickyCol2, textAlign: 'right', padding: '0.75rem 0.5rem' }}>
                    {hasSourceBOM ? formatCurrency(comparison.sourceBOM!.totalMonthly) : 'N/A'}
                  </td>
                  {columns.map(col => (
                    <td key={col.key} style={{ textAlign: 'right', padding: '0.75rem 0.5rem', opacity: col.isFuture ? 0.5 : 1 }}>
                      {formatCurrency(col.estimate.totalMonthly)}
                      {hasSourceBOM && (
                        <DeltaTag sourceCost={comparison.sourceBOM!.totalMonthly} targetCost={col.estimate.totalMonthly} />
                      )}
                    </td>
                  ))}
                </tr>

                {/* Total Annual row */}
                <tr style={{ fontWeight: 600, color: 'var(--cds-text-secondary)' }}>
                  <td style={{ ...stickyCol, padding: '0.5rem' }}>Total Annual</td>
                  <td style={{ ...stickyCol2, textAlign: 'right', padding: '0.5rem' }}>
                    {hasSourceBOM ? formatCurrency(comparison.sourceBOM!.totalAnnual) : 'N/A'}
                  </td>
                  {columns.map(col => (
                    <td key={col.key} style={{ textAlign: 'right', padding: '0.5rem', opacity: col.isFuture ? 0.5 : 1 }}>
                      {formatCurrency(col.estimate.totalAnnual)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Tile>
      </Column>

      {/* Notes */}
      {(comparison.sourceWarnings.length > 0 || comparison.pricingVersion) && (
        <Column lg={16} md={8} sm={4}>
          <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
            {comparison.pricingVersion && <p>Pricing version: {comparison.pricingVersion}</p>}
            {comparison.sourceWarnings.map((w, i) => (
              <p key={i} style={{ color: 'var(--cds-text-error)' }}>{w}</p>
            ))}
          </div>
        </Column>
      )}
    </Grid>
  );
}

// ===== CATEGORY ROW =====

interface CategoryRowProps {
  category: string;
  sourceTotal: number;
  sourceItems: CostLineItem[] | undefined;
  columns: ColumnDef[];
  columnGroups: Record<string, CostLineItem[]>[];
  isExpanded: boolean;
  onToggle: () => void;
}

function CategoryRow({ category, sourceTotal, sourceItems, columns, columnGroups, isExpanded, onToggle }: CategoryRowProps) {
  const Icon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <>
      {/* Category summary row */}
      <tr
        style={{ borderBottom: '1px solid var(--cds-border-subtle)', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <td style={{ ...stickyCol, padding: '0.5rem', fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Icon size={16} />
            {category}
          </span>
        </td>
        <td style={{ ...stickyCol2, textAlign: 'right', padding: '0.5rem' }}>
          {sourceTotal > 0 ? formatCurrency(sourceTotal) : '$0'}
        </td>
        {columns.map((col, i) => {
          const targetTotal = getCategoryTotal(columnGroups[i][category]);
          return (
            <td key={col.key} style={{ textAlign: 'right', padding: '0.5rem', opacity: col.isFuture ? 0.5 : 1 }}>
              {targetTotal > 0 ? formatCurrency(targetTotal) : '$0'}
              {sourceTotal > 0 && targetTotal > 0 && (
                <DeltaTag sourceCost={sourceTotal} targetCost={targetTotal} />
              )}
            </td>
          );
        })}
      </tr>

      {/* Expanded line items */}
      {isExpanded && (
        <LineItemRows
          sourceItems={sourceItems}
          columns={columns}
          columnGroups={columnGroups}
          category={category}
        />
      )}
    </>
  );
}

// ===== LINE ITEM ROWS =====

interface LineItemRowsProps {
  sourceItems: CostLineItem[] | undefined;
  columns: ColumnDef[];
  columnGroups: Record<string, CostLineItem[]>[];
  category: string;
}

function LineItemRows({ sourceItems, columns, columnGroups, category }: LineItemRowsProps) {
  // Collect all unique descriptions across source + all targets
  const allDescriptions = useMemo(() => {
    const descs = new Set<string>();
    if (sourceItems) sourceItems.forEach(i => descs.add(i.description));
    for (const groups of columnGroups) {
      const items = groups[category];
      if (items) items.forEach(i => descs.add(i.description));
    }
    return Array.from(descs);
  }, [sourceItems, columnGroups, category]);

  return (
    <>
      {allDescriptions.map(desc => {
        const sourceItem = sourceItems?.find(i => i.description === desc);
        return (
          <tr key={desc} style={{ fontSize: '0.8125rem', color: 'var(--cds-text-secondary)', borderBottom: '1px solid var(--cds-border-subtle)' }}>
            <td style={{ ...stickyCol, padding: '0.25rem 0.5rem 0.25rem 2rem' }}>{desc}</td>
            <td style={{ ...stickyCol2, textAlign: 'right', padding: '0.25rem 0.5rem' }}>
              {sourceItem ? (
                <span title={`${sourceItem.quantity} ${sourceItem.unit} @ ${formatCurrencyDetailed(sourceItem.unitCost)}`}>
                  {formatCurrency(sourceItem.monthlyCost)}
                </span>
              ) : '—'}
            </td>
            {columns.map((col, i) => {
              const targetItem = columnGroups[i][category]?.find(it => it.description === desc);
              return (
                <td key={col.key} style={{ textAlign: 'right', padding: '0.25rem 0.5rem', opacity: col.isFuture ? 0.5 : 1 }}>
                  {targetItem ? (
                    <span title={`${targetItem.quantity} ${targetItem.unit} @ ${formatCurrencyDetailed(targetItem.unitCost)}`}>
                      {formatCurrency(targetItem.monthlyCost)}
                    </span>
                  ) : '—'}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

// ===== STICKY COLUMN STYLES =====

const stickyCol: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  backgroundColor: 'var(--cds-layer)',
  zIndex: 2,
  minWidth: '120px',
};

const stickyCol2: React.CSSProperties = {
  position: 'sticky',
  left: '120px',
  backgroundColor: 'var(--cds-layer)',
  zIndex: 2,
  minWidth: '100px',
};
