// check_data_quality — Statistical outlier detection

import { requireData } from '../lib/state';
import { checkDataInconsistencies } from '@/services/dataInconsistencyChecks';

export function checkDataQuality(): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();
  const activeVMs = data.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);

  const result = checkDataInconsistencies(activeVMs);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        totalVMs: activeVMs.length,
        warningCount: result.warnings.length,
        hasCritical: result.hasCritical,
        warnings: result.warnings.map(w => ({
          vmName: w.vmName,
          category: w.category,
          severity: w.severity,
          message: w.message,
          details: w.details,
          metric: w.metric,
          expected: w.expected,
        })),
      }, null, 2),
    }],
  };
}
