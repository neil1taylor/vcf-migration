# Per-Region Pricing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded regional multipliers with actual per-region list prices fetched unauthenticated from the IBM Cloud Global Catalog API.

**Architecture:** Add a `regionalPricing` overlay to `IBMCloudPricing` keyed by region, each containing actual rates for VSI, bare metal, block storage, networking, and ROKS/OVE licensing. A new `getRegionalPricing()` resolver replaces all `* multiplier` expressions with direct lookups, falling back to base fields for backward compat.

**Tech Stack:** TypeScript, React, Vitest, Node.js (pricing proxy), IBM Cloud Global Catalog REST API

**Spec:** `docs/superpowers/specs/2026-03-13-per-region-pricing-design.md`

---

## Chunk 1: Types, Resolver, and Tests

### Task 1: Add `RegionalPricingData` type and update `RegionPricing`

**Files:**
- Modify: `src/services/pricing/pricingCache.ts:62-67` (RegionPricing) and `75-121` (IBMCloudPricing)

- [ ] **Step 1: Add `RegionalPricingData` interface**

In `src/services/pricing/pricingCache.ts`, add after `RegionPricing` (after line 67):

```typescript
export interface RegionalPricingData {
  vsi: Record<string, { hourlyRate: number; monthlyRate: number }>;
  bareMetal: Record<string, { hourlyRate: number; monthlyRate: number }>;
  blockStorage: Record<string, {
    costPerGBMonth: number;
    iopsPerGB?: number;
    costPerIOPSMonth?: number;
  }>;
  networking: {
    loadBalancer: { perLBMonthly: number; perGBProcessed: number };
    vpnGateway: { perGatewayMonthly: number; perConnectionMonthly: number };
    publicGateway: { perGatewayMonthly: number };
    transitGateway: {
      perGatewayMonthly: number;
      localConnectionMonthly: number;
      globalConnectionMonthly: number;
      perGBLocal: number;
      perGBGlobal: number;
    };
    floatingIP: { perIPMonthly: number };
  };
  roks: {
    ocpLicense: { perVCPUHourly: number; perVCPUMonthly: number };
    odf: {
      advanced: { bareMetalPerNodeMonthly: number; vsiPerVCPUHourly: number };
      essentials: { bareMetalPerNodeMonthly: number; vsiPerVCPUHourly: number };
    };
    clusterManagement: { perClusterMonthly: number };
    acm?: { perVCPUHourly: number; perVCPUMonthly: number };
    workerRates?: {
      bareMetal?: Record<string, { hourlyRate: number; monthlyRate: number }>;
      vsi?: Record<string, { hourlyRate: number; monthlyRate: number }>;
    };
  };
  ove?: {
    ocpLicense: { perVCPUHourly: number; perVCPUMonthly: number };
    odf: {
      advanced: { bareMetalPerNodeMonthly: number; vsiPerVCPUHourly: number };
      essentials: { bareMetalPerNodeMonthly: number; vsiPerVCPUHourly: number };
    };
    clusterManagement: { perClusterMonthly: number };
    acm?: { perVCPUHourly: number; perVCPUMonthly: number };
    workerRates?: {
      bareMetal?: Record<string, { hourlyRate: number; monthlyRate: number }>;
      vsi?: Record<string, { hourlyRate: number; monthlyRate: number }>;
    };
  };
}
```

- [ ] **Step 2: Make `multiplier` optional on `RegionPricing`**

Change line 65 from `multiplier: number;` to `multiplier?: number;`

- [ ] **Step 3: Add `regionalPricing` to `IBMCloudPricing`**

Add to the `IBMCloudPricing` interface (after the `regions` field, around line 113):

```typescript
  regionalPricing?: Record<string, RegionalPricingData>;
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No new errors (existing code still compiles since `multiplier` is now optional and `regionalPricing` is optional)

- [ ] **Step 5: Commit**

```bash
git add src/services/pricing/pricingCache.ts
git commit -m "feat: add RegionalPricingData type and make multiplier optional"
```

---

### Task 2: Create `regionalPricingResolver.ts` with tests

**Files:**
- Create: `src/services/pricing/regionalPricingResolver.ts`
- Create: `src/services/pricing/regionalPricingResolver.test.ts`

- [ ] **Step 1: Write failing tests for the resolver**

Create `src/services/pricing/regionalPricingResolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getRegionalPricing, buildFallbackFromBase } from './regionalPricingResolver';
import type { IBMCloudPricing, RegionalPricingData } from './pricingCache';
import { getStaticPricing } from './pricingCache';

