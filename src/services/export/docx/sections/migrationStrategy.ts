// Migration Strategy Section

import { Paragraph, Table, TableRow, PageBreak, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import type { RVToolsData, VirtualMachine, VNetworkInfo } from '@/types/rvtools';
import type { MigrationInsights } from '@/services/ai/types';
import { mibToGiB } from '@/utils/formatters';
import { calculateComplexityScores } from '@/services/migration/migrationAssessment';
import { buildVMWaveData, createComplexityWaves, createNetworkWaves } from '@/services/migration/wavePlanning';
import type { WaveGroup, NetworkWaveGroup } from '@/services/migration/wavePlanning';
import { STYLES, type DocumentContent, type NetworkWave, type WavePlanningPreference } from '../types';
import { createHeading, createParagraph, createBulletList, createTableCell, createAISection } from '../utils/helpers';

function buildLegacyNetworkWaves(rawData: RVToolsData): NetworkWave[] {
  const networks = rawData.vNetwork;
  const vms = rawData.vInfo.filter((vm: VirtualMachine) => vm.powerState === 'poweredOn' && !vm.template);

  const portGroupMap = new Map<string, {
    vSwitch: string;
    vmNames: Set<string>;
    ips: string[];
  }>();

  networks.forEach((nic: VNetworkInfo) => {
    const pg = nic.networkName || 'Unknown';
    if (!portGroupMap.has(pg)) {
      portGroupMap.set(pg, {
        vSwitch: nic.switchName || 'Unknown',
        vmNames: new Set(),
        ips: [],
      });
    }
    const data = portGroupMap.get(pg)!;
    data.vmNames.add(nic.vmName);
    if (nic.ipv4Address) {
      data.ips.push(nic.ipv4Address);
    }
  });

  const networkWaves: NetworkWave[] = [];
  portGroupMap.forEach((data, portGroup) => {
    const vmNames = Array.from(data.vmNames);
    const waveVMs = vms.filter((vm: VirtualMachine) => vmNames.includes(vm.vmName));

    let subnet = 'N/A';
    if (data.ips.length > 0) {
      const prefixCounts = new Map<string, number>();
      data.ips.forEach(ip => {
        const parts = ip.split('.');
        if (parts.length >= 3) {
          const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
          prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
        }
      });
      let maxCount = 0;
      let mostCommonPrefix = '';
      prefixCounts.forEach((count, prefix) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonPrefix = prefix;
        }
      });
      if (mostCommonPrefix) {
        subnet = `${mostCommonPrefix}.0/24`;
      }
    }

    networkWaves.push({
      portGroup,
      vSwitch: data.vSwitch,
      vmCount: waveVMs.length,
      vcpus: waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + vm.cpus, 0),
      memoryGiB: Math.round(waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.memory), 0)),
      storageGiB: Math.round(waveVMs.reduce((sum: number, vm: VirtualMachine) => sum + mibToGiB(vm.provisionedMiB), 0)),
      subnet,
    });
  });

  networkWaves.sort((a, b) => a.vmCount - b.vmCount);
  return networkWaves;
}

export function computeWavesForMode(
  rawData: RVToolsData,
  migrationMode: 'roks' | 'vsi',
  preference: WavePlanningPreference
): WaveGroup[] | NetworkWaveGroup[] {
  const vms = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  const complexityScores = calculateComplexityScores(vms, rawData.vDisk, rawData.vNetwork, migrationMode);
  const vmWaveData = buildVMWaveData(
    vms, complexityScores, rawData.vDisk, rawData.vSnapshot, rawData.vTools, rawData.vNetwork, migrationMode
  );

  if (preference.wavePlanningMode === 'complexity') {
    return createComplexityWaves(vmWaveData, migrationMode);
  }
  return createNetworkWaves(vmWaveData, preference.networkGroupBy);
}

export function buildWaveTable(waves: (WaveGroup | NetworkWaveGroup)[], isComplexity: boolean): Table {
  const headerCells = [
    createTableCell('Wave', { header: true }),
    createTableCell('Description', { header: true }),
    createTableCell('VMs', { header: true, align: AlignmentType.RIGHT }),
    createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
    createTableCell('Memory (GiB)', { header: true, align: AlignmentType.RIGHT }),
    createTableCell('Storage (GiB)', { header: true, align: AlignmentType.RIGHT }),
    createTableCell('Blockers', { header: true, align: AlignmentType.CENTER }),
  ];
  if (isComplexity) {
    headerCells.push(createTableCell('Avg Complexity', { header: true, align: AlignmentType.RIGHT }));
  }

  const rows = waves.map((wave, idx) => {
    const cells = [
      createTableCell(isComplexity ? wave.name : `Wave ${idx + 1}: ${wave.name.length > 20 ? wave.name.substring(0, 17) + '...' : wave.name}`),
      createTableCell(wave.description.length > 35 ? wave.description.substring(0, 32) + '...' : wave.description),
      createTableCell(`${wave.vmCount}`, { align: AlignmentType.RIGHT }),
      createTableCell(`${wave.vcpus}`, { align: AlignmentType.RIGHT }),
      createTableCell(`${wave.memoryGiB}`, { align: AlignmentType.RIGHT }),
      createTableCell(`${wave.storageGiB}`, { align: AlignmentType.RIGHT }),
      createTableCell(wave.hasBlockers ? 'Yes' : 'No', { align: AlignmentType.CENTER }),
    ];
    if (isComplexity) {
      const avg = wave.avgComplexity ?? (wave.vms.length > 0
        ? Math.round(wave.vms.reduce((s, v) => s + v.complexity, 0) / wave.vms.length)
        : 0);
      cells.push(createTableCell(`${avg}`, { align: AlignmentType.RIGHT }));
    }
    return new TableRow({ cantSplit: true, children: cells });
  });

  return new Table({
    width: { size: 100, type: 'pct' as const },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
    },
    rows: [new TableRow({ cantSplit: true, children: headerCells }), ...rows],
  });
}

