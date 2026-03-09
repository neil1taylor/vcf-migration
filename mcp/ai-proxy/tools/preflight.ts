// run_preflight_checks — Per-VM migration readiness checks

import { requireData, getOrComputePreflight } from '../lib/state';
import type { CheckMode } from '@/services/preflightChecks';
import { derivePreflightCounts } from '@/services/preflightChecks';
import { generateRemediationItems } from '@/services/migration/remediation';

export function runPreflight(mode: CheckMode): { content: Array<{ type: 'text'; text: string }> } {
  requireData();
  const results = getOrComputePreflight(mode);
  const counts = derivePreflightCounts(results, mode);
  const remediation = generateRemediationItems(counts, mode, true);

  const blockers = results.filter(r => r.blockerCount > 0);
  const warnings = results.filter(r => r.warningCount > 0 && r.blockerCount === 0);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        mode,
        totalVMs: results.length,
        vmsWithBlockers: blockers.length,
        vmsWithWarningsOnly: warnings.length,
        vmsClean: results.length - blockers.length - warnings.length,
        remediationItems: remediation.map(r => ({
          title: r.title,
          severity: r.severity,
          vmCount: r.vmCount,
          description: r.description,
        })),
        perVM: results.map(r => ({
          vmName: r.vmName,
          blockers: r.blockerCount,
          warnings: r.warningCount,
          failedChecks: Object.entries(r.checks)
            .filter(([, c]) => c.status === 'fail')
            .map(([id, c]) => ({ id, message: c.message, value: c.value })),
        })),
      }, null, 2),
    }],
  };
}
