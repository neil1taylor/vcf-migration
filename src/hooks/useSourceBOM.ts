import { useMemo } from 'react';
import type { RVToolsData } from '@/types/rvtools';
import type { IBMCloudPricing } from '@/services/pricing/pricingCache';
import type { ClassicBillingData } from '@/services/billing/types';
import { getRegionalPricing } from '@/services/pricing/regionalPricingResolver';
import { buildSourceBOM, buildSourceBOMWithBilling } from '@/services/sourceBom';
import { matchBillingToHosts } from '@/services/billing';
import type { SourceBOMResult } from '@/services/sourceBom';

/**
 * Computes the Source Infrastructure BOM by matching RVTools hosts to IBM Cloud
 * Classic bare metal CPU and RAM components, pricing storage and VCF licensing.
 *
 * When billing data is provided, actual per-host costs replace estimates for
 * matched hosts and additional cost categories are surfaced.
 *
 * Returns null if data or pricing is unavailable.
 */
export function useSourceBOM(
  rawData: RVToolsData | null,
  region: string,
  pricing: IBMCloudPricing | null,
  billingData?: ClassicBillingData | null,
): SourceBOMResult | null {
  return useMemo(() => {
    if (!rawData || !pricing || rawData.vHost.length === 0) return null;

    const regionalPricing = getRegionalPricing(pricing, region);

    // Classic Endurance File Storage cost (4 IOPS/GB tier)
    const fileStorageCostPerGBMonth =
      pricing.classicStoragePricing?.fileEndurance4iops
      ?? 0.13;

    // Classic Endurance Block Storage cost (4 IOPS/GB tier)
    const blockStorageCostPerGBMonth =
      pricing.classicStoragePricing?.blockEndurance4iops
      ?? 0.13;

    // VCF licensing per core
    const vcfPerCoreMonthly =
      regionalPricing.vcfLicensing?.perCoreMonthly
      ?? pricing.vcfLicensing?.perCoreMonthly
      ?? 192.50; // fallback

    // Region name lookup
    const regionName = pricing.regions[region]?.name ?? region;

    const input = {
      hosts: rawData.vHost,
      datastores: rawData.vDatastore,
      region,
      regionName,
      classicCpus: pricing.classicBareMetalCpus,
      classicRam: pricing.classicBareMetalRam,
      fileStorageCostPerGBMonth,
      blockStorageCostPerGBMonth,
      vcfPerCoreMonthly,
    };

    // If billing data is available, match and overlay actual costs
    if (billingData) {
      const rvtoolsHostnames = rawData.vHost.map(h => h.name);
      const matchResult = matchBillingToHosts(billingData, rvtoolsHostnames);
      return buildSourceBOMWithBilling(input, billingData, matchResult);
    }

    return buildSourceBOM(input);
  }, [rawData, region, pricing, billingData]);
}
