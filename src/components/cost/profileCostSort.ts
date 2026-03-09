import type { CostEstimate } from '@/services/costEstimation';

export interface ProfileCostEntry {
  profile: { id: string; isCustom?: boolean; monthlyRate?: number };
  estimate: CostEstimate;
  cpuViable: boolean;
}

/**
 * Sort profile cost entries: CPU-viable first, then priced before unpriced custom,
 * then by totalMonthly ascending. Non-finite costs sort to end.
 */
export function sortProfileCosts<T extends ProfileCostEntry>(costs: T[]): T[] {
  return [...costs].sort((a, b) => {
    // Non-viable (ODF exceeds CPU) to the end
    if (a.cpuViable !== b.cpuViable) return a.cpuViable ? -1 : 1;
    // Unpriced custom to the end
    const aUnpriced = a.profile.isCustom && (!a.profile.monthlyRate || a.profile.monthlyRate === 0);
    const bUnpriced = b.profile.isCustom && (!b.profile.monthlyRate || b.profile.monthlyRate === 0);
    if (aUnpriced !== bUnpriced) return aUnpriced ? 1 : -1;
    // Sort by total monthly cost ascending (coerce to number for safety; NaN → Infinity)
    const aCost = Number(a.estimate.totalMonthly);
    const bCost = Number(b.estimate.totalMonthly);
    const aVal = Number.isFinite(aCost) ? aCost : Infinity;
    const bVal = Number.isFinite(bCost) ? bCost : Infinity;
    return aVal - bVal;
  });
}

/**
 * Find the best-value (cheapest) profile among CPU-viable, priced profiles.
 */
export function findBestValueProfileId<T extends ProfileCostEntry>(costs: T[]): string | undefined {
  const priceable = costs.filter(c =>
    !(c.profile.isCustom && (!c.profile.monthlyRate || c.profile.monthlyRate === 0))
    && c.cpuViable
    && Number.isFinite(Number(c.estimate.totalAnnual))
  );
  const sorted = [...priceable].sort((a, b) => Number(a.estimate.totalMonthly) - Number(b.estimate.totalMonthly));
  return sorted[0]?.profile.id;
}
