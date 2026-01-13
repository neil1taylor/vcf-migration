// Cost Estimation Component
import { useState, useMemo } from 'react';
import {
  Tile,
  Select,
  SelectItem,
  Button,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  InlineNotification,
} from '@carbon/react';
import { Download, Calculator } from '@carbon/icons-react';
import { MetricCard } from '@/components/common';
import { PricingRefresh } from '@/components/pricing';
import { useDynamicPricing } from '@/hooks';
import type { CostEstimate, RegionCode, DiscountType, ROKSSizingInput, VSISizingInput } from '@/services/costEstimation';
import {
  calculateROKSCost,
  calculateVSICost,
  getRegions,
  getDiscountOptions,
  formatCurrency,
} from '@/services/costEstimation';
import { downloadBOM } from '@/services/export';
import './CostEstimation.scss';

interface CostEstimationProps {
  type: 'roks' | 'vsi';
  roksSizing?: ROKSSizingInput;
  vsiSizing?: VSISizingInput;
  title?: string;
  showPricingRefresh?: boolean;
}

export function CostEstimation({ type, roksSizing, vsiSizing, title, showPricingRefresh = true }: CostEstimationProps) {
  const [region, setRegion] = useState<RegionCode>('us-south');
  const [discountType, setDiscountType] = useState<DiscountType>('onDemand');
  const showDetails = true; // Always show details

  // Dynamic pricing hook
  const {
    pricing,
    isRefreshing,
    lastUpdated,
    source,
    refreshPricing,
    isApiAvailable,
    error: pricingError,
  } = useDynamicPricing();

  const regions = getRegions(pricing);
  const discountOptions = getDiscountOptions(pricing);

  const estimate = useMemo<CostEstimate | null>(() => {
    if (type === 'roks' && roksSizing) {
      return calculateROKSCost(roksSizing, region, discountType, pricing);
    } else if (type === 'vsi' && vsiSizing) {
      return calculateVSICost(vsiSizing, region, discountType, pricing);
    }
    return null;
  }, [type, roksSizing, vsiSizing, region, discountType, pricing]);

  if (!estimate) {
    return (
      <Tile className="cost-estimation cost-estimation--empty">
        <div className="cost-estimation__empty-state">
          <Calculator size={48} />
          <p>Configure sizing parameters to see cost estimates</p>
        </div>
      </Tile>
    );
  }

  const tableHeaders = [
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'quantity', header: 'Qty' },
    { key: 'unitCost', header: 'Unit Cost' },
    { key: 'monthlyCost', header: 'Monthly' },
    { key: 'annualCost', header: 'Annual' },
  ];

  const tableRows = estimate.lineItems.map((item, idx) => ({
    id: `item-${idx}`,
    category: item.category,
    description: item.description,
    quantity: `${item.quantity.toLocaleString()} ${item.unit}`,
    unitCost: formatCurrency(item.unitCost),
    monthlyCost: formatCurrency(item.monthlyCost),
    annualCost: formatCurrency(item.annualCost),
    notes: item.notes,
  }));

  const handleExport = (format: 'text' | 'json' | 'csv') => {
    downloadBOM(estimate, format);
  };

  return (
    <div className="cost-estimation">
      <Tile className="cost-estimation__header">
        <div className="cost-estimation__title-row">
          <h3>{title || 'Cost Estimation'}</h3>
          <div className="cost-estimation__actions">
            {showPricingRefresh && (
              <PricingRefresh
                lastUpdated={lastUpdated}
                source={source}
                isRefreshing={isRefreshing}
                onRefresh={refreshPricing}
                isApiAvailable={isApiAvailable}
                error={pricingError}
                compact
              />
            )}
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Download}
              onClick={() => handleExport('csv')}
            >
              Export CSV
            </Button>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Download}
              onClick={() => handleExport('text')}
            >
              Export BOM
            </Button>
          </div>
        </div>

        <div className="cost-estimation__controls">
          <Select
            id="region-select"
            labelText="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionCode)}
          >
            {regions.map((r) => (
              <SelectItem
                key={r.code}
                value={r.code}
                text={`${r.name}${r.multiplier !== 1 ? ` (+${((r.multiplier - 1) * 100).toFixed(0)}%)` : ''}`}
              />
            ))}
          </Select>

          <Select
            id="discount-select"
            labelText="Pricing"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
          >
            {discountOptions.map((d) => (
              <SelectItem
                key={d.id}
                value={d.id}
                text={`${d.name}${d.discountPct > 0 ? ` (-${d.discountPct}%)` : ''}`}
              />
            ))}
          </Select>
        </div>
      </Tile>

      {/* Cost Summary */}
      <div className="cost-estimation__summary">
        <MetricCard
          label="Monthly Cost"
          value={formatCurrency(estimate.totalMonthly)}
          detail={estimate.discountPct > 0 ? `${estimate.discountPct}% discount applied` : undefined}
          variant="primary"
        />
        <MetricCard
          label="Annual Cost"
          value={formatCurrency(estimate.totalAnnual)}
          variant="info"
        />
        {estimate.discountPct > 0 && (
          <MetricCard
            label="Annual Savings"
            value={formatCurrency(estimate.discountAmountAnnual)}
            variant="success"
          />
        )}
      </div>

      {/* Line Items Table */}
      {showDetails && (
        <Tile className="cost-estimation__details">
          <DataTable rows={tableRows} headers={tableHeaders} size="md">
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {/* Subtotal row */}
                  <TableRow className="cost-estimation__subtotal-row">
                    <TableCell colSpan={4}><strong>Subtotal</strong></TableCell>
                    <TableCell><strong>{formatCurrency(estimate.subtotalMonthly)}</strong></TableCell>
                    <TableCell><strong>{formatCurrency(estimate.subtotalAnnual)}</strong></TableCell>
                  </TableRow>
                  {/* Discount row */}
                  {estimate.discountPct > 0 && (
                    <TableRow className="cost-estimation__discount-row">
                      <TableCell colSpan={4}>
                        <em>Discount ({estimate.discountPct}%)</em>
                      </TableCell>
                      <TableCell><em>-{formatCurrency(estimate.discountAmountMonthly)}</em></TableCell>
                      <TableCell><em>-{formatCurrency(estimate.discountAmountAnnual)}</em></TableCell>
                    </TableRow>
                  )}
                  {/* Total row */}
                  <TableRow className="cost-estimation__total-row">
                    <TableCell colSpan={4}><strong>Total</strong></TableCell>
                    <TableCell><strong>{formatCurrency(estimate.totalMonthly)}</strong></TableCell>
                    <TableCell><strong>{formatCurrency(estimate.totalAnnual)}</strong></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </DataTable>
        </Tile>
      )}

      {/* Notes */}
      <InlineNotification
        kind="info"
        title="Pricing Notes"
        subtitle={estimate.metadata.notes.join(' • ')}
        lowContrast
        hideCloseButton
        className="cost-estimation__notes"
      />

      <div className="cost-estimation__metadata">
        <span>Architecture: {estimate.architecture}</span>
        <span>Region: {estimate.regionName}</span>
        <span>Pricing Version: {estimate.metadata.pricingVersion}</span>
      </div>
    </div>
  );
}
