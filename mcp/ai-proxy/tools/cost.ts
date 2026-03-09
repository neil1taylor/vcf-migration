// estimate_costs — ROKS and VSI cost calculation

import { requireData, getOrComputeComplexity } from '../lib/state';
import {
  calculateROKSCost,
  calculateVSICost,
} from '@/services/costEstimation';
import { mibToGiB } from '@/utils/formatters';

export function estimateCosts(
  region?: string,
  discountType?: string,
): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();
  const activeVMs = data.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);

  // Compute complexity to understand sizing needs
  const roksScores = getOrComputeComplexity('roks');
  const vsiScores = getOrComputeComplexity('vsi');

  // Aggregate resource totals
  const totalVCPUs = activeVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryGiB = Math.round(activeVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0));
  const totalStorageGiB = Math.round(activeVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0));

  const regionCode = (region || 'us-south') as Parameters<typeof calculateROKSCost>[1];
  const discount = (discountType || 'onDemand') as Parameters<typeof calculateROKSCost>[2];

  // Simple ROKS estimate — 3-node minimum with bx2.16x64 profile
  let roksCost;
  try {
    const nodeCount = Math.max(3, Math.ceil(totalVCPUs / 16));
    roksCost = calculateROKSCost(
      { computeNodes: nodeCount, computeProfile: 'bx2.16x64', storageTiB: Math.ceil(totalStorageGiB / 1024) },
      regionCode,
      discount,
    );
  } catch (e) {
    roksCost = { error: (e as Error).message };
  }

  // Simple VSI estimate — one profile per VM
  let vsiCost;
  try {
    // Map each VM to a basic profile
    const profileCounts = new Map<string, number>();
    for (const vm of activeVMs) {
      const memGiB = mibToGiB(vm.memory);
      let profile: string;
      if (vm.cpus <= 2 && memGiB <= 8) profile = 'bx2-2x8';
      else if (vm.cpus <= 4 && memGiB <= 16) profile = 'bx2-4x16';
      else if (vm.cpus <= 8 && memGiB <= 32) profile = 'bx2-8x32';
      else if (vm.cpus <= 16 && memGiB <= 64) profile = 'bx2-16x64';
      else if (vm.cpus <= 32 && memGiB <= 128) profile = 'bx2-32x128';
      else if (vm.cpus <= 48 && memGiB <= 192) profile = 'bx2-48x192';
      else profile = 'bx2-64x256';
      profileCounts.set(profile, (profileCounts.get(profile) || 0) + 1);
    }
    const vmProfiles = Array.from(profileCounts.entries()).map(([profile, count]) => ({ profile, count }));
    vsiCost = calculateVSICost(
      { vmProfiles, storageTiB: Math.ceil(totalStorageGiB / 1024), storageTier: '5iops' as const },
      regionCode,
      discount,
    );
  } catch (e) {
    vsiCost = { error: (e as Error).message };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        region: regionCode,
        discountType: discount,
        resourceTotals: { totalVCPUs, totalMemoryGiB, totalStorageGiB, activeVMs: activeVMs.length },
        complexitySummary: {
          roks: { simple: roksScores.filter(s => s.category === 'Simple').length, blocker: roksScores.filter(s => s.category === 'Blocker').length },
          vsi: { simple: vsiScores.filter(s => s.category === 'Simple').length, blocker: vsiScores.filter(s => s.category === 'Blocker').length },
        },
        roksCost,
        vsiCost,
      }, null, 2),
    }],
  };
}
