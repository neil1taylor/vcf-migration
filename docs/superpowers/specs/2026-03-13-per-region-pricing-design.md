# Per-Region Pricing from Global Catalog (Unauthenticated)

**Date:** 2026-03-13
**Status:** Approved

## Problem

The app currently stores us-south pricing fetched with an authenticated API key (which returns account-specific discounted rates ~11.5% below list price), then applies hardcoded regional multipliers at runtime. This produces inaccurate pricing:

- Authenticated rates are discounted, not list prices
- Regional multipliers are guesses (e.g., 1.05 for eu-gb) but actual catalog data shows VSI rates are nearly identical across regions (~1.0 ratio)
- Combined error: ~7% below actual list price for non-us-south regions

## Solution

1. Fetch pricing from the IBM Cloud Global Catalog API **unauthenticated** (returns list prices)
2. Fetch **actual per-region rates** for all 10 regions and all cost categories
3. Store per-region rates directly in a new `regionalPricing` section
4. Remove the `multiplier` field and all `* multiplier` expressions from cost calculations
5. Update both the static config path (update-pricing script) and the live proxy path

## Data Structure

### New type: `RegionalPricingData`

```typescript
interface RegionalPricingData {
  vsi: Record<string, { hourlyRate: number; monthlyRate: number }>;
  bareMetal: Record<string, { hourlyRate: number; monthlyRate: number }>;
  blockStorage: Record<string, {
    costPerGBMonth: number;
    iopsPerGB?: number;
    costPerIOPSMonth?: number;  // needed for custom IOPS tier
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

**Note:** `storageAddons` (snapshots, object storage) are excluded from `RegionalPricingData` by design — they are not currently multiplied and are minor cost components. If needed, they can be added later.

### Updated `IBMCloudPricing`

```typescript
interface IBMCloudPricing {
  // ... existing fields unchanged (vsi, bareMetal, etc. remain as us-south fallback)
  regionalPricing?: Record<string, RegionalPricingData>;  // NEW
  regions: Record<string, RegionPricing>;  // multiplier removed
}
```

### Updated `RegionPricing`

```typescript
interface RegionPricing {
  name: string;
  code: string;
  availabilityZones: number;
  multiplier?: number;  // deprecated, kept optional for cached data compatibility
}
```

During transition, `multiplier` is optional so that old localStorage-cached pricing doesn't break on deserialization. The field is ignored by cost estimation code and will not be written by the updated script or proxy.

### Config JSON structure

```json
{
  "vsiPricing": { "bx2-2x8": { "hourlyRate": 0.1036, "monthlyRate": 75.60 } },
  "regionalPricing": {
    "us-south": {
      "vsi": { "bx2-2x8": { "hourlyRate": 0.1036, "monthlyRate": 75.60 } },
      "bareMetal": { "bx3d-metal-96x768": { "hourlyRate": 5.21, "monthlyRate": 3803.30 } },
      "blockStorage": { "generalPurpose": { "costPerGBMonth": 0.10 }, "3iops": { "costPerGBMonth": 0.08 }, "5iops": { "costPerGBMonth": 0.13 }, "10iops": { "costPerGBMonth": 0.25 } },
      "networking": {
        "loadBalancer": { "perLBMonthly": 21.60 },
        "vpnGateway": { "perGatewayMonthly": 99 },
        "publicGateway": { "perGatewayMonthly": 5 },
        "transitGateway": { "localConnectionMonthly": 50, "globalConnectionMonthly": 100 },
        "floatingIP": { "perIPMonthly": 5 }
      },
      "roks": {
        "ocpLicense": { "perVCPUHourly": 0.04275 },
        "odf": {
          "advanced": { "bareMetalPerNodeMonthly": 681.818, "vsiPerVCPUHourly": 0.00725 },
          "essentials": { "bareMetalPerNodeMonthly": 545.455, "vsiPerVCPUHourly": 0.00575 }
        }
      }
    },
    "eu-gb": { "..." : "same structure, actual eu-gb rates" }
  },
  "regions": {
    "us-south": { "name": "Dallas", "code": "us-south", "availabilityZones": 3 },
    "eu-gb": { "name": "London", "code": "eu-gb", "availabilityZones": 3 }
  }
}
```

## Pricing Resolution

### New file: `src/services/pricing/regionalPricingResolver.ts`

```typescript
function getRegionalPricing(
  pricing: IBMCloudPricing,
  region: string
): RegionalPricingData {
  return pricing.regionalPricing?.[region]
    ?? pricing.regionalPricing?.['us-south']
    ?? buildFallbackFromBase(pricing);
}
```

Fallback chain:
1. Exact region match in `regionalPricing`
2. us-south entry in `regionalPricing`
3. Build from existing base fields (legacy backward compat when `regionalPricing` is absent)

**`buildFallbackFromBase(pricing)`** constructs a `RegionalPricingData` from the top-level `IBMCloudPricing` fields:
- `vsi` → maps each profile's `hourlyRate`/`monthlyRate` into `RegionalPricingData.vsi`
- `bareMetal` → same mapping
- `blockStorage` → maps each tier's `costPerGBMonth`
- `networking` → copies from `pricing.networking`
- `roks` → copies from `pricing.roks`
- `ove` → copies from `pricing.ove` if present

This ensures the app works correctly with old config data that lacks `regionalPricing`.

**Custom bare metal profiles** (user-defined in `customBareMetalProfiles`) will not appear in `regionalPricing` since they aren't in the catalog. The resolver naturally falls through to the base profile rate via the `??` fallback in cost estimation: `regional.bareMetal[name]?.monthlyRate ?? profile.monthlyRate`.

### Cost estimation changes

**Before:**
```typescript
const multiplier = regionData.multiplier;
const monthlyRate = profile.monthlyRate * multiplier;
```

**After:**
```typescript
const regional = getRegionalPricing(pricingToUse, region);
const monthlyRate = regional.vsi[profileName]?.monthlyRate ?? profile.monthlyRate;
```

All ~27 `* multiplier` sites in `costEstimation.ts` and ~6 in `bomXlsxGenerator.ts` follow this pattern.

### UI changes

`CostEstimation.tsx` region dropdown changes from `"London (+5%)"` to `"London"`. The `getRegions()` function return type drops the `multiplier` field — returns `{ code: string; name: string; availabilityZones: number }[]`.

## Script Changes (`scripts/update-pricing.ts`)

1. **Remove IAM authentication** — all catalog fetches are unauthenticated (returns list prices)
2. **Fetch all 10 regions** — for each plan, extract rates from every regional deployment
3. **Fetch all cost categories per region:**
   - VSI: component-based (gen2) or flat instance-hours (gen3+)
   - Bare metal: flat per-server rates
   - Block storage: per-GB-month per tier
   - Networking: LB, VPN, transit gateway, public gateway, floating IP
   - ROKS: OCP license, ODF, ACM, cluster management, worker node rates
   - OVE: same categories as ROKS (parallel pricing for ROV variant)
4. **Write `regionalPricing` section** to `ibmCloudConfig.json`
5. **Continue writing `vsiPricing`/`bareMetalPricing`** as us-south rates for backward compat
6. **Remove `multiplier`** from `regions` entries

## Proxy Changes (`functions/pricing-proxy/index.js`)

1. Remove hardcoded `multiplier` from `regions` objects
2. Add `regionalPricing` to the response in the same structure as the config
3. Both `fetchAllPricing()` and `getDefaultPricing()` updated
4. `pricingTransformer.ts` maps `proxyData.regionalPricing` into `IBMCloudPricing.regionalPricing`

## Files Changed

| File | Change |
|---|---|
| `scripts/update-pricing.ts` | Remove auth, fetch all regions, write `regionalPricing` |
| `src/data/ibmCloudConfig.json` | Add `regionalPricing`, remove `multiplier` from regions |
| `src/services/pricing/pricingCache.ts` | Add `RegionalPricingData` type, update `RegionPricing`, update `IBMCloudPricing` |
| `src/services/pricing/regionalPricingResolver.ts` | **New** — `getRegionalPricing()` helper + `buildFallbackFromBase()` |
| `src/services/costEstimation.ts` | Replace ~27 `* multiplier` sites with regional lookups |
| `src/services/export/bomXlsxGenerator.ts` | Replace ~6 `* multiplier` sites with regional lookups; remove "Region Multiplier" BOM row |
| `src/services/pricing/pricingTransformer.ts` | Map proxy `regionalPricing` to app format |
| `src/services/pricing/globalCatalogApi.ts` | Update `ProxyPricingResponse` type to include `regionalPricing` |
| `src/components/cost/CostEstimation.tsx` | Remove multiplier % display from region dropdown |
| `functions/pricing-proxy/index.js` | Add `regionalPricing`, remove multipliers |
| `src/services/costEstimation.test.ts` | Update mocks and assertions for regional pricing |
| `src/pages/DocumentationPage.tsx` | Update "regional multipliers" text |

## Testing

- Update `costEstimation.test.ts` mock pricing to include `regionalPricing`
- Remove assertions that verify multiplier behavior
- Add tests for: regional rate lookup, us-south fallback, legacy fallback when `regionalPricing` absent
- Update export integration test fixtures
- Verify `npm run build` passes (no type errors)
- Run full test suite

## Backward Compatibility

- If `regionalPricing` is missing (old config or old proxy), the resolver falls back to base fields via `buildFallbackFromBase()`
- The `multiplier` field becomes optional on `RegionPricing` so old cached data in localStorage doesn't break on deserialization; the field is ignored by all cost calculation code
- Existing `vsiPricing`/`bareMetalPricing` fields continue to be written for any code that reads them directly
- Custom bare metal profiles (not in catalog) naturally fall through to base profile rates
- DOCX/PPTX/PDF exports delegate to `costEstimation.ts` and are covered transitively — no direct changes needed in export section builders
- `blockStorage` keys use camelCase (`generalPurpose`, not `general-purpose`) to match existing convention

**Note on new regions:** If IBM adds an 11th region, the resolver falls back to us-south rates until the script is re-run. Running `npm run update-pricing` will pick up any new regions automatically.
