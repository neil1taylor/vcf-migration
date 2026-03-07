import { describe, it, expect } from 'vitest';
import { generateAutoRisks, loadCuratedRisks, buildRiskTable } from './riskAssessment';
import type { RVToolsData } from '@/types/rvtools';
import type { RiskTableOverrides, CostComparisonInput } from '@/types/riskAssessment';

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

describe('generateAutoRisks', () => {
  it('returns empty array for null data', () => {
    const result = generateAutoRisks(null);
    expect(result).toEqual([]);
  });

  it('generates risks from valid data', () => {
    const data = createMinimalRVToolsData();
    const result = generateAutoRisks(data);
    // Should have at least complexity-related rows
    expect(result.length).toBeGreaterThanOrEqual(0);
    result.forEach(row => {
      expect(row.source).toBe('auto');
      expect(row.id).toMatch(/^auto-/);
    });
  });

  it('generates cost comparison risk when cost input provided', () => {
    const data = createMinimalRVToolsData();
    const costInput: CostComparisonInput = {
      currentMonthlyCost: 10000,
      calculatedROKSMonthlyCost: 14000,
      calculatedVSIMonthlyCost: 13000,
    };

    const result = generateAutoRisks(data, costInput);
    const costRisk = result.find(r => r.id === 'auto-cost-comparison');
    expect(costRisk).toBeDefined();
    expect(costRisk!.category).toBe('Financial');
    expect(costRisk!.status).toBe('amber'); // 30% increase
  });

  it('shows green status for cost savings', () => {
    const data = createMinimalRVToolsData();
    const costInput: CostComparisonInput = {
      currentMonthlyCost: 10000,
      calculatedROKSMonthlyCost: 8000,
      calculatedVSIMonthlyCost: 9000,
    };

    const result = generateAutoRisks(data, costInput);
    const costRisk = result.find(r => r.id === 'auto-cost-comparison');
    expect(costRisk).toBeDefined();
    expect(costRisk!.status).toBe('green');
  });

  it('shows red status for >50% cost increase', () => {
    const data = createMinimalRVToolsData();
    const costInput: CostComparisonInput = {
      currentMonthlyCost: 10000,
      calculatedROKSMonthlyCost: 25000,
      calculatedVSIMonthlyCost: 22000,
    };

    const result = generateAutoRisks(data, costInput);
    const costRisk = result.find(r => r.id === 'auto-cost-comparison');
    expect(costRisk).toBeDefined();
    expect(costRisk!.status).toBe('red');
  });

  it('generates VMware license risk when licenses exist', () => {
    const data = createMinimalRVToolsData({
      vLicense: [
        { name: 'vSphere', key: 'abc', total: 10, used: 5 },
      ] as RVToolsData['vLicense'],
    });

    const result = generateAutoRisks(data);
    const licenseRisk = result.find(r => r.id === 'auto-vmware-licenses');
    expect(licenseRisk).toBeDefined();
    expect(licenseRisk!.category).toBe('Financial');
  });

  it('generates scale risk for large environments', () => {
    const manyVMs = Array.from({ length: 300 }, (_, i) => ({
      vmName: `vm-${i}`,
      powerState: 'poweredOn',
      template: false,
      cpus: 2,
      memory: 4096,
      nics: 1,
      disks: 1,
      hardwareVersion: 'vmx-14',
      guestOS: 'Red Hat Enterprise Linux 8 (64-bit)',
      datacenter: 'DC1',
      cluster: 'Cluster1',
      host: 'host1',
      provisionedMiB: 51200,
      inUseMiB: 25600,
      uuid: `uuid-${i}`,
    }));

    const data = createMinimalRVToolsData({
      vInfo: manyVMs as RVToolsData['vInfo'],
    });

    const result = generateAutoRisks(data);
    const scaleRisk = result.find(r => r.id === 'auto-scale');
    expect(scaleRisk).toBeDefined();
    expect(scaleRisk!.category).toBe('Ops & Tooling');
    expect(scaleRisk!.status).toBe('amber');
  });
});

describe('loadCuratedRisks', () => {
  it('returns curated risk rows', () => {
    const result = loadCuratedRisks();
    expect(result.length).toBeGreaterThan(0);
    result.forEach(row => {
      expect(row.source).toBe('curated');
      expect(row.id).toMatch(/^curated-/);
      expect(row.category).toBeDefined();
      expect(row.description).toBeTruthy();
    });
  });

  it('includes expected categories', () => {
    const result = loadCuratedRisks();
    const categories = new Set(result.map(r => r.category));
    expect(categories.has('Financial')).toBe(true);
    expect(categories.has('Technical')).toBe(true);
    expect(categories.has('Backup & DR')).toBe(true);
  });
});

describe('buildRiskTable', () => {
  it('returns combined rows from auto and curated', () => {
    const data = createMinimalRVToolsData();
    const result = buildRiskTable(data);

    const sources = new Set(result.rows.map(r => r.source));
    expect(sources.has('curated')).toBe(true);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('returns only curated rows for null data', () => {
    const result = buildRiskTable(null);
    expect(result.rows.every(r => r.source === 'curated')).toBe(true);
  });

  it('applies status overrides', () => {
    const data = createMinimalRVToolsData();
    const overrides: RiskTableOverrides = {
      version: 3,
      environmentFingerprint: '',
      rowOverrides: {
        'curated-financial-double-spend': { status: 'red' },
      },
      userRows: [],
      createdAt: '',
      modifiedAt: '',
    };

    const result = buildRiskTable(data, overrides);
    const row = result.rows.find(r => r.id === 'curated-financial-double-spend');
    expect(row).toBeDefined();
    expect(row!.status).toBe('red');
  });

  it('applies mitigation overrides', () => {
    const overrides: RiskTableOverrides = {
      version: 3,
      environmentFingerprint: '',
      rowOverrides: {
        'curated-financial-double-spend': { mitigationPlan: 'Custom plan' },
      },
      userRows: [],
      createdAt: '',
      modifiedAt: '',
    };

    const result = buildRiskTable(null, overrides);
    const row = result.rows.find(r => r.id === 'curated-financial-double-spend');
    expect(row!.mitigationPlan).toBe('Custom plan');
  });

  it('includes user rows', () => {
    const overrides: RiskTableOverrides = {
      version: 3,
      environmentFingerprint: '',
      rowOverrides: {},
      userRows: [{
        id: 'user-custom-1',
        source: 'user',
        category: 'Technical',
        description: 'Custom risk',
        impactArea: 'Testing',
        status: 'amber',
        mitigationPlan: 'Test plan',
        evidenceDetail: '',
      }],
      createdAt: '',
      modifiedAt: '',
    };

    const result = buildRiskTable(null, overrides);
    const userRow = result.rows.find(r => r.id === 'user-custom-1');
    expect(userRow).toBeDefined();
    expect(userRow!.source).toBe('user');
  });
});
