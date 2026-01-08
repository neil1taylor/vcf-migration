// IBM Cloud Cost Estimation Service
import pricingData from '@/data/ibmCloudPricing.json';

export interface CostLineItem {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  monthlyCost: number;
  annualCost: number;
  notes?: string;
}

export interface CostEstimate {
  architecture: string;
  region: string;
  regionName: string;
  discountType: string;
  discountPct: number;
  lineItems: CostLineItem[];
  subtotalMonthly: number;
  subtotalAnnual: number;
  discountAmountMonthly: number;
  discountAmountAnnual: number;
  totalMonthly: number;
  totalAnnual: number;
  metadata: {
    pricingVersion: string;
    generatedAt: string;
    notes: string[];
  };
}

export interface ROKSSizingInput {
  computeNodes: number;
  computeProfile: string;
  storageNodes?: number;
  storageProfile?: string;
  storageTiB?: number;
  storageTier?: '5iops' | '10iops';
  useNvme?: boolean;
  odfProfile?: string;
}

export interface VSISizingInput {
  vmProfiles: { profile: string; count: number }[];
  storageTiB: number;
  storageTier?: '5iops' | '10iops';
}

export type RegionCode = keyof typeof pricingData.regions;
export type DiscountType = keyof typeof pricingData.discounts;

/**
 * Get list of available regions
 */
export function getRegions(): { code: string; name: string; multiplier: number }[] {
  return Object.entries(pricingData.regions).map(([code, region]) => ({
    code,
    name: region.name,
    multiplier: region.multiplier,
  }));
}

/**
 * Get list of available discount options
 */
export function getDiscountOptions(): { id: string; name: string; discountPct: number; description: string }[] {
  return Object.entries(pricingData.discounts).map(([id, discount]) => ({
    id,
    name: discount.name,
    discountPct: discount.discountPct,
    description: discount.description,
  }));
}

/**
 * Get bare metal profiles
 */
export function getBareMetalProfiles() {
  return Object.entries(pricingData.bareMetal).map(([id, profile]) => ({
    id,
    ...profile,
  }));
}

/**
 * Get VSI profiles
 */
export function getVSIProfiles() {
  return Object.entries(pricingData.vsi).map(([id, profile]) => ({
    id,
    ...profile,
  }));
}

/**
 * Get ODF workload profiles
 */
export function getODFProfiles() {
  return Object.entries(pricingData.odfWorkloadProfiles).map(([id, profile]) => ({
    id,
    ...profile,
  }));
}

/**
 * Calculate ROKS cluster cost estimate
 */
export function calculateROKSCost(
  input: ROKSSizingInput,
  region: RegionCode = 'us-south',
  discountType: DiscountType = 'onDemand'
): CostEstimate {
  const lineItems: CostLineItem[] = [];
  const regionData = pricingData.regions[region];
  const discountData = pricingData.discounts[discountType];
  const multiplier = regionData.multiplier;

  // Compute nodes (bare metal)
  const computeProfile = pricingData.bareMetal[input.computeProfile as keyof typeof pricingData.bareMetal];
  if (computeProfile && input.computeNodes > 0) {
    const monthlyRate = computeProfile.monthlyRate * multiplier;
    lineItems.push({
      category: 'Compute',
      description: `Bare Metal - ${input.computeProfile}`,
      quantity: input.computeNodes,
      unit: 'nodes',
      unitCost: monthlyRate,
      monthlyCost: input.computeNodes * monthlyRate,
      annualCost: input.computeNodes * monthlyRate * 12,
      notes: computeProfile.description,
    });
  }

  // If using NVMe (converged storage), no separate storage nodes needed
  if (input.useNvme && computeProfile?.hasNvme) {
    // NVMe storage is included in the bare metal cost
    // Cast to access optional NVMe properties
    const nvmeProfile = computeProfile as { totalNvmeGB?: number; nvmeDisks?: number; nvmeSizeGB?: number };
    const nvmeCapacity = input.computeNodes * (nvmeProfile.totalNvmeGB || 0);
    lineItems.push({
      category: 'Storage',
      description: 'NVMe Local Storage (included)',
      quantity: Math.round(nvmeCapacity / 1024),
      unit: 'TiB raw',
      unitCost: 0,
      monthlyCost: 0,
      annualCost: 0,
      notes: `${nvmeProfile.nvmeDisks || 0}x ${(nvmeProfile.nvmeSizeGB || 0) / 1000}TB NVMe per node`,
    });
  } else {
    // Hybrid architecture with separate storage nodes
    if (input.storageNodes && input.storageProfile) {
      const storageVSI = pricingData.vsi[input.storageProfile as keyof typeof pricingData.vsi];
      if (storageVSI) {
        const monthlyRate = storageVSI.monthlyRate * multiplier;
        lineItems.push({
          category: 'Storage - VSI',
          description: `VSI - ${input.storageProfile}`,
          quantity: input.storageNodes,
          unit: 'nodes',
          unitCost: monthlyRate,
          monthlyCost: input.storageNodes * monthlyRate,
          annualCost: input.storageNodes * monthlyRate * 12,
          notes: `ODF storage workers - ${storageVSI.description}`,
        });
      }
    }

    // Block storage for hybrid
    if (input.storageTiB && input.storageTiB > 0) {
      const tier = input.storageTier || '10iops';
      const storageTierData = pricingData.blockStorage[tier];
      const storageGB = input.storageTiB * 1024;
      const costPerGB = storageTierData.costPerGBMonth * multiplier;

      lineItems.push({
        category: 'Storage - Block',
        description: `Block Storage - ${storageTierData.tierName}`,
        quantity: storageGB,
        unit: 'GB',
        unitCost: costPerGB,
        monthlyCost: storageGB * costPerGB,
        annualCost: storageGB * costPerGB * 12,
        notes: storageTierData.description,
      });
    }
  }

  // Networking (basic setup)
  const networkingCost = pricingData.networking.loadBalancer.perLBMonthly * multiplier * 2; // 2 LBs
  lineItems.push({
    category: 'Networking',
    description: 'Load Balancers (2x)',
    quantity: 2,
    unit: 'LBs',
    unitCost: pricingData.networking.loadBalancer.perLBMonthly * multiplier,
    monthlyCost: networkingCost,
    annualCost: networkingCost * 12,
    notes: 'Application Load Balancers for ingress',
  });

  // Calculate totals
  const subtotalMonthly = lineItems.reduce((sum, item) => sum + item.monthlyCost, 0);
  const subtotalAnnual = subtotalMonthly * 12;
  const discountAmountMonthly = subtotalMonthly * (discountData.discountPct / 100);
  const discountAmountAnnual = discountAmountMonthly * 12;
  const totalMonthly = subtotalMonthly - discountAmountMonthly;
  const totalAnnual = totalMonthly * 12;

  return {
    architecture: input.useNvme ? 'All-NVMe Converged' : 'Hybrid (Bare Metal + VSI Storage)',
    region,
    regionName: regionData.name,
    discountType,
    discountPct: discountData.discountPct,
    lineItems,
    subtotalMonthly,
    subtotalAnnual,
    discountAmountMonthly,
    discountAmountAnnual,
    totalMonthly,
    totalAnnual,
    metadata: {
      pricingVersion: pricingData.pricingVersion,
      generatedAt: new Date().toISOString(),
      notes: [
        'Estimated pricing - actual costs may vary',
        'Contact IBM for enterprise pricing',
        discountData.discountPct > 0 ? `${discountData.name} discount applied` : 'On-demand pricing',
      ],
    },
  };
}

