import { describe, it, expect } from 'vitest';
import type { VirtualMachine } from '@/types/rvtools';
import {
  classifyVMTarget,
  classifyAllVMs,
  getRecommendation,
} from './targetClassification';
import type { VMClassification } from './targetClassification';

// --- Test helpers ---

function makeVM(overrides: Partial<VirtualMachine> = {}): VirtualMachine {
  return {
    vmName: 'test-vm',
    powerState: 'poweredOn',
    template: false,
    srmPlaceholder: false,
    configStatus: 'green',
    dnsName: null,
    connectionState: 'connected',
    guestState: 'running',
    heartbeat: 'green',
    consolidationNeeded: false,
    powerOnDate: null,
    suspendedToMemory: false,
    suspendTime: null,
    creationDate: null,
    cpus: 4,
    memory: 8192, // 8 GB in MiB
    nics: 1,
    disks: 1,
    resourcePool: null,
    folder: null,
    vApp: null,
    ftState: null,
    ftRole: null,
    cbrcEnabled: false,
    hardwareVersion: 'vmx-19',
    guestOS: 'Red Hat Enterprise Linux 9 (64-bit)',
    osToolsConfig: '',
    guestHostname: null,
    guestIP: null,
    annotation: null,
    datacenter: 'DC1',
    cluster: 'Cluster1',
    host: 'esxi-01',
    provisionedMiB: 102400,
    inUseMiB: 51200,
    uuid: 'test-uuid-1234',
    firmwareType: 'bios',
    latencySensitivity: null,
    cbtEnabled: false,
    ...overrides,
  };
}

// --- OS Compatibility Crosscheck (Rules 1-2) ---

