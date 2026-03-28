# Cost Comparison Tab — Design Spec

## Context

The Migration Review page (`/migration-comparison`) currently has 4 tabs: Platform Selection, VM Assignments, Migration Planning, and Risk Assessment. Users can see individual costs on the ROKS and VSI migration pages, and the source BOM on the Discovery page, but there's no single view comparing source infrastructure costs against all target options.

This feature adds a **Cost Comparison** tab that shows the source VMware BOM alongside all ROKS/ROVe architecture variants and VPC VSI costs, enabling side-by-side TCO comparison for migration decision-making.

## Design Decisions

- **Location:** 5th tab on existing Migration Review page (not a new route)
- **Detail level:** Category-level rows (Compute, Storage, Networking, Licensing) with expandable line-item detail
- **Target scope:** All 6 ROKS architectures × 2 variants (ROKS + ROVe) + VPC VSI = 13 target columns
- **Table layout:** Horizontal scroll with sticky Source BOM column
- **Region/discount:** Inherited from existing context (target MZR from Discovery, discount from cost settings)

## Data Flow

All three cost sources return the same `CostEstimate` interface (`lineItems[]`, `totalMonthly`, `totalAnnual`):

1. **Source BOM** — `useSourceBOM(rawData, region, pricing)` → `SourceBOMResult.estimate`
2. **ROKS/ROVe** — Build `ROKSSizingInput` from filtered VM list, call `calculateROKSCost(input, region, discount, pricing, variant)` for each of 6 solution types × 2 variants (full/rov)
3. **VPC VSI** — Build `VSISizingInput` from VM list + profile selection, call `calculateVSICost(input, region, discount, pricing)`

Region from `useTargetLocation()`, discount from `useCostSettings()`, pricing from `useDynamicPricing()`.

## UI Layout

### Summary Tiles (MetricCard row)
- Source Monthly Cost (baseline)
- Cheapest ROKS Monthly (with architecture name label)
- Cheapest ROVe Monthly (with architecture name label)
- VSI Monthly Cost
- Best Savings % (green highlight, relative to source)

### Comparison Table
- **Sticky columns:** Category + Source BOM
- **Scrollable columns:** 6 ROKS variants, 6 ROVe variants, 1 VPC VSI
- **Rows by category:** Compute, Storage, Networking, Licensing
- **Expandable rows:** Click category to show individual `CostLineItem` entries
- **Delta display:** Each target cell shows cost + delta tag (green for savings, red for increase) relative to source
- **Footer rows:** Total Monthly, Total Annual (bold)

### Notes Section
- Selected region and discount type
- Pricing version / timestamp
- Source BOM matching warnings (if any)

## Files

### New Files
| File | Purpose |
|------|---------|
| `src/hooks/useCostComparison.ts` | Orchestrates source BOM + all ROKS/ROVe + VSI estimate computation |
| `src/components/comparison/CostComparisonPanel.tsx` | Single component: summary tiles + comparison table + notes |

### Modified Files
| File | Change |
|------|--------|
| `src/pages/MigrationComparisonPage.tsx` | Add 5th "Cost Comparison" tab, import CostComparisonPanel |

## Hook: `useCostComparison`

### Inputs
- `rawData: RVToolsData | null` — from DataContext
- `vms: VInfo[]` — filtered (non-excluded) VM list (already computed on the page)
- `pricing: IBMCloudPricing | null` — from `useDynamicPricing()`
- `region: RegionCode` — from `useTargetLocation()`
- `discountType: DiscountType` — from `useCostSettings()`

### Returns
```typescript
interface CostComparisonResult {
  sourceBOM: CostEstimate | null;
  roksEstimates: Array<{
    solutionType: RoksSolutionType;
    label: string;
    variant: 'full' | 'rov';
    estimate: CostEstimate;
  }>;
  vsiEstimate: CostEstimate | null;
  cheapestRoks: { solutionType: string; label: string; totalMonthly: number } | null;
  cheapestRov: { solutionType: string; label: string; totalMonthly: number } | null;
  bestSavingsPct: number | null;  // relative to source
  region: string;
  discountType: string;
}
```

### Key Logic
1. Compute source BOM via `useSourceBOM(rawData, region, pricing)`
2. Build ROKS sizing input from VM totals (vCPUs, memory, storage + ODF overhead) — same approach as `SolutionComparisonPanel`
3. Loop 6 solution types × 2 variants → `calculateROKSCost()` each
4. Build VSI sizing: reuse `mapVMToVSIProfile()` from `src/services/migration/` to map each VM to a VSI profile, then aggregate into `VSISizingInput.vmProfiles` (same pattern as `useVSIPageData.ts` lines 230-283). Compute per-tier storage from vDisk data + workload classification.
5. Compute cheapest ROKS/ROVe and best savings percentage
6. All wrapped in `useMemo` keyed on inputs

### Key Reused Functions
| Function | Source | Purpose |
|----------|--------|---------|
| `useSourceBOM()` | `src/hooks/useSourceBOM.ts` | Source BOM estimate |
| `calculateROKSCost()` | `src/services/costEstimation.ts` | ROKS/ROVe estimates |
| `calculateVSICost()` | `src/services/costEstimation.ts` | VSI estimate |
| `mapVMToVSIProfile()` | `src/services/migration/` | VM → VSI profile mapping |
| `getVMWorkloadCategory()` | `src/utils/workloadClassification.ts` | Storage tier classification |
| `getRegionalPricing()` | `src/services/pricing/regionalPricingResolver.ts` | Regional pricing lookup |

## Component: `CostComparisonPanel`

### Props
```typescript
interface CostComparisonPanelProps {
  comparison: CostComparisonResult;
}
```

### Category Aggregation
Group `CostEstimate.lineItems` by category field. Categories: Compute, Storage, Networking, Licensing, ODF (ROKS-specific), ACM (ROKS-specific). Source BOM categories: Compute, Storage, Licensing.

For categories that don't exist in the source (e.g., Networking, ODF), show "N/A" or "$0" in the Source column.

### Expandable Rows
Use Carbon `Accordion` or a simple toggle to show/hide line items within each category. Each line item shows: description, quantity × unit, unit cost, monthly cost.

### Delta Tags
- Green `Tag` for savings (e.g., "-15%")
- Red `Tag` for cost increase (e.g., "+8%")
- No tag when source has $0 for that category (delta is meaningless)

## Testing

### Unit Tests
- `useCostComparison.test.ts` — mock pricing data, verify all estimates computed, cheapest selection logic, savings calculation
- `CostComparisonPanel.test.tsx` — render with mock comparison data, verify tiles, table rows, expandable behavior, delta tags

### Manual Verification
1. Upload RVTools file with hosts + datastores (source BOM needs vHost data)
2. Navigate to Migration Review → Cost Comparison tab
3. Verify source BOM matches Discovery → Source BOM tab totals
4. Verify ROKS costs match ROKS Migration → Solution Comparison panel
5. Verify VSI costs match VSI Migration page totals
6. Toggle region on Discovery → Infrastructure tab, confirm costs update
7. Check horizontal scroll behavior with all 13 target columns
8. Expand a category row, verify line items shown

## Not In Scope
- Export of comparison table (can be added later to DOCX/XLSX/PPTX exports)
- What-if region/discount selectors on this tab (inherits from context)
- Chart visualization of the comparison (table-first approach)
