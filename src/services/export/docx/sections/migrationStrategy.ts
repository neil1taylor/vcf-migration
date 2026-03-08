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

function computeWavesForMode(
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

function buildWaveTable(waves: (WaveGroup | NetworkWaveGroup)[], isComplexity: boolean): Table {
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

function getStrategyLabel(pref: WavePlanningPreference): string {
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
): DocumentContent[] {
  const sections: DocumentContent[] = [
    createHeading('5. Migration Strategy', HeadingLevel.HEADING_1),
    createParagraph(
      'This section outlines the migration wave planning approach. Three strategies are available for organizing VM migration waves, each with different trade-offs.',
      { spacing: { after: 200 } }
    ),
    createParagraph(
      'The wave groupings presented here are preliminary suggestions based on environment data. The migration partner will refine wave composition based on application dependency mapping, business criticality, maintenance window constraints, and stakeholder availability.'
    ),

    // 5.1 Wave Planning Strategies
    createHeading('5.1 Wave Planning Strategies', HeadingLevel.HEADING_2),
    createParagraph(
      'The application supports three wave planning strategies for organizing the migration:',
      { spacing: { after: 120 } }
    ),

    createHeading('Complexity-Based', HeadingLevel.HEADING_3),
    createParagraph(
      'Organizes VMs into 5 progressive waves based on migration complexity scores: Pilot, Quick Wins, Standard, Complex, and Remediation. VMs with blockers are automatically placed in the Remediation wave.',
      { spacing: { after: 80 } }
    ),
    ...createBulletList([
      'Best when: Heterogeneous environment with widely varying complexity, or when a risk-graduated rollout is desired.',
      'Pros: Natural pilot identification with lowest-complexity VMs, risk-ordered progression, blocker isolation.',
      'Cons: May split network-adjacent VMs across waves, requiring more network reconfiguration per wave.',
    ]),

    createHeading('Network-Based (Cluster)', HeadingLevel.HEADING_3),
    createParagraph(
      'Groups VMs by their VMware cluster. Each cluster becomes a migration wave, keeping co-located workloads together.',
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
      'Best when: Minimal network reconfiguration is desired, or subnet-aligned cutover is required.',
      'Pros: Network continuity during migration, predictable wave boundaries, reduced split-brain scenarios.',
      'Cons: May split application tiers across waves if they span multiple subnets.',
    ]),
  ];

  // 5.2 Selected Strategy
  sections.push(createHeading('5.2 Selected Strategy', HeadingLevel.HEADING_2));
  if (wavePlanningPreference) {
    const label = getStrategyLabel(wavePlanningPreference);
    sections.push(
      createParagraph(
        `The selected wave planning strategy is: ${label}. The wave summaries below reflect this strategy applied to the environment data.`,
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

  // Wave summary tables
  if (wavePlanningPreference) {
    const isComplexity = wavePlanningPreference.wavePlanningMode === 'complexity';

    if (includeROKS) {
      const roksWaves = computeWavesForMode(rawData, 'roks', wavePlanningPreference);
      sections.push(
        createHeading('5.3 ROKS Wave Summary', HeadingLevel.HEADING_2),
        createParagraph(
          `${roksWaves.length} wave${roksWaves.length !== 1 ? 's' : ''} generated for ROKS (OpenShift Virtualization) migration using the ${getStrategyLabel(wavePlanningPreference)} strategy:`,
          { spacing: { after: 120 } }
        ),
        buildWaveTable(roksWaves, isComplexity),
      );
    }

    if (includeVSI) {
      const vsiWaves = computeWavesForMode(rawData, 'vsi', wavePlanningPreference);
      const sectionNum = includeROKS ? '5.4' : '5.3';
      sections.push(
        createHeading(`${sectionNum} VSI Wave Summary`, HeadingLevel.HEADING_2),
        createParagraph(
          `${vsiWaves.length} wave${vsiWaves.length !== 1 ? 's' : ''} generated for VPC Virtual Server migration using the ${getStrategyLabel(wavePlanningPreference)} strategy:`,
          { spacing: { after: 120 } }
        ),
        buildWaveTable(vsiWaves, isComplexity),
      );
    }
  } else {
    // Legacy fallback: port-group based waves from raw network data
    const networkWaves = buildLegacyNetworkWaves(rawData);
    const topWaves = networkWaves.slice(0, 20);
    const sectionNum = '5.3';

    sections.push(
      createHeading(`${sectionNum} Network Wave Summary`, HeadingLevel.HEADING_2),
      createParagraph(
        `The environment contains ${networkWaves.length} unique port groups. The following table shows the proposed migration waves based on network topology:`,
        { spacing: { after: 120 } }
      ),
      new Table({
        width: { size: 100, type: 'pct' as const },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          left: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          right: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: STYLES.mediumGray },
        },
        rows: [
          new TableRow({
          cantSplit: true,
            children: [
              createTableCell('Wave', { header: true }),
              createTableCell('Port Group', { header: true }),
              createTableCell('Subnet', { header: true }),
              createTableCell('VMs', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('vCPUs', { header: true, align: AlignmentType.RIGHT }),
              createTableCell('Memory', { header: true, align: AlignmentType.RIGHT }),
            ],
          }),
          ...topWaves.map((wave, idx) =>
            new TableRow({
          cantSplit: true,
              children: [
                createTableCell(`Wave ${idx + 1}`),
                createTableCell(wave.portGroup.length > 25 ? wave.portGroup.substring(0, 22) + '...' : wave.portGroup),
                createTableCell(wave.subnet),
                createTableCell(`${wave.vmCount}`, { align: AlignmentType.RIGHT }),
                createTableCell(`${wave.vcpus}`, { align: AlignmentType.RIGHT }),
                createTableCell(`${wave.memoryGiB} GiB`, { align: AlignmentType.RIGHT }),
              ],
            })
          ),
        ],
      }),
    );
    if (networkWaves.length > 20) {
      sections.push(createParagraph(
        `Note: Showing 20 of ${networkWaves.length} port groups. Smaller waves are listed first to identify pilot migration candidates.`,
        { spacing: { before: 120 } }
      ));
    }
  }

  // Coexistence Network Considerations
  const coexNum = wavePlanningPreference
    ? (includeROKS && includeVSI ? '5.4' : includeROKS || includeVSI ? '5.3' : '5.2')
    : '5.3';
  sections.push(
    createHeading(`${coexNum} Coexistence Network Considerations`, HeadingLevel.HEADING_2),
    createParagraph(
      'During migration, VMs will be split between on-premises infrastructure and IBM Cloud. This coexistence period introduces network considerations that must be planned for:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Traffic between migrated (IBM Cloud) and non-migrated (on-prem) VMs traverses the VPN or Direct Link connection rather than the local LAN',
      'This introduces additional latency and reduced bandwidth compared to LAN communication — latency-sensitive applications (databases, real-time services) should be migrated together in the same wave',
      'Identify tightly-coupled VM pairs (e.g., app server + database) and ensure they are in the same migration wave to avoid cross-network latency',
      'Bandwidth planning for the WAN link should account for inter-VM traffic that was previously LAN-local',
    ]),
  );

  // ROKS Migration Considerations
  const roksNum = wavePlanningPreference
    ? (includeROKS && includeVSI ? '5.6' : includeROKS || includeVSI ? '5.5' : '5.4')
    : '5.5';
  sections.push(
    createHeading(`${roksNum} ROKS Migration Considerations`, HeadingLevel.HEADING_2),
    createParagraph(
      'For ROKS with OpenShift Virtualization, subnet-based migration aligns with the Migration Toolkit for Virtualization (MTV) workflow:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'MTV supports network mapping to translate VMware port groups to OpenShift network attachment definitions',
      'OVN-Kubernetes secondary networks can mirror the original VLAN structure for seamless connectivity',
      'VMs can retain their original IP addresses when migrated to appropriately configured secondary networks',
      'Migration plans in MTV naturally map to port group waves, enabling orchestrated cutover',
      'During coexistence, traffic between migrated VMs in OpenShift and non-migrated on-prem VMs will traverse the Direct Link or VPN, introducing latency for cross-environment communication',
    ]),
  );

  // VSI Migration Considerations
  const vsiNum = String(Number(roksNum.split('.')[1]) + 1);
  sections.push(
    createHeading(`5.${vsiNum} VSI Migration Considerations`, HeadingLevel.HEADING_2),
    createParagraph(
      'For VPC Virtual Server migration, subnet-based waves simplify VPC network design:',
      { spacing: { after: 120 } }
    ),
    ...createBulletList([
      'Each VMware port group maps to a VPC subnet with equivalent CIDR range',
      'Security groups can be pre-configured to match existing firewall rules before migration',
      'VPN or Direct Link connectivity can route traffic to migrated subnets during transition',
      'Phased cutover allows gradual DNS updates as each subnet completes migration',
      'During coexistence, traffic between migrated VSIs and non-migrated on-prem VMs traverses the VPN or Direct Link — plan waves to keep latency-sensitive VM pairs together',
    ]),
  );

  // AI Migration Strategy
  if (aiInsights?.migrationStrategy) {
    const aiNum = String(Number(vsiNum) + 1);
    sections.push(
      ...createAISection(
        `5.${aiNum} AI Migration Strategy`,
        aiInsights.migrationStrategy,
        HeadingLevel.HEADING_2
      )
    );
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));

  return sections;
}