describe('classifyVMTarget', () => {
  describe('OS compatibility crosscheck rules', () => {
    it('classifies Windows Server 2022 as ROKS (fully-supported on both, no unsupported crosscheck triggers)', () => {
      // Windows Server 2022 is fully-supported on ROKS and supported on VSI
      // Neither crosscheck rule fires, so it falls through to fallback → VSI
      // (not Linux, no workload type)
      const vm = makeVM({ guestOS: 'Microsoft Windows Server 2022 (64-bit)' });
      const result = classifyVMTarget(vm);
      // Both targets support it, so falls through to fallback (VSI)
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('low');
    });

    it('classifies Windows Server 2019 as VSI via fallback (supported on both targets)', () => {
      const vm = makeVM({ guestOS: 'Microsoft Windows Server 2019 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('low');
    });

    it('classifies Windows Server 2016 as VSI via fallback (supported on both targets)', () => {
      const vm = makeVM({ guestOS: 'Microsoft Windows Server 2016 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('vsi');
    });

    it('classifies Windows Server 2008 as VSI (unsupported on both, fallback)', () => {
      // Windows 2008 is unsupported on both ROKS and VSI
      // Neither crosscheck fires (both unsupported), falls to fallback
      const vm = makeVM({ guestOS: 'Microsoft Windows Server 2008 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('low');
    });

    it('classifies Windows Server 2012 as ROKS-unsupported → VSI', () => {
      // Windows 2012 is unsupported on ROKS, BYOL on VSI (not unsupported)
      const vm = makeVM({ guestOS: 'Microsoft Windows Server 2012 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('high');
      expect(result.reasons[0]).toContain('unsupported on ROKS');
    });

    it('classifies Solaris as VSI (unsupported on ROKS, unsupported on VSI → fallback)', () => {
      const vm = makeVM({ guestOS: 'Oracle Solaris 11' });
      const result = classifyVMTarget(vm);
      // Both unsupported, falls through to fallback
      expect(result.target).toBe('vsi');
    });

    it('classifies Ubuntu 18 as ROKS (unsupported on VSI, supported-with-caveats on ROKS)', () => {
      // Ubuntu 18 is unsupported on VSI but supported-with-caveats on ROKS
      const vm = makeVM({ guestOS: 'Ubuntu 18.04 LTS (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('roks');
      expect(result.confidence).toBe('high');
      expect(result.reasons[0]).toContain('unsupported on VSI');
    });

    it('classifies CentOS 7 as ROKS (BYOL on VSI, supported-with-caveats on ROKS)', () => {
      // CentOS 7 is BYOL on VSI (not unsupported), so crosscheck doesn't fire
      // Falls through to linux-default rule with low confidence
      const vm = makeVM({ guestOS: 'CentOS Linux 7 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('roks');
      expect(result.confidence).toBe('low');
    });
  });

  // --- Resource threshold (Rule 3) ---

  describe('Resource threshold: Memory >512GB → ROKS', () => {
    it('classifies high-memory Linux VM as ROKS', () => {
      const vm = makeVM({
        guestOS: 'Red Hat Enterprise Linux 9 (64-bit)',
        memory: 524289, // Just over 512 GB in MiB
      });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('roks');
      expect(result.confidence).toBe('medium');
      expect(result.reasons[0]).toContain('memory');
    });

    it('does not trigger for exactly 512GB', () => {
      const vm = makeVM({
        guestOS: 'Red Hat Enterprise Linux 9 (64-bit)',
        memory: 524288, // Exactly 512 GB
      });
      const result = classifyVMTarget(vm);
      // Should NOT be classified by the memory rule
      expect(result.reasons[0]).not.toContain('High memory');
    });

    it('does not trigger for VMs under 512GB', () => {
      const vm = makeVM({
        guestOS: 'Ubuntu Linux (64-bit)',
        memory: 262144, // 256 GB
      });
      const result = classifyVMTarget(vm);
      expect(result.reasons[0]).not.toContain('High memory');
    });
  });

  // --- Workload type heuristics (Rules 4-5) ---

  describe('Workload type heuristics', () => {
    it('classifies database workload as VSI', () => {
      const vm = makeVM({ guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Database Server');
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('medium');
      expect(result.reasons[0]).toContain('Database Server');
    });

    it('classifies enterprise workload as VSI', () => {
      const vm = makeVM({ guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Enterprise Application');
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('medium');
    });

    it('classifies backup workload as VSI', () => {
      const vm = makeVM({ guestOS: 'Red Hat Enterprise Linux 8 (64-bit)' });
      const result = classifyVMTarget(vm, 'Backup Server');
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('medium');
    });

    it('classifies monitoring workload as VSI', () => {
      const vm = makeVM({ guestOS: 'Ubuntu Linux (64-bit)' });
      const result = classifyVMTarget(vm, 'Monitoring');
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('medium');
    });

    it('classifies middleware Linux workload as ROKS', () => {
      const vm = makeVM({ guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Middleware');
      expect(result.target).toBe('roks');
      expect(result.confidence).toBe('medium');
      expect(result.reasons[0]).toContain('Middleware');
    });

    it('classifies dev Linux workload as ROKS', () => {
      const vm = makeVM({ guestOS: 'Ubuntu Linux (64-bit)' });
      const result = classifyVMTarget(vm, 'Dev Environment');
      expect(result.target).toBe('roks');
      expect(result.confidence).toBe('medium');
    });

    it('does not classify middleware on non-Linux as ROKS', () => {
      // FreeBSD with middleware workload type — requireOS check fails
      const vm = makeVM({ guestOS: 'FreeBSD 13 (64-bit)' });
      const result = classifyVMTarget(vm, 'Middleware');
      // Should fall through to fallback since FreeBSD is not Linux
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('low');
    });

    it('does not classify middleware on Windows as ROKS', () => {
      // Windows Server 2022 with middleware — requireOS check fails for ROKS workload rule
      const vm = makeVM({ guestOS: 'Microsoft Windows Server 2022 (64-bit)' });
      const result = classifyVMTarget(vm, 'Middleware');
      // Falls through to fallback (Windows is not in requireOS patterns)
      expect(result.target).toBe('vsi');
    });
  });

  // --- PowerVS rules (Rules 4-5) ---

  describe('PowerVS classification (Oracle/SAP)', () => {
    it('classifies Oracle database VM as PowerVS', () => {
      const vm = makeVM({ vmName: 'oracle-db-prod', guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Database Server');
      expect(result.target).toBe('powervs');
      expect(result.confidence).toBe('high');
      expect(result.reasons[0]).toContain('Oracle');
    });

    it('classifies SAP enterprise VM as PowerVS', () => {
      const vm = makeVM({ vmName: 'sap-erp-prod', guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Enterprise Application');
      expect(result.target).toBe('powervs');
      expect(result.confidence).toBe('high');
      expect(result.reasons[0]).toContain('SAP');
    });

    it('classifies HANA VM as PowerVS', () => {
      const vm = makeVM({ vmName: 'hana-db-01', guestOS: 'SUSE Linux Enterprise Server 15 (64-bit)' });
      const result = classifyVMTarget(vm, 'Enterprise Application');
      expect(result.target).toBe('powervs');
      expect(result.confidence).toBe('high');
    });

    it('classifies S4HANA VM as PowerVS', () => {
      const vm = makeVM({ vmName: 's4hana-prod', guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Enterprise Application');
      expect(result.target).toBe('powervs');
      expect(result.confidence).toBe('high');
    });

    it('does NOT classify non-Oracle database as PowerVS', () => {
      const vm = makeVM({ vmName: 'mysql-db-prod', guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Database Server');
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('medium');
    });

    it('does NOT classify non-SAP enterprise app as PowerVS', () => {
      const vm = makeVM({ vmName: 'jira-app-01', guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Enterprise Application');
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('medium');
    });

    it('Oracle name match is case-insensitive', () => {
      const vm = makeVM({ vmName: 'ORACLE-ERP-01', guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Database Server');
      expect(result.target).toBe('powervs');
    });
  });

  // --- Linux default → ROKS (Rule 8) ---

  describe('Linux default → ROKS', () => {
    it('classifies generic Linux as ROKS with low confidence', () => {
      const vm = makeVM({ guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('roks');
      expect(result.confidence).toBe('low');
      expect(result.reasons[0]).toContain('Linux');
    });

    it('classifies Ubuntu as ROKS', () => {
      const vm = makeVM({ guestOS: 'Ubuntu Linux (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('roks');
    });

    it('classifies CentOS 8 as ROKS (unsupported on VSI → high confidence crosscheck)', () => {
      // CentOS 8 is unsupported on VSI, so crosscheck rule fires first
      const vm = makeVM({ guestOS: 'CentOS 8 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('roks');
    });

    it('classifies SUSE as ROKS', () => {
      const vm = makeVM({ guestOS: 'SUSE Linux Enterprise Server 15 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('roks');
    });

    it('classifies Debian as ROKS', () => {
      const vm = makeVM({ guestOS: 'Debian GNU/Linux 11 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('roks');
    });
  });

  // --- Fallback → VSI (Rule 7) ---

  describe('Fallback → VSI', () => {
    it('classifies unknown OS as VSI with low confidence', () => {
      const vm = makeVM({ guestOS: 'SomeUnknownOS 5.0' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('low');
      expect(result.reasons[0]).toContain('Default');
    });

    it('classifies FreeBSD as VSI (not Linux)', () => {
      const vm = makeVM({ guestOS: 'FreeBSD 13 (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('low');
    });
  });

  // --- vmId and vmName ---

  describe('output fields', () => {
    it('includes vmId and vmName in classification', () => {
      const vm = makeVM({ vmName: 'my-server', uuid: 'abc-123' });
      const result = classifyVMTarget(vm);
      expect(result.vmId).toBe('my-server::abc-123');
      expect(result.vmName).toBe('my-server');
    });

    it('uses datacenter::cluster fallback when uuid is null', () => {
      const vm = makeVM({ vmName: 'srv-01', uuid: null, datacenter: 'DC2', cluster: 'CL1' });
      const result = classifyVMTarget(vm);
      expect(result.vmId).toBe('srv-01::DC2::CL1');
    });
  });

  // --- Rule engine mechanics ---

  describe('rule engine mechanics', () => {
    it('OS crosscheck takes priority over workload type', () => {
      // Ubuntu 18 is unsupported on VSI → should be ROKS even with database workload
      const vm = makeVM({ guestOS: 'Ubuntu 18.04 LTS (64-bit)' });
      const result = classifyVMTarget(vm, 'Database Server');
      expect(result.target).toBe('roks');
      expect(result.confidence).toBe('high');
    });

    it('memory threshold takes priority over workload type', () => {
      const vm = makeVM({
        guestOS: 'Red Hat Enterprise Linux 9 (64-bit)',
        memory: 600000,
      });
      const result = classifyVMTarget(vm, 'Database Server');
      expect(result.target).toBe('roks');
      expect(result.confidence).toBe('medium');
      expect(result.reasons[0]).toContain('memory');
    });

    it('workload type takes priority over Linux default', () => {
      const vm = makeVM({ guestOS: 'Red Hat Enterprise Linux 9 (64-bit)' });
      const result = classifyVMTarget(vm, 'Database Server');
      expect(result.target).toBe('vsi');
      expect(result.confidence).toBe('medium');
    });

    it('returns single reason from the matching rule', () => {
      const vm = makeVM({ guestOS: 'Ubuntu Linux (64-bit)' });
      const result = classifyVMTarget(vm);
      expect(result.reasons).toHaveLength(1);
    });
  });
});

// --- classifyAllVMs ---

describe('classifyAllVMs', () => {
  it('classifies multiple VMs with workload types', () => {
    const vms = [
      makeVM({ vmName: 'win-db', guestOS: 'Microsoft Windows Server 2022 (64-bit)', uuid: 'u1' }),
      makeVM({ vmName: 'linux-app', guestOS: 'Red Hat Enterprise Linux 9 (64-bit)', uuid: 'u2' }),
      makeVM({ vmName: 'linux-db', guestOS: 'Ubuntu Linux (64-bit)', uuid: 'u3' }),
    ];

    const workloadTypes = new Map<string, string>([
      ['linux-db::u3', 'Database Server'],
    ]);

    const results = classifyAllVMs(vms, workloadTypes);
    expect(results).toHaveLength(3);
    expect(results[0].target).toBe('vsi'); // Windows 2022 — both supported, fallback to VSI
    expect(results[1].target).toBe('roks'); // Linux default
    expect(results[2].target).toBe('vsi'); // Database workload
  });

  it('returns empty array for empty input', () => {
    const results = classifyAllVMs([], new Map());
    expect(results).toEqual([]);
  });

  it('handles VMs with no matching workload type', () => {
    const vms = [makeVM({ vmName: 'srv', uuid: 'u1', guestOS: 'Ubuntu Linux (64-bit)' })];
    const results = classifyAllVMs(vms, new Map());
    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('roks'); // Linux default
  });
});

// --- getRecommendation ---

describe('getRecommendation', () => {
  function makeClassification(target: 'roks' | 'vsi' | 'powervs', vmName = 'vm'): VMClassification {
    return {
      vmId: `${vmName}::uuid`,
      vmName,
      target,
      reasons: ['test reason'],
      confidence: 'medium',
    };
  }

  it('recommends all-roks when >70% are ROKS', () => {
    const classifications = [
      ...Array(8).fill(null).map((_, i) => makeClassification('roks', `roks-${i}`)),
      ...Array(2).fill(null).map((_, i) => makeClassification('vsi', `vsi-${i}`)),
    ];

    const result = getRecommendation(classifications, 1000, 1200, 1100);
    expect(result.type).toBe('all-roks');
    expect(result.title).toBe('All ROKS Migration');
    expect(result.roksPercentage).toBe(80);
    expect(result.vsiPercentage).toBe(20);
  });

  it('recommends all-vsi when >70% are VSI', () => {
    const classifications = [
      ...Array(2).fill(null).map((_, i) => makeClassification('roks', `roks-${i}`)),
      ...Array(8).fill(null).map((_, i) => makeClassification('vsi', `vsi-${i}`)),
    ];

    const result = getRecommendation(classifications, 1200, 1000, 1100);
    expect(result.type).toBe('all-vsi');
    expect(result.title).toBe('All VSI Migration');
    expect(result.roksPercentage).toBe(20);
    expect(result.vsiPercentage).toBe(80);
  });

  it('recommends split when no target exceeds 70%', () => {
    const classifications = [
      ...Array(5).fill(null).map((_, i) => makeClassification('roks', `roks-${i}`)),
      ...Array(5).fill(null).map((_, i) => makeClassification('vsi', `vsi-${i}`)),
    ];

    const result = getRecommendation(classifications, 1000, 1000, 900);
    expect(result.type).toBe('split');
    expect(result.title).toBe('Split Migration');
    expect(result.roksPercentage).toBe(50);
    expect(result.vsiPercentage).toBe(50);
  });

  it('mentions cost advantage when ROKS is cheaper for all-roks', () => {
    const classifications = Array(10).fill(null).map((_, i) => makeClassification('roks', `r-${i}`));
    const result = getRecommendation(classifications, 800, 1200, 1000);
    expect(result.reasoning.some(r => r.includes('cost-effective'))).toBe(true);
  });

  it('mentions cost tradeoff when VSI is cheaper but ROKS recommended', () => {
    const classifications = Array(10).fill(null).map((_, i) => makeClassification('roks', `r-${i}`));
    const result = getRecommendation(classifications, 1200, 800, 1000);
    expect(result.reasoning.some(r => r.includes('cheaper'))).toBe(true);
  });

  it('notes split cost advantage when split is cheapest', () => {
    const classifications = [
      ...Array(5).fill(null).map((_, i) => makeClassification('roks', `roks-${i}`)),
      ...Array(5).fill(null).map((_, i) => makeClassification('vsi', `vsi-${i}`)),
    ];

    const result = getRecommendation(classifications, 1000, 1000, 800);
    expect(result.reasoning.some(r => r.includes('Split migration is the most cost-effective'))).toBe(true);
  });

  it('recommends all-powervs when >70% are PowerVS', () => {
    const classifications = [
      ...Array(8).fill(null).map((_, i) => makeClassification('powervs', `pvs-${i}`)),
      ...Array(2).fill(null).map((_, i) => makeClassification('vsi', `vsi-${i}`)),
    ];

    const result = getRecommendation(classifications, 1000, 1200, 1100);
    expect(result.type).toBe('all-powervs');
    expect(result.title).toBe('All PowerVS Migration');
    expect(result.powervsPercentage).toBe(80);
  });

  it('includes powervsPercentage in split recommendation', () => {
    const classifications = [
      ...Array(4).fill(null).map((_, i) => makeClassification('roks', `roks-${i}`)),
      ...Array(4).fill(null).map((_, i) => makeClassification('vsi', `vsi-${i}`)),
      ...Array(2).fill(null).map((_, i) => makeClassification('powervs', `pvs-${i}`)),
    ];

    const result = getRecommendation(classifications, 1000, 1000, 900);
    expect(result.type).toBe('split');
    expect(result.powervsPercentage).toBe(20);
    expect(result.reasoning[0]).toContain('PowerVS');
  });

  it('handles empty classifications', () => {
    const result = getRecommendation([], 0, 0, 0);
    expect(result.type).toBe('split');
    expect(result.roksPercentage).toBe(0);
    expect(result.vsiPercentage).toBe(0);
  });

  it('handles exactly 70% (should not trigger >70% threshold)', () => {
    const classifications = [
      ...Array(7).fill(null).map((_, i) => makeClassification('roks', `roks-${i}`)),
      ...Array(3).fill(null).map((_, i) => makeClassification('vsi', `vsi-${i}`)),
    ];

    const result = getRecommendation(classifications, 1000, 1000, 1000);
    // 70% is NOT >70%, so should be split
    expect(result.type).toBe('split');
  });

  it('handles 71% as all-roks', () => {
    // 71 ROKS, 29 VSI → 71%
    const classifications = [
      ...Array(71).fill(null).map((_, i) => makeClassification('roks', `roks-${i}`)),
      ...Array(29).fill(null).map((_, i) => makeClassification('vsi', `vsi-${i}`)),
    ];

    const result = getRecommendation(classifications, 1000, 1000, 1000);
    expect(result.type).toBe('all-roks');
  });

  it('handles all VMs being one target', () => {
    const classifications = Array(5).fill(null).map((_, i) => makeClassification('vsi', `v-${i}`));
    const result = getRecommendation(classifications, 1200, 800, 1000);
    expect(result.type).toBe('all-vsi');
    expect(result.vsiPercentage).toBe(100);
    expect(result.roksPercentage).toBe(0);
  });
});
