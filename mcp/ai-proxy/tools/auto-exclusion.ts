// check_auto_exclusions — VM filtering rules evaluation

import { requireData } from '../lib/state';
import { getAutoExclusionMap } from '@/utils/autoExclusion';

export function checkAutoExclusions(): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();
  const exclusionMap = getAutoExclusionMap(data.vInfo);

  const excluded: Array<{ vmName: string; reasons: string[]; labels: string[] }> = [];
  const included: string[] = [];

  for (const vm of data.vInfo) {
    const result = exclusionMap.get(vm.vmName);
    if (result?.isAutoExcluded) {
      excluded.push({
        vmName: vm.vmName,
        reasons: result.reasons,
        labels: result.labels,
      });
    } else {
      included.push(vm.vmName);
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        totalVMs: data.vInfo.length,
        excludedCount: excluded.length,
        includedCount: included.length,
        excluded,
        included,
      }, null, 2),
    }],
  };
}
