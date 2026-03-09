// plan_waves — Group VMs into migration waves

import { requireData, getOrComputeComplexity } from '../lib/state';
import { buildVMWaveData, createComplexityWaves } from '@/services/migration/wavePlanning';
import type { MigrationMode } from '@/services/migration/osCompatibility';

export function planWaves(mode: MigrationMode): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();
  const activeVMs = data.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  const scores = getOrComputeComplexity(mode);

  const vmWaveData = buildVMWaveData(
    activeVMs,
    scores,
    data.vDisk,
    data.vSnapshot,
    data.vTools,
    data.vNetwork,
    mode,
  );

  const waves = createComplexityWaves(vmWaveData, mode);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        mode,
        totalWaves: waves.length,
        waves: waves.map(w => ({
          name: w.name,
          description: w.description,
          vmCount: w.vmCount,
          vcpus: w.vcpus,
          memoryGiB: w.memoryGiB,
          storageGiB: w.storageGiB,
          hasBlockers: w.hasBlockers,
          avgComplexity: w.avgComplexity,
          vms: w.vms.map(vm => ({
            vmName: vm.vmName,
            complexity: vm.complexity,
            osStatus: vm.osStatus,
            vcpus: vm.vcpus,
            memoryGiB: vm.memoryGiB,
            storageGiB: vm.storageGiB,
          })),
        })),
      }, null, 2),
    }],
  };
}