/**
 * Calculate VSI migration cost estimate
 */
export function calculateVSICost(
  input: VSISizingInput,
  region: RegionCode = 'us-south',
  discountType: DiscountType = 'onDemand'
): CostEstimate {
  const lineItems: CostLineItem[] = [];
  const regionData = pricingData.regions[region];
  const discountData = pricingData.discounts[discountType];
  const multiplier = regionData.multiplier;

  // Group VSI profiles
  const profileCounts: Record<string, { count: number; profile: typeof pricingData.vsi[keyof typeof pricingData.vsi] }> = {};

  for (const vm of input.vmProfiles) {
    const profile = pricingData.vsi[vm.profile as keyof typeof pricingData.vsi];
    if (profile) {
      if (!profileCounts[vm.profile]) {
        profileCounts[vm.profile] = { count: 0, profile };
      }
      profileCounts[vm.profile].count += vm.count;
    }
  }

  // Add VSI line items
  for (const [profileName, data] of Object.entries(profileCounts)) {
    const monthlyRate = data.profile.monthlyRate * multiplier;
    lineItems.push({
      category: 'Compute - VSI',
      description: `VSI - ${profileName}`,
      quantity: data.count,
      unit: 'instances',
      unitCost: monthlyRate,
      monthlyCost: data.count * monthlyRate,
      annualCost: data.count * monthlyRate * 12,
      notes: data.profile.description,
    });
  }

  // Block storage
  if (input.storageTiB > 0) {
    const tier = input.storageTier || '10iops';
    const storageTierData = pricingData.blockStorage[tier];
    const storageGB = input.storageTiB * 1024;
    const costPerGB = storageTierData.costPerGBMonth * multiplier;

    lineItems.push({
      category: 'Storage - Block',
      description: `Block Storage - ${storageTierData.tierName}`,
      quantity: storageGB,
      unit: 'GB',
      unitCost: costPerGB,
      monthlyCost: storageGB * costPerGB,
      annualCost: storageGB * costPerGB * 12,
      notes: storageTierData.description,
    });
  }

  // Networking
  const networkingCost = pricingData.networking.loadBalancer.perLBMonthly * multiplier;
  lineItems.push({
    category: 'Networking',
    description: 'Application Load Balancer',
    quantity: 1,
    unit: 'LB',
    unitCost: networkingCost,
    monthlyCost: networkingCost,
    annualCost: networkingCost * 12,
    notes: 'For application traffic',
  });

  // Calculate totals
  const subtotalMonthly = lineItems.reduce((sum, item) => sum + item.monthlyCost, 0);
  const subtotalAnnual = subtotalMonthly * 12;
  const discountAmountMonthly = subtotalMonthly * (discountData.discountPct / 100);
  const discountAmountAnnual = discountAmountMonthly * 12;
  const totalMonthly = subtotalMonthly - discountAmountMonthly;
  const totalAnnual = totalMonthly * 12;

  return {
    architecture: 'VPC Virtual Server Instances',
    region,
    regionName: regionData.name,
    discountType,
    discountPct: discountData.discountPct,
    lineItems,
    subtotalMonthly,
    subtotalAnnual,
    discountAmountMonthly,
    discountAmountAnnual,
    totalMonthly,
    totalAnnual,
    metadata: {
      pricingVersion: pricingData.pricingVersion,
      generatedAt: new Date().toISOString(),
      notes: [
        'Estimated pricing - actual costs may vary',
        'Contact IBM for enterprise pricing',
        discountData.discountPct > 0 ? `${discountData.name} discount applied` : 'On-demand pricing',
      ],
    },
  };
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format currency with decimals
 */
export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
