// check_os_compatibility — OS support matrix check

import { requireData } from '../lib/state';
import { getOSCompatibilityResults, countByOSStatus } from '@/services/migration/osCompatibility';
import type { MigrationMode } from '@/services/migration/osCompatibility';

export function checkOsCompatibility(mode: MigrationMode): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();
  const activeVMs = data.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);

  const results = getOSCompatibilityResults(activeVMs, mode);
  const counts = countByOSStatus(activeVMs, mode);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        mode,
        totalVMs: results.length,
        statusCounts: counts,
        perVM: results.map(r => ({
          vmName: r.vmName,
          guestOS: r.guestOS,
          status: r.normalizedStatus,
          displayName: r.compatibility.displayName,
          notes: r.compatibility.notes,
        })),
      }, null, 2),
    }],
  };
}
