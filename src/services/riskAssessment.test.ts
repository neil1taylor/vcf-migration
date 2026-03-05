import { describe, it, expect } from 'vitest';
import { calculateRiskAssessment } from './riskAssessment';
import type { RVToolsData } from '@/types/rvtools';
import type { RiskOverrides, CostComparisonInput } from '@/types/riskAssessment';

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
    expect(Object.keys(result.domains)).toHaveLength(6);
  });

  it('calculates risk domains from RVTools data', () => {
    const data = createMinimalRVToolsData();
    const result = calculateRiskAssessment(data);

    expect(result.domains.cost).toBeDefined();
    expect(result.domains.readiness).toBeDefined();
    expect(result.domains.security).toBeDefined();
    expect(result.domains.operational).toBeDefined();
    expect(result.domains.compliance).toBeDefined();
    expect(result.domains.timeline).toBeDefined();

    // With 2 small VMs, cost should be low
    expect(result.domains.cost.effectiveSeverity).toBe('low');
  });

  it('marks 4 manual domains correctly', () => {
    const data = createMinimalRVToolsData();
    const result = calculateRiskAssessment(data);

    expect(result.domains.security.mode).toBe('manual');
    expect(result.domains.operational.mode).toBe('manual');
    expect(result.domains.compliance.mode).toBe('manual');
    expect(result.domains.timeline.mode).toBe('manual');
    expect(result.domains.security.autoSeverity).toBeNull();
    expect(result.domains.operational.autoSeverity).toBeNull();
    expect(result.domains.compliance.autoSeverity).toBeNull();
    expect(result.domains.timeline.autoSeverity).toBeNull();
  });

  it('marks cost and readiness as auto mode', () => {
    const data = createMinimalRVToolsData();
    const result = calculateRiskAssessment(data);

    expect(result.domains.cost.mode).toBe('auto');
    expect(result.domains.readiness.mode).toBe('auto');
  });

  it('readiness domain includes pre-flight and complexity evidence', () => {
    const data = createMinimalRVToolsData();
    const result = calculateRiskAssessment(data);

    const labels = result.domains.readiness.evidence.map(e => e.label);
    // Should have both pre-flight and complexity prefixed evidence
    expect(labels.some(l => l.startsWith('Pre-flight:') || l.startsWith('Complexity:'))).toBe(true);
  });

  it('applies overrides', () => {
    const data = createMinimalRVToolsData();
    const overrides: RiskOverrides = {
      version: 2,
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
      version: 2,
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
      version: 2,
      environmentFingerprint: '',
      domainOverrides: {
        security: { severity: 'high' },
      },
      createdAt: '',
      modifiedAt: '',
    };

    const result = calculateRiskAssessment(data, overrides);
    expect(['conditional', 'no-go']).toContain(result.goNoGo);
    expect(result.domains.security.effectiveSeverity).toBe('high');
  });

  it('includes evidence for auto-calculated domains', () => {
    const data = createMinimalRVToolsData();
    const result = calculateRiskAssessment(data);

    expect(result.domains.cost.evidence.length).toBeGreaterThan(0);
    expect(result.domains.readiness.evidence.length).toBeGreaterThan(0);
  });

  // Cost comparison tests
  describe('cost comparison', () => {
    it('shows low severity when costs decrease', () => {
      const data = createMinimalRVToolsData();
      const costInput: CostComparisonInput = {
        currentMonthlyCost: 10000,
        calculatedROKSMonthlyCost: 8000,
        calculatedVSIMonthlyCost: 9000,
      };

      const result = calculateRiskAssessment(data, undefined, costInput);
      expect(result.domains.cost.effectiveSeverity).toBe('low');
      expect(result.domains.cost.evidence.some(e => e.label === 'Cost comparison')).toBe(true);
    });

    it('shows medium severity for 20-50% increase', () => {
      const data = createMinimalRVToolsData();
      const costInput: CostComparisonInput = {
        currentMonthlyCost: 10000,
        calculatedROKSMonthlyCost: 14000,
        calculatedVSIMonthlyCost: 13000,
      };

      const result = calculateRiskAssessment(data, undefined, costInput);
      expect(result.domains.cost.effectiveSeverity).toBe('medium');
    });

    it('shows high severity for 50-100% increase', () => {
      const data = createMinimalRVToolsData();
      const costInput: CostComparisonInput = {
        currentMonthlyCost: 10000,
        calculatedROKSMonthlyCost: 18000,
        calculatedVSIMonthlyCost: 16000,
      };

      const result = calculateRiskAssessment(data, undefined, costInput);
      expect(result.domains.cost.effectiveSeverity).toBe('high');
    });

    it('shows critical severity for >100% increase', () => {
      const data = createMinimalRVToolsData();
      const costInput: CostComparisonInput = {
        currentMonthlyCost: 10000,
        calculatedROKSMonthlyCost: 25000,
        calculatedVSIMonthlyCost: 22000,
      };

      const result = calculateRiskAssessment(data, undefined, costInput);
      expect(result.domains.cost.effectiveSeverity).toBe('critical');
    });

    it('falls back to VM count heuristic without current cost', () => {
      const data = createMinimalRVToolsData();
      const result = calculateRiskAssessment(data);

      // With 2 VMs and no current cost, should show tip
      expect(result.domains.cost.evidence.some(e => e.label === 'Tip')).toBe(true);
    });

    it('uses the lower of ROKS/VSI for comparison', () => {
      const data = createMinimalRVToolsData();
      const costInput: CostComparisonInput = {
        currentMonthlyCost: 10000,
        calculatedROKSMonthlyCost: 25000, // 150% increase
        calculatedVSIMonthlyCost: 11000,  // 10% increase
      };

      // Should use VSI (lower) → 10% increase → low severity
      const result = calculateRiskAssessment(data, undefined, costInput);
      expect(result.domains.cost.effectiveSeverity).toBe('low');
    });
  });
});
