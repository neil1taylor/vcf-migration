import { describe, it, expect } from 'vitest';
import { buildAnomalyInput } from './anomalyInputBuilder';
import type { RVToolsData } from '@/types';

function makeRVToolsData(overrides: Partial<RVToolsData> = {}): RVToolsData {
  return {
    metadata: { fileName: 'test.xlsx', collectionDate: null, vCenterVersion: null, environment: null },
    vInfo: [],
    vDisk: [],
    vNetwork: [],
    vHost: [],
    vCluster: [],
    vDatastore: [],
    vSnapshot: [],
    vTools: [],
    vCD: [],
    vCPU: [],
    vMemory: [],
    vSource: [],
    vLicense: [],
    vPartition: [],
    vResourcePool: [],
    vHealth: [],
    ...overrides,
  };
}

describe('buildAnomalyInput', () => {
  it('returns empty candidates for empty data', () => {
    const result = buildAnomalyInput(makeRVToolsData());
    expect(result.anomalyCandidates).toHaveLength(0);
    expect(result.totalVMs).toBe(0);
  });

  it('detects CPU outliers', () => {
    const vms = [
      ...Array.from({ length: 10 }, (_, i) => ({ vmName: `vm${i}`, cpus: 4, memory: 4096, template: false, powerState: 'poweredOn' })),
      { vmName: 'outlier', cpus: 128, memory: 4096, template: false, powerState: 'poweredOn' },
    ] as RVToolsData['vInfo'];

    const result = buildAnomalyInput(makeRVToolsData({ vInfo: vms }));
    const cpuAnomaly = result.anomalyCandidates.find(c => c.description.includes('CPU'));
    expect(cpuAnomaly).toBeDefined();
    expect(cpuAnomaly!.category).toBe('resource-misconfig');
  });

  it('detects old snapshots', () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    const vms = [{ vmName: 'vm1', cpus: 4, memory: 4096, template: false, powerState: 'poweredOn' }] as RVToolsData['vInfo'];
    const snapshots = [{
      vmName: 'vm1',
      powerState: 'poweredOn',
      snapshotName: 'old-snap',
      description: null,
      dateTime: oldDate,
      filename: 'snap.vmdk',
      sizeVmsnMiB: 100,
      sizeTotalMiB: 100,
      quiesced: false,
      state: 'active',
      annotation: null,
      datacenter: 'dc1',
      cluster: 'cl1',
      host: 'h1',
      folder: 'f1',
    }] as RVToolsData['vSnapshot'];

    const result = buildAnomalyInput(makeRVToolsData({ vInfo: vms, vSnapshot: snapshots }));
    const snapAnomaly = result.anomalyCandidates.find(c => c.category === 'storage-anomaly');
    expect(snapAnomaly).toBeDefined();
    expect(snapAnomaly!.affectedCount).toBe(1);
  });

  it('detects powered-off VMs', () => {
    const vms = [
      { vmName: 'vm1', cpus: 4, memory: 4096, template: false, powerState: 'poweredOff' },
      { vmName: 'vm2', cpus: 4, memory: 4096, template: false, powerState: 'poweredOn' },
    ] as RVToolsData['vInfo'];

    const result = buildAnomalyInput(makeRVToolsData({ vInfo: vms }));
    const offAnomaly = result.anomalyCandidates.find(c => c.category === 'migration-risk');
    expect(offAnomaly).toBeDefined();
    expect(offAnomaly!.affectedCount).toBe(1);
  });

  it('detects templates', () => {
    const vms = [
      { vmName: 'template1', cpus: 4, memory: 4096, template: true, powerState: 'poweredOff' },
      { vmName: 'vm1', cpus: 4, memory: 4096, template: false, powerState: 'poweredOn' },
    ] as RVToolsData['vInfo'];

    const result = buildAnomalyInput(makeRVToolsData({ vInfo: vms }));
    const templateAnomaly = result.anomalyCandidates.find(c => c.description.includes('template'));
    expect(templateAnomaly).toBeDefined();
  });

  it('detects missing VMware tools', () => {
    const vms = [{ vmName: 'vm1', cpus: 4, memory: 4096, template: false, powerState: 'poweredOn' }] as RVToolsData['vInfo'];
    const tools = [{
      vmName: 'vm1',
      powerState: 'poweredOn',
      template: false,
      vmVersion: '19',
      toolsStatus: 'toolsNotInstalled',
      toolsVersion: null,
      requiredVersion: null,
      upgradeable: false,
      upgradePolicy: 'manual',
      syncTime: false,
      appStatus: null,
      heartbeatStatus: null,
      kernelCrashState: null,
      operationReady: false,
    }] as RVToolsData['vTools'];

    const result = buildAnomalyInput(makeRVToolsData({ vInfo: vms, vTools: tools }));
    const toolsAnomaly = result.anomalyCandidates.find(c => c.category === 'security-concern');
    expect(toolsAnomaly).toBeDefined();
  });
});
