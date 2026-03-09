import { describe, it, expect } from 'vitest';
import { buildVPCDesign } from './vpcDesignService';
import type { RVToolsData } from '@/types/rvtools';

function createMinimalData(): RVToolsData {
  return {
    metadata: { fileName: 'test.xlsx', collectionDate: new Date('2024-01-01'), vCenterVersion: null, environment: null },
    vInfo: [
      { vmName: 'web1', powerState: 'poweredOn', template: false, cpus: 4, memory: 8192, nics: 1, disks: 1, guestOS: 'Linux', datacenter: 'DC1', cluster: 'C1', host: 'h1', provisionedMiB: 102400, inUseMiB: 51200, uuid: 'u1' },
      { vmName: 'db1', powerState: 'poweredOn', template: false, cpus: 8, memory: 16384, nics: 1, disks: 2, guestOS: 'Linux', datacenter: 'DC1', cluster: 'C1', host: 'h1', provisionedMiB: 204800, inUseMiB: 102400, uuid: 'u2' },
      { vmName: 'tmpl', powerState: 'poweredOff', template: true, cpus: 2, memory: 4096, nics: 1, disks: 1, guestOS: 'Linux', datacenter: 'DC1', cluster: 'C1', host: 'h1', provisionedMiB: 51200, inUseMiB: 25600, uuid: 'u3' },
    ] as RVToolsData['vInfo'],
    vCPU: [],
    vMemory: [],
    vDisk: [],
    vPartition: [],
    vNetwork: [
      { vmName: 'web1', networkName: 'Web-PG', ipv4Address: '10.0.1.1' },
      { vmName: 'db1', networkName: 'DB-PG', ipv4Address: '10.0.2.1' },
      { vmName: 'tmpl', networkName: 'Web-PG', ipv4Address: '' },
    ] as RVToolsData['vNetwork'],
    vCD: [],
    vSnapshot: [],
    vTools: [],
    vCluster: [],
    vHost: [],
    vDatastore: [],
    vResourcePool: [],
    vLicense: [],
    vHealth: [],
    vSource: [],
  };
}

describe('buildVPCDesign', () => {
  it('returns empty design with null data', () => {
    const design = buildVPCDesign(null, 'us-south', {}, {});
    expect(design.region).toBe('us-south');
    expect(design.subnets).toHaveLength(0);
    expect(design.zones).toHaveLength(3);
  });

  it('maps port groups to subnets', () => {
    const data = createMinimalData();
    const design = buildVPCDesign(data, 'us-south', {}, {
      web1: 'Web Server',
      db1: 'Database',
    });

    expect(design.subnets.length).toBeGreaterThanOrEqual(2);
    expect(design.subnets.some(s => s.sourcePortGroup === 'Web-PG')).toBe(true);
    expect(design.subnets.some(s => s.sourcePortGroup === 'DB-PG')).toBe(true);
  });

  it('excludes templates and powered-off VMs', () => {
    const data = createMinimalData();
    const design = buildVPCDesign(data, 'us-south', {}, {});

    const totalVMs = design.subnets.reduce((sum, s) => sum + s.vmCount, 0);
    expect(totalVMs).toBe(2); // web1 + db1, not tmpl
  });

  it('distributes subnets across zones', () => {
    const data = createMinimalData();
    const design = buildVPCDesign(data, 'us-south', {}, {});

    // Should have 3 zones
    expect(design.zones).toHaveLength(3);
    // At least one zone should have subnets
    expect(design.zones.some(z => z.subnets.length > 0)).toBe(true);
  });

  it('generates security groups', () => {
    const data = createMinimalData();
    const design = buildVPCDesign(data, 'us-south', {}, {
      web1: 'Web Server',
      db1: 'Database',
    });

    expect(design.securityGroups.length).toBeGreaterThanOrEqual(1);
    design.securityGroups.forEach(sg => {
      expect(sg.inboundRules.length).toBeGreaterThan(0);
      expect(sg.outboundRules.length).toBeGreaterThan(0);
    });
  });

  it('generates ACL suggestions for each subnet', () => {
    const data = createMinimalData();
    const design = buildVPCDesign(data, 'us-south', {}, {});

    expect(design.aclSuggestions).toHaveLength(design.subnets.length);
    design.aclSuggestions.forEach(acl => {
      expect(acl.rules.length).toBeGreaterThan(0);
    });
  });

  it('uses subnet overrides when provided', () => {
    const data = createMinimalData();
    const design = buildVPCDesign(data, 'us-south', { 'Web-PG': '10.100.0.0/24' }, {});

    const webSubnet = design.subnets.find(s => s.sourcePortGroup === 'Web-PG');
    expect(webSubnet?.cidr).toBe('10.100.0.0/24');
  });

  it('guesses subnets from VM IPs when no override exists', () => {
    const data = createMinimalData();
    const design = buildVPCDesign(data, 'us-south', {}, {});

    const webSubnet = design.subnets.find(s => s.sourcePortGroup === 'Web-PG');
    expect(webSubnet?.cidr).toBe('10.0.1.0/24');

    const dbSubnet = design.subnets.find(s => s.sourcePortGroup === 'DB-PG');
    expect(dbSubnet?.cidr).toBe('10.0.2.0/24');
  });

  it('guesses multiple subnets when port group has IPs in different ranges', () => {
    const data = createMinimalData();
    // Add a second VM on Web-PG with a different IP prefix
    data.vInfo.push({
      vmName: 'web2', powerState: 'poweredOn', template: false, cpus: 2, memory: 4096,
      nics: 1, disks: 1, guestOS: 'Linux', datacenter: 'DC1', cluster: 'C1', host: 'h1',
      provisionedMiB: 51200, inUseMiB: 25600, uuid: 'u4',
    } as RVToolsData['vInfo'][0]);
    data.vNetwork.push(
      { vmName: 'web2', networkName: 'Web-PG', ipv4Address: '10.0.5.10' } as RVToolsData['vNetwork'][0],
    );

    const design = buildVPCDesign(data, 'us-south', {}, {});
    const webSubnet = design.subnets.find(s => s.sourcePortGroup === 'Web-PG');
    expect(webSubnet?.cidr).toBe('10.0.1.0/24, 10.0.5.0/24');
  });

  it('prefers user override over guessed subnet', () => {
    const data = createMinimalData();
    const design = buildVPCDesign(data, 'us-south', { 'Web-PG': '192.168.1.0/24' }, {});

    const webSubnet = design.subnets.find(s => s.sourcePortGroup === 'Web-PG');
    expect(webSubnet?.cidr).toBe('192.168.1.0/24');
  });

  it('defaults to empty transit gateways', () => {
    const design = buildVPCDesign(null, 'us-south', {}, {});
    expect(design.transitGateways).toEqual([]);
  });

  it('uses transit gateways from design overrides', () => {
    const data = createMinimalData();
    const overrides = {
      version: 2,
      environmentFingerprint: '',
      region: 'us-south',
      subnetOverrides: {},
      transitGateways: [
        { id: 'tgw-1', name: 'tgw-us-south-1', enabled: true, connections: [
          { id: 'conn-1', connectionType: 'vpc' as const, name: 'conn-vpc' },
        ]},
      ],
      createdAt: '',
      modifiedAt: '',
    };
    const design = buildVPCDesign(data, 'us-south', {}, {}, overrides);
    expect(design.transitGateways).toHaveLength(1);
    expect(design.transitGateways[0].connections).toHaveLength(1);
  });
});