// Minimal regional pricing fixture for tests
const mockRegionalPricing: Record<string, RegionalPricingData> = {
  'us-south': {
    vsi: { 'bx2-2x8': { hourlyRate: 0.1036, monthlyRate: 75.60 } },
    bareMetal: { 'bx2d-metal-96x384': { hourlyRate: 3.90, monthlyRate: 2847.00 } },
    blockStorage: { 'generalPurpose': { costPerGBMonth: 0.10 } },
    networking: {
      loadBalancer: { perLBMonthly: 21.60, perGBProcessed: 0.008 },
      vpnGateway: { perGatewayMonthly: 99, perConnectionMonthly: 0.04 },
      publicGateway: { perGatewayMonthly: 5 },
      transitGateway: { perGatewayMonthly: 0, localConnectionMonthly: 50, globalConnectionMonthly: 100, perGBLocal: 0.02, perGBGlobal: 0.04 },
      floatingIP: { perIPMonthly: 5 },
    },
    roks: {
      ocpLicense: { perVCPUHourly: 0.04275, perVCPUMonthly: 31.21 },
      odf: {
        advanced: { bareMetalPerNodeMonthly: 681.818, vsiPerVCPUHourly: 0.00725 },
        essentials: { bareMetalPerNodeMonthly: 545.455, vsiPerVCPUHourly: 0.00575 },
      },
      clusterManagement: { perClusterMonthly: 0 },
    },
  },
  'eu-gb': {
    vsi: { 'bx2-2x8': { hourlyRate: 0.1100, monthlyRate: 80.30 } },
    bareMetal: { 'bx2d-metal-96x384': { hourlyRate: 4.10, monthlyRate: 2993.00 } },
    blockStorage: { 'generalPurpose': { costPerGBMonth: 0.11 } },
    networking: {
      loadBalancer: { perLBMonthly: 23.00, perGBProcessed: 0.009 },
      vpnGateway: { perGatewayMonthly: 105, perConnectionMonthly: 0.04 },
      publicGateway: { perGatewayMonthly: 5.50 },
      transitGateway: { perGatewayMonthly: 0, localConnectionMonthly: 53, globalConnectionMonthly: 106, perGBLocal: 0.02, perGBGlobal: 0.04 },
      floatingIP: { perIPMonthly: 5.50 },
    },
    roks: {
      ocpLicense: { perVCPUHourly: 0.04500, perVCPUMonthly: 32.85 },
      odf: {
        advanced: { bareMetalPerNodeMonthly: 720.00, vsiPerVCPUHourly: 0.00765 },
        essentials: { bareMetalPerNodeMonthly: 576.00, vsiPerVCPUHourly: 0.00605 },
      },
      clusterManagement: { perClusterMonthly: 0 },
    },
  },
};

