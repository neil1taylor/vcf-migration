// ai_classify_vms — watsonx classification via proxy

import { requireData } from '../lib/state';
import { proxyPost } from '../lib/proxy-client';
import { mibToGiB } from '@/utils/formatters';

export async function aiClassifyVms(limit?: number): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const data = requireData();
  const activeVMs = data.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  const vmsToClassify = limit ? activeVMs.slice(0, limit) : activeVMs;

  // Build classification input matching proxy expected format
  const vmInputs = vmsToClassify.map(vm => ({
    name: vm.vmName,
    guestOS: vm.guestOS,
    cpus: vm.cpus,
    memoryGiB: Math.round(mibToGiB(vm.memory)),
    cluster: vm.cluster,
    annotation: vm.annotation,
  }));

  const res = await proxyPost('/api/classify', { vms: vmInputs });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        vmsSubmitted: vmInputs.length,
        ok: res.ok,
        status: res.status,
        data: res.data,
        error: res.error,
      }, null, 2),
    }],
  };
}
