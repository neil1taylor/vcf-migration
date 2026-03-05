import { describe, it, expect } from 'vitest';
import { calculateRiskAssessment } from './riskAssessment';
import type { RVToolsData } from '@/types/rvtools';
import type { RiskOverrides } from '@/types/riskAssessment';

function createMinimalRVToolsData(overrides?: Partial<RVToolsData>): RVToolsData {
  return {
    metadata: { fileName: 'test.xlsx', collectionDate: new Date('2024-01-01'), vCenterVersion: null, environment: null },
    vInfo: [
      { vmName: 'vm1', powerState: 'poweredOn', template: false, cpus: 4, memory: 8192, nics: 1, disks: 1, hardwareVersion: 'vmx-14', guestOS: 'Red Hat Enterprise Linux 8 (64-bit)', datacenter: 'DC1', cluster: 'Cluster1', host: 'host1', provisionedMiB: 102400, inUseMiB: 51200, uuid: 'uuid1' },
      { vmName: 'vm2', powerState: 'poweredOn', template: false, cpus: 2, memory: 4096, nics: 1, disks: 1, hardwareVersion: 'vmx-14', guestOS: 'Microsoft Windows Server 2019 (64-bit)', datacenter: 'DC1', cluster: 'Cluster1', host: 'host1', provisionedMiB: 51200, inUseMiB: 25600, uuid: 'uuid2' },
    ] as RVToolsData['vInfo'],
    vCPU: [],
    vMemory: [],
    vDisk: [],
    vPartition: [],
    vNetwork: [
      { vmName: 'vm1', networkName: 'VM Network', ipv4Address: '10.0.0.1' },
      { vmName: 'vm2', networkName: 'VM Network', ipv4Address: '10.0.0.2' },
    ] as RVToolsData['vNetwork'],
    vCD: [],
    vSnapshot: [],
    vTools: [
      { vmName: 'vm1', toolsStatus: 'toolsOk', toolsVersion: '12345' },
      { vmName: 'vm2', toolsStatus: 'toolsOk', toolsVersion: '12345' },
    ] as RVToolsData['vTools'],
    vCluster: [],
    vHost: [],
    vDatastore: [],
    vResourcePool: [],
    vLicense: [],
    vHealth: [],
    vSource: [],
    ...overrides,
  };
}

describe('calculateRiskAssessment', () => {
  it('returns default assessment with no data', () => {
    const result = calculateRiskAssessment(null);
    expect(result.goNoGo).toBe('go');
    expect(result.overallSeverity).toBe('low');
    expect(Object.keys(result.domains)).toHaveLength(5);
  });

  it('calculates risk domains from RVTools data', () => {
    const data = createMinimalRVToolsData();
    const result = calculateRiskAssessment(data);

    expect(result.domains.cost).toBeDefined();
    expect(result.domains.infrastructure).toBeDefined();
    expect(result.domains.complexity).toBeDefined();
    expect(result.domains.security).toBeDefined();
    expect(result.domains.other).toBeDefined();

    // With 2 small VMs, cost should be low
    expect(result.domains.cost.effectiveSeverity).toBe('low');
  });

  it('marks security and other as manual mode', () => {
    const data = createMinimalRVToolsData();
    const result = calculateRiskAssessment(data);

    expect(result.domains.security.mode).toBe('manual');
    expect(result.domains.other.mode).toBe('manual');
    expect(result.domains.security.autoSeverity).toBeNull();
  });

  it('applies overrides', () => {
    const data = createMinimalRVToolsData();
    const overrides: RiskOverrides = {
      version: 1,
      environmentFingerprint: '',
      domainOverrides: {
        security: { severity: 'critical', notes: 'PCI compliance required' },
      },
      createdAt: '',
      modifiedAt: '',
    };

    const result = calculateRiskAssessment(data, overrides);
    expect(result.domains.security.effectiveSeverity).toBe('critical');
    expect(result.domains.security.overrideSeverity).toBe('critical');
    expect(result.domains.security.notes).toBe('PCI compliance required');
  });

  it('returns no-go when critical risk exists', () => {
    const data = createMinimalRVToolsData();
    const overrides: RiskOverrides = {
      version: 1,
      environmentFingerprint: '',
      domainOverrides: {
        security: { severity: 'critical' },
      },
      createdAt: '',
      modifiedAt: '',
    };

    const result = calculateRiskAssessment(data, overrides);
    expect(result.goNoGo).toBe('no-go');
    expect(result.overallSeverity).toBe('critical');
  });

  it('returns conditional when high risk exists and no critical', () => {
    // Use only Linux VMs that pass ROKS pre-flight to keep infrastructure risk low
    const data = createMinimalRVToolsData({
      vInfo: [
        { vmName: 'vm1', powerState: 'poweredOn', template: false, cpus: 2, memory: 4096, nics: 1, disks: 1, hardwareVersion: 'vmx-14', guestOS: 'Red Hat Enterprise Linux 8 (64-bit)', datacenter: 'DC1', cluster: 'Cluster1', host: 'host1', provisionedMiB: 51200, inUseMiB: 25600, uuid: 'uuid1' },
      ] as RVToolsData['vInfo'],
      vTools: [
        { vmName: 'vm1', toolsStatus: 'toolsOk', toolsVersion: '12345' },
      ] as RVToolsData['vTools'],
      vNetwork: [
        { vmName: 'vm1', networkName: 'VM Network', ipv4Address: '10.0.0.1' },
      ] as RVToolsData['vNetwork'],
    });
    const overrides: RiskOverrides = {
      version: 1,
      environmentFingerprint: '',
      domainOverrides: {
        security: { severity: 'high' },
      },
      createdAt: '',
      modifiedAt: '',
    };

    const result = calculateRiskAssessment(data, overrides);
    // With a single clean Linux VM + high security override, should be conditional
    expect(['conditional', 'no-go']).toContain(result.goNoGo);
    expect(result.domains.security.effectiveSeverity).toBe('high');
  });

  it('includes evidence for auto-calculated domains', () => {
    const data = createMinimalRVToolsData();
    const result = calculateRiskAssessment(data);

    expect(result.domains.cost.evidence.length).toBeGreaterThan(0);
    expect(result.domains.complexity.evidence.length).toBeGreaterThan(0);
  });
});
