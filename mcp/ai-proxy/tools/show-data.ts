// show_parsed_data — Inspect loaded RVTools data

import { requireData, getState } from '../lib/state';
import { mibToGiB } from '@/utils/formatters';

type Section = 'summary' | 'vms' | 'hosts' | 'clusters' | 'datastores' | 'networks' | 'snapshots' | 'disks';

export function showParsedData(section?: Section): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();
  const s = section || 'summary';

  let result: unknown;

  switch (s) {
    case 'summary': {
      const activeVMs = data.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
      const totalCPUs = activeVMs.reduce((sum, vm) => sum + vm.cpus, 0);
      const totalMemGiB = Math.round(activeVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0));
      const totalStorageGiB = Math.round(activeVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0));

      result = {
        fileName: getState().fileName,
        totalVMs: data.vInfo.length,
        activeVMs: activeVMs.length,
        poweredOff: data.vInfo.filter(vm => vm.powerState === 'poweredOff').length,
        templates: data.vInfo.filter(vm => vm.template).length,
        totalVCPUs: totalCPUs,
        totalMemoryGiB: totalMemGiB,
        totalStorageGiB: totalStorageGiB,
        hosts: data.vHost.length,
        clusters: data.vCluster.length,
        datastores: data.vDatastore.length,
        networks: new Set(data.vNetwork.map(n => n.networkName)).size,
        snapshots: data.vSnapshot.length,
      };
      break;
    }
    case 'vms':
      result = data.vInfo.map(vm => ({
        name: vm.vmName,
        powerState: vm.powerState,
        template: vm.template,
        cpus: vm.cpus,
        memoryGiB: Math.round(mibToGiB(vm.memory) * 10) / 10,
        storageGiB: Math.round(mibToGiB(vm.provisionedMiB) * 10) / 10,
        guestOS: vm.guestOS,
        cluster: vm.cluster,
        host: vm.host,
        datacenter: vm.datacenter,
      }));
      break;
    case 'hosts':
      result = data.vHost.map(h => ({
        name: h.hostName,
        cluster: h.cluster,
        cpuModel: h.cpuModel,
        cpuCount: h.numCpuPkgs,
        coresPerCPU: h.numCpuCores,
        memoryGiB: h.memoryMiB ? Math.round(mibToGiB(h.memoryMiB)) : null,
        vmCount: h.numVMs,
      }));
      break;
    case 'clusters':
      result = data.vCluster.map(c => ({
        name: c.clusterName,
        datacenter: c.datacenter,
        hosts: c.numHosts,
        cpuCores: c.numCpuCores,
        memoryGiB: c.totalMemoryMiB ? Math.round(mibToGiB(c.totalMemoryMiB)) : null,
        haEnabled: c.haEnabled,
        drsEnabled: c.drsEnabled,
      }));
      break;
    case 'datastores':
      result = data.vDatastore.map(ds => ({
        name: ds.name,
        type: ds.type,
        capacityGiB: ds.capacityMiB ? Math.round(mibToGiB(ds.capacityMiB)) : null,
        freeGiB: ds.freeMiB ? Math.round(mibToGiB(ds.freeMiB)) : null,
        hosts: ds.numHosts,
        vms: ds.numVMs,
      }));
      break;
    case 'networks':
      result = data.vNetwork.map(n => ({
        vmName: n.vmName,
        networkName: n.networkName,
        ipv4: n.ipv4Address,
        adapterType: n.adapterType,
      }));
      break;
    case 'snapshots':
      result = data.vSnapshot.map(s => ({
        vmName: s.vmName,
        name: s.snapshotName,
        ageInDays: s.ageInDays,
        sizeMiB: s.sizeMiB,
        description: s.description,
      }));
      break;
    case 'disks':
      result = data.vDisk.map(d => ({
        vmName: d.vmName,
        disk: d.disk,
        capacityGiB: d.capacityMiB ? Math.round(mibToGiB(d.capacityMiB) * 10) / 10 : null,
        raw: d.raw,
        thinProvisioned: d.thinProvisioned,
        diskMode: d.diskMode,
      }));
      break;
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}
