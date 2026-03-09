// classify_targets — Route VMs to ROKS/VSI/PowerVS using rule engine

import { requireData } from '../lib/state';
import { classifyAllVMs, getRecommendation } from '@/services/migration/targetClassification';

export function classifyTargets(platformLeaning?: 'roks' | 'vsi' | 'neutral'): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();
  const activeVMs = data.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);

  // Build empty workload map (no UI classification available in MCP context)
  const workloadTypes = new Map<string, string>();

  const classifications = classifyAllVMs(activeVMs, workloadTypes);

  // Count by target
  const counts = { roks: 0, vsi: 0, powervs: 0 };
  for (const c of classifications) {
    counts[c.target]++;
  }

  const recommendation = getRecommendation(classifications, 0, 0, 0);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        platformLeaning: platformLeaning || 'neutral',
        totalVMs: classifications.length,
        counts,
        recommendation: {
          type: recommendation.type,
          title: recommendation.title,
          reasoning: recommendation.reasoning,
          roksPercentage: recommendation.roksPercentage,
          vsiPercentage: recommendation.vsiPercentage,
          powervsPercentage: recommendation.powervsPercentage,
        },
        perVM: classifications.map(c => ({
          vmName: c.vmName,
          target: c.target,
          confidence: c.confidence,
          reasons: c.reasons,
        })),
      }, null, 2),
    }],
  };
}