describe('regionalPricingResolver', () => {
  describe('getRegionalPricing', () => {
    it('should return exact region match when available', () => {
      const pricing = { regionalPricing: mockRegionalPricing } as IBMCloudPricing;
      const result = getRegionalPricing(pricing, 'eu-gb');
      expect(result.vsi['bx2-2x8'].monthlyRate).toBe(80.30);
    });

    it('should fall back to us-south when region not found', () => {
      const pricing = { regionalPricing: mockRegionalPricing } as IBMCloudPricing;
      const result = getRegionalPricing(pricing, 'ap-north');
      expect(result.vsi['bx2-2x8'].monthlyRate).toBe(75.60);
    });

    it('should fall back to base fields when regionalPricing is absent', () => {
      const staticPricing = getStaticPricing();
      delete (staticPricing as Record<string, unknown>).regionalPricing;
      const result = getRegionalPricing(staticPricing, 'us-south');
      expect(result.vsi).toBeDefined();
      expect(Object.keys(result.vsi).length).toBeGreaterThan(0);
      const profileName = Object.keys(staticPricing.vsi)[0];
      expect(result.vsi[profileName].monthlyRate).toBe(staticPricing.vsi[profileName].monthlyRate);
    });
  });

  describe('buildFallbackFromBase', () => {
    it('should map vsi profiles to regional format', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      const profileName = Object.keys(staticPricing.vsi)[0];
      expect(result.vsi[profileName].hourlyRate).toBe(staticPricing.vsi[profileName].hourlyRate);
      expect(result.vsi[profileName].monthlyRate).toBe(staticPricing.vsi[profileName].monthlyRate);
    });

    it('should map bareMetal profiles to regional format', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      const profileName = Object.keys(staticPricing.bareMetal)[0];
      expect(result.bareMetal[profileName].monthlyRate).toBe(staticPricing.bareMetal[profileName].monthlyRate);
    });

    it('should map blockStorage tiers', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      expect(result.blockStorage).toBeDefined();
      expect(Object.keys(result.blockStorage).length).toBeGreaterThan(0);
    });

    it('should copy networking rates', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      expect(result.networking.loadBalancer.perLBMonthly).toBe(staticPricing.networking.loadBalancer.perLBMonthly);
    });

    it('should copy roks rates', () => {
      const staticPricing = getStaticPricing();
      const result = buildFallbackFromBase(staticPricing);
      expect(result.roks.ocpLicense.perVCPUHourly).toBe(staticPricing.roks.ocpLicense.perVCPUHourly);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/pricing/regionalPricingResolver.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the resolver**

Create `src/services/pricing/regionalPricingResolver.ts`:

```typescript
import type { IBMCloudPricing, RegionalPricingData } from './pricingCache';

/**
 * Get regional pricing data for a given region.
 *
 * Fallback chain:
 * 1. Exact region match in regionalPricing
 * 2. us-south entry in regionalPricing
 * 3. Build from base IBMCloudPricing fields (backward compat)
 */
export function getRegionalPricing(
  pricing: IBMCloudPricing,
  region: string,
): RegionalPricingData {
  return pricing.regionalPricing?.[region]
    ?? pricing.regionalPricing?.['us-south']
    ?? buildFallbackFromBase(pricing);
}

/**
 * Build a RegionalPricingData from the top-level IBMCloudPricing fields.
 * Used when regionalPricing is absent (old config / old proxy data).
 */
export function buildFallbackFromBase(pricing: IBMCloudPricing): RegionalPricingData {
  const vsi: RegionalPricingData['vsi'] = {};
  for (const [name, profile] of Object.entries(pricing.vsi)) {
    vsi[name] = { hourlyRate: profile.hourlyRate, monthlyRate: profile.monthlyRate };
  }

  const bareMetal: RegionalPricingData['bareMetal'] = {};
  for (const [name, profile] of Object.entries(pricing.bareMetal)) {
    bareMetal[name] = { hourlyRate: profile.hourlyRate, monthlyRate: profile.monthlyRate };
  }

  const blockStorage: RegionalPricingData['blockStorage'] = {};
  for (const [tier, data] of Object.entries(pricing.blockStorage)) {
    blockStorage[tier] = {
      costPerGBMonth: data.costPerGBMonth ?? 0,
      iopsPerGB: data.iopsPerGB,
      costPerIOPSMonth: data.costPerIOPSMonth,
    };
  }

  const networking: RegionalPricingData['networking'] = {
    loadBalancer: {
      perLBMonthly: pricing.networking.loadBalancer.perLBMonthly,
      perGBProcessed: pricing.networking.loadBalancer.perGBProcessed,
    },
    vpnGateway: {
      perGatewayMonthly: pricing.networking.vpnGateway.perGatewayMonthly,
      perConnectionMonthly: pricing.networking.vpnGateway.perConnectionMonthly,
    },
    publicGateway: {
      perGatewayMonthly: pricing.networking.publicGateway.perGatewayMonthly,
    },
    transitGateway: {
      perGatewayMonthly: pricing.networking.transitGateway.perGatewayMonthly,
      localConnectionMonthly: pricing.networking.transitGateway.localConnectionMonthly,
      globalConnectionMonthly: pricing.networking.transitGateway.globalConnectionMonthly,
      perGBLocal: pricing.networking.transitGateway.perGBLocal,
      perGBGlobal: pricing.networking.transitGateway.perGBGlobal,
    },
    floatingIP: {
      perIPMonthly: pricing.networking.floatingIP.perIPMonthly,
    },
  };

  const roks: RegionalPricingData['roks'] = {
    ocpLicense: { ...pricing.roks.ocpLicense },
    odf: {
      advanced: { ...pricing.roks.odf.advanced },
      essentials: { ...pricing.roks.odf.essentials },
    },
    clusterManagement: { ...pricing.roks.clusterManagement },
    acm: pricing.roks.acm ? { ...pricing.roks.acm } : undefined,
    workerRates: pricing.roks.workerRates ? {
      bareMetal: pricing.roks.workerRates.bareMetal ? { ...pricing.roks.workerRates.bareMetal } : undefined,
      vsi: pricing.roks.workerRates.vsi ? { ...pricing.roks.workerRates.vsi } : undefined,
    } : undefined,
  };

  const ove: RegionalPricingData['ove'] = pricing.ove ? {
    ocpLicense: { ...pricing.ove.ocpLicense },
    odf: {
      advanced: { ...pricing.ove.odf.advanced },
      essentials: { ...pricing.ove.odf.essentials },
    },
    clusterManagement: { ...pricing.ove.clusterManagement },
    acm: pricing.ove.acm ? { ...pricing.ove.acm } : undefined,
    workerRates: pricing.ove.workerRates ? {
      bareMetal: pricing.ove.workerRates.bareMetal ? { ...pricing.ove.workerRates.bareMetal } : undefined,
      vsi: pricing.ove.workerRates.vsi ? { ...pricing.ove.workerRates.vsi } : undefined,
    } : undefined,
  } : undefined;

  return { vsi, bareMetal, blockStorage, networking, roks, ove };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/pricing/regionalPricingResolver.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/pricing/regionalPricingResolver.ts src/services/pricing/regionalPricingResolver.test.ts
git commit -m "feat: add regional pricing resolver with fallback chain"
```

---

## Chunk 2: Cost Estimation and BOM Generator Migration

### Task 3: Update `calculateROKSCost()` to use regional pricing

**Files:**
- Modify: `src/services/costEstimation.ts:488-700`

- [ ] **Step 1: Run existing tests as baseline**

Run: `npx vitest run src/services/costEstimation.test.ts`
Expected: All tests PASS (baseline)

- [ ] **Step 2: Add import and replace multiplier in `calculateROKSCost()`**

Add import at top of `src/services/costEstimation.ts`:
```typescript
import { getRegionalPricing } from '@/services/pricing/regionalPricingResolver';
```

In `calculateROKSCost()`, replace:
```typescript
const regionData = pricingToUse.regions?.[region] || { name: 'Dallas', multiplier: 1.0, availabilityZones: 3 };
const discountData = pricingToUse.discounts?.[discountType] || { name: 'On-Demand', discountPct: 0, description: 'Pay-as-you-go' };
const multiplier = regionData.multiplier;
```
With:
```typescript
const regionData = pricingToUse.regions?.[region] || { name: 'Dallas', availabilityZones: 3 };
const discountData = pricingToUse.discounts?.[discountType] || { name: 'On-Demand', discountPct: 0, description: 'Pay-as-you-go' };
const regional = getRegionalPricing(pricingToUse, region);
```

Then replace every `* multiplier` in the ROKS function (13 sites at lines 512, 549, 568, 596, 602, 617, 623, 634, 640, 662, 668, 677, 683):

- **Compute (bare metal) line 512:** `(roksComputeRate?.monthlyRate ?? computeProfile.monthlyRate) * multiplier` -> `regional.bareMetal[input.computeProfile]?.monthlyRate ?? roksComputeRate?.monthlyRate ?? computeProfile.monthlyRate`
- **Storage VSI line 549:** `(roksStorageRate?.monthlyRate ?? storageVSI.monthlyRate) * multiplier` -> `regional.vsi[input.storageProfile!]?.monthlyRate ?? roksStorageRate?.monthlyRate ?? storageVSI.monthlyRate`
- **Block storage line 568:** `(storageTierData?.costPerGBMonth || 0.10) * multiplier` -> `regional.blockStorage[tier]?.costPerGBMonth ?? storageTierData?.costPerGBMonth ?? 0.10`
- **OCP license lines 596, 602:** `ocpHourlyRate * 730 * multiplier` -> `(regional.roks.ocpLicense?.perVCPUHourly ?? ocpHourlyRate) * 730`
- **ODF bare metal lines 617, 623:** Use `regional.roks.odf` rates with `??` fallback
- **ODF VSI lines 634, 640:** Use `regional.roks.odf` rates with `??` fallback
- **ACM lines 662, 668:** `acmPerVCPUHourly * 730 * multiplier` -> `(regional.roks.acm?.perVCPUHourly ?? acmPerVCPUHourly) * 730`
- **Networking lines 677, 683:** `lbCostPerMonth * multiplier` -> `regional.networking.loadBalancer?.perLBMonthly ?? lbCostPerMonth`

**Important:** Where the function uses OVE/ROV variant, resolve from `regional.ove` when available.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/services/costEstimation.test.ts`
Expected: Most pass. The "should apply regional multiplier" tests may now fail — these will be updated in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/services/costEstimation.ts
git commit -m "feat: replace multiplier with regional lookups in calculateROKSCost"
```

---

### Task 4: Update `calculateVSICost()` and `getRegions()` to use regional pricing

**Files:**
- Modify: `src/services/costEstimation.ts:726-955` (calculateVSICost) and `362-385` (getRegions)

- [ ] **Step 1: Replace multiplier in `calculateVSICost()`**

Same pattern as Task 3. Replace the multiplier extraction (lines 736-738) with `regional = getRegionalPricing(...)`. Then replace all 9 `* multiplier` sites:

- **VSI compute line 767:** `data.profile.monthlyRate * multiplier` -> `regional.vsi[profileName]?.monthlyRate ?? data.profile.monthlyRate`
- **Boot storage line 785:** `* multiplier` -> use `regional.blockStorage['generalPurpose']?.costPerGBMonth ?? regional.blockStorage['general-purpose']?.costPerGBMonth ?? gpTierData?.costPerGBMonth ?? 0.10` (handle both key conventions)
- **Data storage lines 804, 821:** Same pattern with selected tier key
- **LB line 842:** Use `regional.networking.loadBalancer?.perLBMonthly` with `??` fallback
- **VPN line 858:** Use `regional.networking.vpnGateway?.perGatewayMonthly` with `??` fallback
- **Transit GW local line 879:** Use `regional.networking.transitGateway` with `??` fallback
- **Transit GW global line 894:** Same pattern
- **Public GW line 911:** Use `regional.networking.publicGateway?.perGatewayMonthly` with `??` fallback

- [ ] **Step 2: Update `getRegions()` return type**

Change the return type at line 365:
```typescript
// From:
export function getRegions(pricing?: IBMCloudPricing): PricingResult<{ code: string; name: string; multiplier: number }[]> {
// To:
export function getRegions(pricing?: IBMCloudPricing): PricingResult<{ code: string; name: string; availabilityZones: number }[]> {
```

Update fallback (line 371): `data: [{ code: 'us-south', name: 'Dallas', availabilityZones: 3 }]`

Update mapping (lines 377-381):
```typescript
data: Object.entries(data.regions).map(([code, region]) => ({
  code,
  name: region.name,
  availabilityZones: region.availabilityZones,
})),
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/services/costEstimation.test.ts`
Expected: Tests that check `multiplier` property will fail — fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/services/costEstimation.ts
git commit -m "feat: replace multiplier with regional lookups in calculateVSICost and getRegions"
```

---

### Task 5: Update cost estimation tests

**Files:**
- Modify: `src/services/costEstimation.test.ts`

- [ ] **Step 1: Update `getRegions` tests**

```typescript
// Line 27: Change from
expect(result.data[0]).toHaveProperty('multiplier');
// To
expect(result.data[0]).toHaveProperty('availabilityZones');

// Lines 34-35: Change from
expect(usSouth?.multiplier).toBe(1.0);
// To
expect(usSouth?.availabilityZones).toBe(3);

// Lines 38-43: Replace the "should have correct multipliers" test with:
it('should have availabilityZones for each region', () => {
  const { data: regions } = getRegions();
  for (const region of regions) {
    expect(region.availabilityZones).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Update the "should apply regional multiplier" VSI test (line 126)**

Replace with:
```typescript
it('should use regional pricing when available', () => {
  // With static pricing (no regionalPricing), rates are the same
  // because buildFallbackFromBase returns base rates for all regions
  const usSouthResult = calculateVSICost(basicVSIInput, 'us-south', 'onDemand');
  const euDeResult = calculateVSICost(basicVSIInput, 'eu-de', 'onDemand');
  expect(euDeResult.totalMonthly).toBe(usSouthResult.totalMonthly);
});
```

- [ ] **Step 3: Update the ROKS "should apply regional multiplier" tests (lines 330 and 406)**

Same pattern — with no `regionalPricing`, both regions get the same fallback rates.

- [ ] **Step 4: Run all cost estimation tests**

Run: `npx vitest run src/services/costEstimation.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/costEstimation.test.ts
git commit -m "test: update cost estimation tests for regional pricing"
```

---

### Task 6: Update `bomXlsxGenerator.ts`

**Files:**
- Modify: `src/services/export/bomXlsxGenerator.ts`

- [ ] **Step 1: Add import and replace multiplier in VSI BOM function**

Add import:
```typescript
import { getRegionalPricing } from '@/services/pricing/regionalPricingResolver';
```

In the VSI BOM function (around line 130), replace:
```typescript
const multiplier = regionData?.multiplier || 1.0;
```
With:
```typescript
const regional = getRegionalPricing(pricing, region);
```

Replace each `* multiplier` in the VSI function (lines 138, 257, 352, 582):
- **Line 138 (storage):** Use `regional.blockStorage['generalPurpose']?.costPerGBMonth` with `??` fallback
- **Lines 257, 352 (VSI rates):** Use `regional.vsi[vm.profile]?.monthlyRate` with `??` fallback
- **Line 582 (LB):** Use `regional.networking.loadBalancer?.perLBMonthly` with `??` fallback

- [ ] **Step 2: Replace multiplier in ROKS BOM function**

Same pattern for the ROKS BOM function (around line 460), replacing `multiplier` (lines 517, 554):
- **Line 517 (bare metal):** Use `regional.bareMetal[profile]?.monthlyRate` with `??` fallback
- **Line 554 (storage VSI):** Use `regional.vsi[profile]?.monthlyRate` with `??` fallback

- [ ] **Step 3: Remove "Region Multiplier" BOM rows**

Remove the rows that display the multiplier value (around line 170):
```typescript
// DELETE these lines:
bomSheet.getRow(currentRow).getCell(1).value = 'Region Multiplier';
bomSheet.getRow(currentRow).getCell(2).value = multiplier;
currentRow++;
```

Do the same in the ROKS BOM function if a similar row exists.

- [ ] **Step 4: Run build and tests**

Run: `npx tsc --noEmit && npx vitest run src/services/export/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/export/bomXlsxGenerator.ts
git commit -m "feat: replace multiplier with regional lookups in BOM generator"
```

---

## Chunk 3: UI, Proxy, Transformer, and Docs

### Task 7: Update UI components

**Files:**
- Modify: `src/components/cost/CostEstimation.tsx:346-349`
- Modify: `src/pages/DocumentationPage.tsx:634`

- [ ] **Step 1: Update region dropdown display**

In `src/components/cost/CostEstimation.tsx` line 348, change:
```tsx
text={`${r.name}${r.multiplier !== 1 ? ` (+${((r.multiplier - 1) * 100).toFixed(0)}%)` : ''}`}
```
To:
```tsx
text={r.name}
```

- [ ] **Step 2: Update DocumentationPage**

In `src/pages/DocumentationPage.tsx` line 634, change:
```tsx
<ListItem><strong>Regional Pricing</strong> - Supports all IBM Cloud VPC regions with regional multipliers</ListItem>
```
To:
```tsx
<ListItem><strong>Regional Pricing</strong> - Supports all IBM Cloud VPC regions with actual per-region rates from the Global Catalog</ListItem>
```

- [ ] **Step 3: Build check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/cost/CostEstimation.tsx src/pages/DocumentationPage.tsx
git commit -m "feat: remove multiplier display from region dropdown"
```

---

### Task 8: Update proxy and transformer

**Files:**
- Modify: `functions/pricing-proxy/index.js:139-263` and `271-331`
- Modify: `src/services/pricing/globalCatalogApi.ts:48-72`
- Modify: `src/services/pricing/pricingTransformer.ts:57-172`

- [ ] **Step 1: Update `ProxyPricingResponse` type**

In `src/services/pricing/globalCatalogApi.ts`, change line 56:
```typescript
regions: Record<string, { name: string; multiplier?: number; availabilityZones?: number }>;
```

Add after `networking` (before the closing `}`):
```typescript
regionalPricing?: Record<string, {
  vsi?: Record<string, { hourlyRate: number; monthlyRate: number }>;
  bareMetal?: Record<string, { hourlyRate: number; monthlyRate: number }>;
  blockStorage?: Record<string, { costPerGBMonth: number }>;
  networking?: {
    loadBalancer?: { perLBMonthly: number };
    vpnGateway?: { perGatewayMonthly: number };
    publicGateway?: { perGatewayMonthly: number };
    transitGateway?: { localConnectionMonthly: number; globalConnectionMonthly: number };
    floatingIP?: { perIPMonthly: number };
  };
  roks?: Record<string, unknown>;
}>;
```

- [ ] **Step 2: Update transformer to pass through `regionalPricing`**

In `src/services/pricing/pricingTransformer.ts`, in the return statement (around line 144), add:
```typescript
regionalPricing: proxyData.regionalPricing as IBMCloudPricing['regionalPricing'],
```

- [ ] **Step 3: Update proxy — remove multipliers, add `regionalPricing`**

In `functions/pricing-proxy/index.js`, in both `fetchAllPricing()` (lines 144-155) and `getDefaultPricing()` (lines 277-288):

Remove `multiplier` from each region, add `availabilityZones`:
```javascript
regions: {
  'us-south': { name: 'Dallas', availabilityZones: 3 },
  'us-east': { name: 'Washington DC', availabilityZones: 3 },
  'eu-gb': { name: 'London', availabilityZones: 3 },
  // ... etc for all 10 regions
},
```

Add a `regionalPricing` section using the same rates for all regions (since the proxy has hardcoded rates). The proxy can be enhanced later to fetch actual per-region catalog data.

- [ ] **Step 4: Build check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/pricing/globalCatalogApi.ts src/services/pricing/pricingTransformer.ts functions/pricing-proxy/index.js
git commit -m "feat: update proxy and transformer for regional pricing"
```

---

### Task 9: Update `getStaticPricing()` to load `regionalPricing` from config

**Files:**
- Modify: `src/services/pricing/pricingCache.ts:230-386`

- [ ] **Step 1: Add `regionalPricing` to the config type cast**

In `getStaticPricing()`, add to the config type (around line 231):
```typescript
regionalPricing?: Record<string, RegionalPricingData>;
```

- [ ] **Step 2: Pass `regionalPricing` through in the return object**

In the return statement (around line 371), add:
```typescript
regionalPricing: config.regionalPricing,
```

- [ ] **Step 3: Build check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/pricing/pricingCache.ts
git commit -m "feat: load regionalPricing from static config"
```

---

## Chunk 4: Update Pricing Script

### Task 10: Rewrite `scripts/update-pricing.ts` for unauthenticated per-region fetching

**Files:**
- Modify: `scripts/update-pricing.ts`

This is the largest single change. The script must:
1. Remove IAM authentication
2. Fetch catalog entries unauthenticated
3. For each plan, fetch pricing deployments for ALL regions
4. Build `regionalPricing` data structure
5. Write to config alongside existing fields

- [ ] **Step 1: Remove authentication functions**

Remove `getApiKey()` and `getIamToken()` functions. Remove all `token` parameters from function signatures. Remove `Authorization` header from all `fetch()` calls in `fetchCatalogEntry()`, `searchCatalogWithMetadata()`, and `fetchPlanPricingDeployments()`.

**Note:** During investigation we found that unauthenticated `fetch()` from Python's urllib gets 403 while `curl` works. If `fetch()` without auth also fails from Node, use `execFileSync('curl', ['-s', url])` as a fallback. Test this early in implementation.

- [ ] **Step 2: Update `extractPlanPricing()` to return all regions**

Rename to `extractAllRegionPricing()`. Instead of finding only the us-south deployment, iterate all deployments and extract rates for every region:

```typescript
function extractAllRegionPricing(
  deployments: PricingDeploymentEntry[]
): Record<string, { rates?: PlanRates; flatRate?: FlatRate }> {
  const result: Record<string, { rates?: PlanRates; flatRate?: FlatRate }> = {};
  for (const deployment of deployments) {
    const region = deployment.deployment_location || deployment.deployment_region || '';
    if (!region || !deployment.metrics) continue;
    // Same metric parsing logic as current extractPlanPricing
    // ... store in result[region]
  }
  return result;
}
```

- [ ] **Step 3: Update `fetchComponentPricing()` to return per-region results**

Change return type to `Map<string, Record<string, { hourlyRate; monthlyRate }>>` where outer key is profile name, inner Record is keyed by region. Compute rates for every region found in pricing deployments.

- [ ] **Step 4: Build `regionalPricing` output structure**

In `main()`, after fetching VSI and bare metal pricing per region, assemble the `regionalPricing` object. For block storage, networking, and ROKS, fetch their catalog entries similarly and extract per-region rates. If a category can't be fetched per-region, use the same rate for all regions.

- [ ] **Step 5: Update config writer**

In `updateConfigWithPricing()`, add `regionalPricing` to the config. Remove `multiplier` from `regions` entries. Continue writing `vsiPricing`/`bareMetalPricing` with us-south list rates.

- [ ] **Step 6: Test the script locally**

Run: `npx tsx scripts/update-pricing.ts`
Expected: Works without `IBM_CLOUD_API_KEY`. Fetches list prices for all regions. Writes `regionalPricing` to config.

Verify:
```bash
node -e "const c=require('./src/data/ibmCloudConfig.json'); console.log('Regions:', Object.keys(c.regionalPricing || {})); console.log('us-south VSI count:', Object.keys(c.regionalPricing?.['us-south']?.vsi || {}).length)"
```

- [ ] **Step 7: Commit**

```bash
git add scripts/update-pricing.ts src/data/ibmCloudConfig.json
git commit -m "feat: update pricing script for unauthenticated per-region fetching"
```

---

## Chunk 5: Final Verification

### Task 11: Run full test suite and fix any failures

**Files:**
- Possibly modify: any test files with mock pricing that include `multiplier`

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: Track any failures

- [ ] **Step 2: Fix any failing tests**

Common fixes needed:
- Tests that mock `regions` with `multiplier: 1.0` — make `multiplier` optional or remove it
- Tests that assert `multiplier` exists on returned region objects — update assertions
- Export integration tests that use `multiplier` in pricing mocks — update mocks

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build with no errors

- [ ] **Step 4: Run full test suite again**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit any test fixes**

```bash
git add -A
git commit -m "test: fix remaining tests for regional pricing migration"
```

---

### Task 12: Update CLAUDE.md and changelog

**Files:**
- Modify: `CLAUDE.md`
- Modify: `src/data/changelog.json`

- [ ] **Step 1: Update CLAUDE.md**

In the "Updating IBM Cloud Data" section:
- Remove mention of "Regional multipliers are applied at runtime for other regions"
- Add note that pricing is fetched unauthenticated (list prices) and stored per-region
- Note that `IBM_CLOUD_API_KEY` is no longer required for `npm run update-pricing`

- [ ] **Step 2: Add changelog entry**

Add entry to `src/data/changelog.json` under the current version's `changed` section:
```json
"Pricing now uses unauthenticated IBM Cloud Global Catalog API for accurate list prices across all regions (no API key required)"
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md src/data/changelog.json
git commit -m "docs: update documentation for per-region pricing"
```
