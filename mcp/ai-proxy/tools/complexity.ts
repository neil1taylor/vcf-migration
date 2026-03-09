// analyze_complexity — Complexity scoring and distribution

import { requireData, getOrComputeComplexity } from '../lib/state';
import { getAssessmentSummary, calculateReadinessScore } from '@/services/migration/migrationAssessment';
import type { MigrationMode } from '@/services/migration/osCompatibility';

export function analyzeComplexity(mode: MigrationMode): { content: Array<{ type: 'text'; text: string }> } {
  requireData();
  const scores = getOrComputeComplexity(mode);
  const summary = getAssessmentSummary(scores);

  // Calculate readiness score
  const blockerCount = scores.filter(s => s.category === 'Blocker').length;
  const unsupportedCount = scores.filter(s => s.factors.includes('Unsupported OS')).length;
  const readinessScore = calculateReadinessScore(
    blockerCount,
    summary.complexCount,
    unsupportedCount,
    summary.totalVMs
  );

  // Top complex VMs
  const topComplex = [...scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(s => ({
      vmName: s.vmName,
      score: s.score,
      category: s.category,
      factors: s.factors,
      guestOS: s.guestOS,
      cpus: s.cpus,
      memoryGiB: s.memoryGiB,
    }));

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        mode,
        summary,
        readinessScore,
        distribution: {
          Simple: summary.simpleCount,
          Moderate: summary.moderateCount,
          Complex: summary.complexCount,
          Blocker: summary.blockerCount,
        },
        topComplexVMs: topComplex,
      }, null, 2),
    }],
  };
}
