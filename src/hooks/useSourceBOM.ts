import { useMemo } from 'react';
import type { RVToolsData } from '@/types/rvtools';
import type { IBMCloudPricing } from '@/services/pricing/pricingCache';
import { getRegionalPricing } from '@/services/pricing/regionalPricingResolver';
import { buildSourceBOM } from '@/services/sourceBom';
import type { SourceBOMResult } from '@/services/sourceBom';

/**
 * Computes the Source Infrastructure BOM by matching RVTools hosts to IBM Cloud
 * bare metal profiles and pricing storage and VCF licensing.
 *
 * Returns null if data or pricing is unavailable.
 */
export function useSourceBOM(
  rawData: RVToolsData | null,
  region: string,
  pricing: IBMCloudPricing | null,
): SourceBOMResult | null {
  return useMemo(() => {
    if (!rawData || !pricing || rawData.vHost.length === 0) return null;

    const regionalPricing = getRegionalPricing(pricing, region);

    // File storage cost: use dp2 tier or first available
    const fileStorageCostPerGBMonth =
      regionalPricing.fileStorage?.dp2?.costPerGBMonth
      ?? pricing.fileStorage?.dp2?.costPerGBMonth
      ?? 0.11; // fallback

    // Block storage cost: use general purpose tier
    const blockStorageCostPerGBMonth =
      regionalPricing.blockStorage?.generalPurpose?.costPerGBMonth
      ?? pricing.blockStorage?.generalPurpose?.costPerGBMonth
      ?? pricing.blockStorage?.['general-purpose']?.costPerGBMonth
      ?? 0.10; // fallback

    // VCF licensing per core
    const vcfPerCoreMonthly =
      regionalPricing.vcfLicensing?.perCoreMonthly
      ?? pricing.vcfLicensing?.perCoreMonthly
      ?? 192.50; // fallback

    // Build bare metal profiles map with regional pricing overrides
    const bareMetalProfiles = { ...pricing.bareMetal };
    for (const [name, rates] of Object.entries(regionalPricing.bareMetal ?? {})) {
      if (bareMetalProfiles[name]) {
        bareMetalProfiles[name] = {
          ...bareMetalProfiles[name],
          hourlyRate: rates.hourlyRate,
          monthlyRate: rates.monthlyRate,
        };
      }
    }

    // Region name lookup
    const regionName = pricing.regions[region]?.name ?? region;

    return buildSourceBOM({
      hosts: rawData.vHost,
      datastores: rawData.vDatastore,
      region,
      regionName,
      bareMetalProfiles,
      fileStorageCostPerGBMonth,
      blockStorageCostPerGBMonth,
      vcfPerCoreMonthly,
    });
  }, [rawData, region, pricing]);
}
