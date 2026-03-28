import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CostComparisonPanel } from './CostComparisonPanel';
import type { CostComparisonResult } from '@/hooks/useCostComparison';
import type { CostEstimate, CostLineItem } from '@/services/costEstimation';

function makeEstimate(totalMonthly: number, lineItems: CostLineItem[]): CostEstimate {
  return {
    architecture: 'test',
    region: 'us-south',
    regionName: 'Dallas',
    discountType: 'On-Demand',
    discountPct: 0,
    lineItems,
    subtotalMonthly: totalMonthly,
    subtotalAnnual: totalMonthly * 12,
    discountAmountMonthly: 0,
    discountAmountAnnual: 0,
    totalMonthly,
    totalAnnual: totalMonthly * 12,
    metadata: { pricingVersion: '2026-03-24', generatedAt: '2026-03-28T00:00:00Z', notes: [] },
  };
}

const sourceLineItems: CostLineItem[] = [
  { category: 'Compute', description: 'BM Servers', quantity: 3, unit: 'servers', unitCost: 5000, monthlyCost: 15000, annualCost: 180000 },
  { category: 'Storage', description: 'Block Storage', quantity: 1000, unit: 'GB', unitCost: 0.13, monthlyCost: 130, annualCost: 1560 },
  { category: 'Licensing', description: 'VCF License', quantity: 96, unit: 'cores', unitCost: 192.5, monthlyCost: 18480, annualCost: 221760 },
];

const roksLineItems: CostLineItem[] = [
  { category: 'Compute', description: 'Worker Nodes', quantity: 3, unit: 'nodes', unitCost: 5000, monthlyCost: 15000, annualCost: 180000 },
  { category: 'Storage', description: 'NVMe Storage', quantity: 1, unit: 'included', unitCost: 0, monthlyCost: 0, annualCost: 0 },
  { category: 'Licensing', description: 'OCP License', quantity: 96, unit: 'vCPUs', unitCost: 8.76, monthlyCost: 840.96, annualCost: 10091.52 },
];

const vsiLineItems: CostLineItem[] = [
  { category: 'Compute', description: 'VSI Instances', quantity: 10, unit: 'instances', unitCost: 700, monthlyCost: 7000, annualCost: 84000 },
  { category: 'Storage', description: 'Block Volumes', quantity: 500, unit: 'GB', unitCost: 0.1, monthlyCost: 50, annualCost: 600 },
];

const mockComparison: CostComparisonResult = {
  sourceBOM: makeEstimate(33610, sourceLineItems),
  roksEstimates: [
    {
      solutionType: 'nvme-converged',
      label: 'NVMe Converged',
      variant: 'full',
      estimate: makeEstimate(15841, roksLineItems),
      isFuture: false,
    },
    {
      solutionType: 'nvme-converged',
      label: 'NVMe Converged',
      variant: 'rov',
      estimate: makeEstimate(14000, roksLineItems),
      isFuture: false,
    },
  ],
  vsiEstimate: makeEstimate(7050, vsiLineItems),
  cheapestRoks: { solutionType: 'nvme-converged', label: 'NVMe Converged', totalMonthly: 15841 },
  cheapestRov: { solutionType: 'nvme-converged', label: 'NVMe Converged', totalMonthly: 14000 },
  bestSavingsPct: 79.0,
  region: 'us-south',
  regionName: 'Dallas',
  discountType: 'onDemand',
  pricingVersion: '2026-03-24',
  sourceWarnings: ['Host exceeds available profiles'],
};

describe('CostComparisonPanel', () => {
  it('renders summary tiles', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    expect(screen.getByText('Source Monthly')).toBeInTheDocument();
    expect(screen.getByText('Cheapest ROKS')).toBeInTheDocument();
    expect(screen.getByText('Cheapest ROVe')).toBeInTheDocument();
    expect(screen.getAllByText('VPC VSI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Best Savings')).toBeInTheDocument();
  });

  it('renders comparison table with category rows', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    expect(screen.getByText('Compute')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Licensing')).toBeInTheDocument();
  });

  it('renders Total Monthly and Total Annual rows', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    expect(screen.getByText('Total Monthly')).toBeInTheDocument();
    expect(screen.getByText('Total Annual')).toBeInTheDocument();
  });

  it('renders column headers for each target', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    // NVMe Converged appears in tiles + table headers
    expect(screen.getAllByText('NVMe Converged').length).toBeGreaterThanOrEqual(1);
    // VPC VSI appears in tile + table header
    expect(screen.getAllByText('VPC VSI').length).toBeGreaterThanOrEqual(1);
  });

  it('renders source BOM column', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    expect(screen.getByText('Source BOM')).toBeInTheDocument();
  });

  it('expands category to show line items when clicked', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    // Line items should not be visible initially
    expect(screen.queryByText('BM Servers')).not.toBeInTheDocument();

    // Click Compute category row
    fireEvent.click(screen.getByText('Compute'));

    // Now line items should be visible
    expect(screen.getByText('BM Servers')).toBeInTheDocument();
    expect(screen.getByText('Worker Nodes')).toBeInTheDocument();
    expect(screen.getByText('VSI Instances')).toBeInTheDocument();
  });

  it('renders pricing version in notes', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    expect(screen.getByText(/2026-03-24/)).toBeInTheDocument();
  });

  it('renders source warnings', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    expect(screen.getByText('Host exceeds available profiles')).toBeInTheDocument();
  });

  it('handles null source BOM gracefully', () => {
    const noSource: CostComparisonResult = {
      ...mockComparison,
      sourceBOM: null,
      cheapestRoks: null,
      cheapestRov: null,
      bestSavingsPct: null,
      sourceWarnings: [],
    };

    render(<CostComparisonPanel comparison={noSource} />);

    // Should show N/A for source
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders delta tags', () => {
    render(<CostComparisonPanel comparison={mockComparison} />);

    // Total monthly row should have delta tags (green for savings)
    // Source is $33,610, targets are all less → negative delta → green tags
    const greenTags = document.querySelectorAll('.cds--tag--green');
    expect(greenTags.length).toBeGreaterThan(0);
  });
});
