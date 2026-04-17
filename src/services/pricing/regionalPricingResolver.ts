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
  const regional = pricing.regionalPricing?.[region]
    ?? pricing.regionalPricing?.['us-south']
    ?? buildFallbackFromBase(pricing);

  // Backfill bare metal profiles missing from regional data (e.g. custom/future profiles)
  // using their base rates from pricing.bareMetal
  if (pricing.bareMetal) {
    for (const [name, profile] of Object.entries(pricing.bareMetal)) {
      if (!regional.bareMetal[name]) {
        regional.bareMetal[name] = { hourlyRate: profile.hourlyRate, monthlyRate: profile.monthlyRate };
      }
    }
  }

  // Backfill VSI profiles missing from regional data
  if (pricing.vsi) {
    for (const [name, profile] of Object.entries(pricing.vsi)) {
      if (!regional.vsi[name]) {
        regional.vsi[name] = { hourlyRate: profile.hourlyRate, monthlyRate: profile.monthlyRate };
      }
    }
  }

  // Backfill OVE licensing from base pricing when regional data lacks it
  if (!regional.ove && pricing.ove) {
    regional.ove = {
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
    };
  }

  return regional;
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

  const fileStorage: RegionalPricingData['fileStorage'] = pricing.fileStorage
    ? Object.fromEntries(
        Object.entries(pricing.fileStorage).map(([tier, data]) => [tier, { costPerGBMonth: data.costPerGBMonth }])
      )
    : undefined;

  const vcfLicensing: RegionalPricingData['vcfLicensing'] = pricing.vcfLicensing
    ? { perCoreMonthly: pricing.vcfLicensing.perCoreMonthly }
    : undefined;

  return { vsi, bareMetal, blockStorage, networking, roks, ove, fileStorage, vcfLicensing };
}
