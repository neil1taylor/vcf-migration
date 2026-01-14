// Unit tests for BOM generator
import { describe, it, expect } from 'vitest';
import {
  generateBOMText,
  generateBOMJSON,
  generateBOMCSV,
  generateComparisonText,
} from './bomGenerator';
import type { CostEstimate } from '../costEstimation';

// Mock cost estimate for testing
const mockEstimate: CostEstimate = {
  architecture: 'VPC Virtual Server Instances',
  region: 'us-south',
  regionName: 'Dallas',
  discountType: 'onDemand',
  discountPct: 0,
  lineItems: [
    {
      category: 'Compute - VSI',
      description: 'VSI - bx2-4x16',
      quantity: 5,
      unit: 'instances',
      unitCost: 150.00,
      monthlyCost: 750.00,
      annualCost: 9000.00,
      notes: 'Balanced profile 4 vCPUs, 16GB RAM',
    },
    {
      category: 'Storage - Block',
      description: 'Block Storage - 10iops-tier',
      quantity: 1024,
      unit: 'GB',
      unitCost: 0.13,
      monthlyCost: 133.12,
      annualCost: 1597.44,
      notes: '10 IOPS/GB tier',
    },
    {
      category: 'Networking',
      description: 'Application Load Balancer',
      quantity: 1,
      unit: 'LB',
      unitCost: 35.00,
      monthlyCost: 35.00,
      annualCost: 420.00,
    },
  ],
  subtotalMonthly: 918.12,
  subtotalAnnual: 11017.44,
  discountAmountMonthly: 0,
  discountAmountAnnual: 0,
  totalMonthly: 918.12,
  totalAnnual: 11017.44,
  metadata: {
    pricingVersion: '2025-01-14',
    generatedAt: '2025-01-14T12:00:00.000Z',
    notes: ['Estimated pricing', 'On-demand pricing'],
  },
};

const mockEstimateWithDiscount: CostEstimate = {
  ...mockEstimate,
  discountType: 'reserved1yr',
  discountPct: 20,
  discountAmountMonthly: 183.62,
  discountAmountAnnual: 2203.49,
  totalMonthly: 734.50,
  totalAnnual: 8813.95,
};

describe('BOM Generator', () => {
  describe('generateBOMText', () => {
    it('should generate formatted BOM text', () => {
      const result = generateBOMText(mockEstimate, 'Test Migration');

      expect(result).toContain('IBM CLOUD - BILL OF MATERIALS');
      expect(result).toContain('Test Migration');
      expect(result).toContain('Architecture:');
      expect(result).toContain('VPC Virtual Server Instances');
    });

    it('should include region information', () => {
      const result = generateBOMText(mockEstimate);

      expect(result).toContain('Region:');
      expect(result).toContain('Dallas');
      expect(result).toContain('us-south');
    });

    it('should include all line items', () => {
      const result = generateBOMText(mockEstimate);

      expect(result).toContain('Compute - VSI');
      expect(result).toContain('VSI - bx2-4x16');
      expect(result).toContain('Storage - Block');
      expect(result).toContain('Application Load Balancer');
    });

    it('should include totals', () => {
      const result = generateBOMText(mockEstimate);

      expect(result).toContain('SUBTOTAL');
      expect(result).toContain('TOTAL');
    });

    it('should show discount when applicable', () => {
      const result = generateBOMText(mockEstimateWithDiscount);

      expect(result).toContain('Discount');
      expect(result).toContain('20%');
    });

    it('should include notes for line items', () => {
      const result = generateBOMText(mockEstimate);

      expect(result).toContain('Balanced profile');
      expect(result).toContain('10 IOPS/GB tier');
    });

    it('should use default title when not provided', () => {
      const result = generateBOMText(mockEstimate);

      expect(result).toContain('IBM Cloud Migration');
    });
  });

  describe('generateBOMJSON', () => {
    it('should generate valid JSON', () => {
      const result = generateBOMJSON(mockEstimate, 'Test Project');
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('title', 'Test Project');
      expect(parsed).toHaveProperty('architecture');
      expect(parsed).toHaveProperty('region');
    });

    it('should include all estimate data', () => {
      const result = generateBOMJSON(mockEstimate);
      const parsed = JSON.parse(result);

      expect(parsed.architecture).toBe('VPC Virtual Server Instances');
      expect(parsed.region).toBe('us-south');
      expect(parsed.lineItems).toHaveLength(3);
    });

    it('should preserve numeric precision', () => {
      const result = generateBOMJSON(mockEstimate);
      const parsed = JSON.parse(result);

      expect(parsed.lineItems[1].unitCost).toBe(0.13);
      expect(parsed.subtotalMonthly).toBe(918.12);
    });
  });

  describe('generateBOMCSV', () => {
    it('should generate valid CSV with headers', () => {
      const result = generateBOMCSV(mockEstimate);
      const lines = result.split('\n');

      expect(lines[0]).toContain('Category');
      expect(lines[0]).toContain('Description');
      expect(lines[0]).toContain('Quantity');
      expect(lines[0]).toContain('Unit Cost');
    });

    it('should include all line items as rows', () => {
      const result = generateBOMCSV(mockEstimate);
      const lines = result.split('\n').filter(l => l.trim());

      // Header + 3 line items
      expect(lines.length).toBeGreaterThanOrEqual(4);
    });

    it('should properly quote fields with commas', () => {
      const estimateWithComma: CostEstimate = {
        ...mockEstimate,
        lineItems: [{
          category: 'Compute, Storage',
          description: 'Profile A, B',
          quantity: 1,
          unit: 'item',
          unitCost: 100,
          monthlyCost: 100,
          annualCost: 1200,
        }],
      };

      const result = generateBOMCSV(estimateWithComma);

      // Fields with commas should be quoted
      expect(result).toContain('"Compute, Storage"');
    });

    it('should include totals row', () => {
      const result = generateBOMCSV(mockEstimate);

      // CSV uses TOTAL in quotes
      expect(result).toContain('TOTAL');
    });
  });

  describe('generateComparisonText', () => {
    const mockROKSEstimate: CostEstimate = {
      ...mockEstimate,
      architecture: 'Hybrid (Bare Metal + VSI Storage)',
      totalMonthly: 15000,
      totalAnnual: 180000,
    };

    it('should generate comparison between two architectures', () => {
      const result = generateComparisonText(mockEstimate, mockROKSEstimate);

      // Uses Option A and Option B instead of architecture names
      expect(result).toContain('Option A');
      expect(result).toContain('Option B');
    });

    it('should show monthly cost difference', () => {
      const result = generateComparisonText(mockEstimate, mockROKSEstimate);

      expect(result).toContain('Monthly');
    });

    it('should show annual cost difference', () => {
      const result = generateComparisonText(mockEstimate, mockROKSEstimate);

      expect(result).toContain('Annual');
    });

    it('should indicate which option is cheaper', () => {
      const result = generateComparisonText(mockEstimate, mockROKSEstimate);

      // The comparison should show recommendation about which is cheaper
      expect(result.toLowerCase()).toContain('cheaper');
    });
  });
});