export function getStrategyLabel(pref: WavePlanningPreference): string {
  if (pref.wavePlanningMode === 'complexity') return 'Complexity-Based';
  if (pref.networkGroupBy === 'cluster') return 'Network-Based (Cluster)';
  return 'Network-Based (Port Group)';
}

export function buildMigrationStrategy(
  rawData: RVToolsData,
  aiInsights?: MigrationInsights | null,
  wavePlanningPreference?: WavePlanningPreference | null,
  includeROKS: boolean = true,
  includeVSI: boolean = true,
  sectionNum?: number,
): DocumentContent[] {
  const s = sectionNum != null ? sectionNum : 5;
  const sections: DocumentContent[] = [
    createHeading(`${s}. Migration Strategy`, HeadingLevel.HEADING_1),
    createParagraph(
      'This section outlines the migration wave planning approach. Three strategies are available for organizing VM migration waves, each with different trade-offs.',
      { spacing: { after: 200 } }
    ),
    createParagraph(
      'The wave groupings presented here are preliminary suggestions based on environment data. The migration partner will refine wave composition based on application dependency mapping, business criticality, maintenance window constraints, and stakeholder availability.'
    ),

    createHeading(`${s}.1 Wave Planning Strategies`, HeadingLevel.HEADING_2),
    createParagraph(
      'The application supports three wave planning strategies for organizing the migration:',
      { spacing: { after: 120 } }
    ),

    createHeading('Complexity-Based', HeadingLevel.HEADING_3),
    createParagraph(
      'Organizes VMs into 5 progressive waves based on migration complexity scores: Pilot, Quick Wins, Standard, Complex, and Remediation. VMs with blockers are automatically placed in the Remediation wave. This approach assumes that the IP addressing of the VMs will change.',
      { spacing: { after: 80 } }
    ),
    ...createBulletList([
      'Best when: Heterogeneous environment with widely varying complexity, or when a risk-graduated rollout is desired.',
      'Pros: Natural pilot identification with lowest-complexity VMs, risk-ordered progression, blocker isolation.',
      'Cons: May split network-adjacent VMs across waves, requiring more network reconfiguration per wave including assigning new IP addresses to VMs.',
    ]),

    createHeading('Network-Based (Cluster)', HeadingLevel.HEADING_3),
    createParagraph(
      'Groups VMs by their VMware cluster. Each cluster becomes a migration wave, keeping co-located workloads together. This approach is also known as big-bang.',
      { spacing: { after: 80 } }
    ),
    ...createBulletList([
      'Best when: Clusters map to business units or application groups, or when big-bang per-cluster cutover is preferred.',
      'Pros: Preserves cluster affinity, simpler planning with fewer waves, aligns with existing operational boundaries.',
      'Cons: Large clusters produce large waves, uneven wave sizes.',
    ]),

    createHeading('Network-Based (Port Group)', HeadingLevel.HEADING_3),
    createParagraph(
      'Groups VMs by network port group (subnet). VMs sharing the same network segment migrate together.',
      { spacing: { after: 80 } }
    ),
    ...createBulletList([
      'Best when: Minimal network reconfiguration is desired, or subnet-aligned cutover is required and keeping the IP addresses of the VM is essential.',
      'Pros: Network continuity during migration, predictable wave boundaries, reduced split-brain scenarios.',
      'Cons: May split application tiers across waves if they span multiple subnets.',
    ]),
  ];

  sections.push(createHeading(`${s}.2 Selected Strategy`, HeadingLevel.HEADING_2));
  if (wavePlanningPreference) {
    const label = getStrategyLabel(wavePlanningPreference);
    sections.push(
      createParagraph(
        `The selected wave planning strategy in this documented assessment is: ${label}. The wave summaries below reflect this strategy applied to the environment data.`,
        { spacing: { after: 120 } }
      )
    );
  } else {
    sections.push(
      createParagraph(
        'No wave planning strategy was explicitly selected in the application. The default Network-Based (Port Group) wave summary from raw network data is shown below.',
        { spacing: { after: 120 } }
      )
    );
  }

  // Coexistence Network Considerations
  sections.push(
    createHeading(`${s}.3 Coexistence Network Considerations`, HeadingLevel.HEADING_2),
    createParagraph(
      'During migration, VMs will be split between the source and target environments. This coexistence period introduces network considerations that must be planned for:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Traffic between migrated and non-migrated VMs traverses the IBM Cloud network or VPN/Direct Link connection rather than the local LAN',
      'This introduces additional latency and reduced bandwidth compared to LAN communication — latency-sensitive applications (databases, real-time services) should be migrated together in the same wave',
      'Identify tightly-coupled VM pairs (e.g., app server + database) and ensure they are in the same migration wave to avoid cross-network latency',
      'Bandwidth planning for the WAN link, if used, should account for inter-VM traffic that was previously LAN-local',
    ]),
  );

  // AI Migration Strategy
  if (aiInsights?.migrationStrategy) {
    sections.push(
      ...createAISection(
        `${s}.4 AI Migration Strategy`,
        aiInsights.migrationStrategy,
        HeadingLevel.HEADING_2
      )
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
