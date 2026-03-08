// Tier-2 Appendix Sections — reference deep-dives gated by includeAppendices

import { Paragraph, PageBreak, HeadingLevel } from 'docx';
import type { DocumentContent } from '../types';
import type { RVToolsData } from '@/types/rvtools';
import { mibToGiB } from '@/utils/formatters';
import { SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import {
  createHeading,
  createParagraph,
  createStyledTable,
  createBulletList,
  createTableDescription,
  createTableLabel,
} from '../utils/helpers';
import { AlignmentType } from 'docx';

const L = AlignmentType.LEFT;
const R = AlignmentType.RIGHT;

// ===== Compute Deep-dive =====

export function buildComputeAppendix(rawData: RVToolsData, label: string): DocumentContent[] {
  const vms = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  if (vms.length === 0) return [];

  const sections: DocumentContent[] = [
    new Paragraph({ children: [new PageBreak()] }),
    createHeading(`Appendix ${label}: Compute Deep-dive`, HeadingLevel.HEADING_2),
    createParagraph(`Detailed compute resource distribution across ${vms.length} powered-on VMs.`),
  ];

  // vCPU distribution
  const cpuBuckets = [
    { label: '1–2', min: 1, max: 2 },
    { label: '3–4', min: 3, max: 4 },
    { label: '5–8', min: 5, max: 8 },
    { label: '9–16', min: 9, max: 16 },
    { label: '17–32', min: 17, max: 32 },
    { label: '33+', min: 33, max: Infinity },
  ];

  const cpuRows = cpuBuckets.map(b => {
    const count = vms.filter(vm => vm.cpus >= b.min && vm.cpus <= b.max).length;
    return [b.label, `${count}`, vms.length > 0 ? `${((count / vms.length) * 100).toFixed(1)}%` : '0%'];
  });

  sections.push(
    ...createTableDescription('vCPU Distribution', 'Distribution of virtual CPUs across VMs.'),
    createStyledTable(['vCPU Range', 'Count', '%'], cpuRows, { columnAligns: [L, R, R] }),
    createTableLabel('vCPU Distribution'),
  );

  // Memory distribution
  const memBuckets = [
    { label: '0–4 GiB', min: 0, max: 4 },
    { label: '5–8 GiB', min: 5, max: 8 },
    { label: '9–16 GiB', min: 9, max: 16 },
    { label: '17–32 GiB', min: 17, max: 32 },
    { label: '33–64 GiB', min: 33, max: 64 },
    { label: '65+ GiB', min: 65, max: Infinity },
  ];

  const memRows = memBuckets.map(b => {
    const count = vms.filter(vm => {
      const gib = mibToGiB(vm.memory);
      return gib >= b.min && gib <= b.max;
    }).length;
    return [b.label, `${count}`, vms.length > 0 ? `${((count / vms.length) * 100).toFixed(1)}%` : '0%'];
  });

  sections.push(
    ...createTableDescription('Memory Distribution', 'Distribution of memory allocation across VMs.'),
    createStyledTable(['Memory Range', 'Count', '%'], memRows, { columnAligns: [L, R, R] }),
    createTableLabel('Memory Distribution'),
  );

  // Top 10 CPU consumers
  const topCPU = [...vms].sort((a, b) => b.cpus - a.cpus).slice(0, 10);
  sections.push(
    ...createTableDescription('Top CPU Consumers', 'The 10 VMs with the highest vCPU allocation.'),
    createStyledTable(
      ['VM Name', 'vCPUs', 'Memory GiB', 'Cluster'],
      topCPU.map(vm => [
        vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName,
        `${vm.cpus}`,
        `${mibToGiB(vm.memory).toFixed(1)}`,
        vm.cluster,
      ]),
      { columnAligns: [L, R, R, L] }
    ),
    createTableLabel('Top CPU Consumers'),
  );

  // Top 10 Memory consumers
  const topMem = [...vms].sort((a, b) => b.memory - a.memory).slice(0, 10);
  sections.push(
    ...createTableDescription('Top Memory Consumers', 'The 10 VMs with the highest memory allocation.'),
    createStyledTable(
      ['VM Name', 'vCPUs', 'Memory GiB', 'Cluster'],
      topMem.map(vm => [
        vm.vmName.length > 30 ? vm.vmName.substring(0, 27) + '...' : vm.vmName,
        `${vm.cpus}`,
        `${mibToGiB(vm.memory).toFixed(1)}`,
        vm.cluster,
      ]),
      { columnAligns: [L, R, R, L] }
    ),
    createTableLabel('Top Memory Consumers'),
  );

  return sections;
}

// ===== Storage Deep-dive =====

export function buildStorageAppendix(rawData: RVToolsData, label: string): DocumentContent[] {
  if (rawData.vDatastore.length === 0 && rawData.vDisk.length === 0) return [];

  const sections: DocumentContent[] = [
    new Paragraph({ children: [new PageBreak()] }),
    createHeading(`Appendix ${label}: Storage Deep-dive`, HeadingLevel.HEADING_2),
  ];

  // Per-datastore summary
  if (rawData.vDatastore.length > 0) {
    const dsRows = rawData.vDatastore.map(ds => [
      ds.name.length > 25 ? ds.name.substring(0, 22) + '...' : ds.name,
      ds.type,
      `${mibToGiB(ds.capacityMiB).toFixed(1)}`,
      `${mibToGiB(ds.inUseMiB).toFixed(1)}`,
      `${mibToGiB(ds.freeMiB).toFixed(1)}`,
      `${ds.freePercent.toFixed(1)}%`,
      `${ds.vmCount}`,
    ]);

    sections.push(
      ...createTableDescription('Datastore Summary', 'Capacity, usage, and VM count for each datastore in the environment.'),
      createStyledTable(
        ['Name', 'Type', 'Capacity GiB', 'Used GiB', 'Free GiB', 'Free %', 'VMs'],
        dsRows,
        { columnAligns: [L, L, R, R, R, R, R] }
      ),
      createTableLabel('Datastore Summary'),
    );
  }

  // Thin vs Thick provisioning
  if (rawData.vDisk.length > 0) {
    const thinCount = rawData.vDisk.filter(d => d.thin).length;
    const thickCount = rawData.vDisk.length - thinCount;

    sections.push(
      ...createTableDescription('Disk Provisioning', 'Distribution of thin versus thick provisioned virtual disks.'),
      createStyledTable(
        ['Provisioning Type', 'Disk Count', '%'],
        [
          ['Thin', `${thinCount}`, `${((thinCount / rawData.vDisk.length) * 100).toFixed(1)}%`],
          ['Thick', `${thickCount}`, `${((thickCount / rawData.vDisk.length) * 100).toFixed(1)}%`],
        ],
        { columnAligns: [L, R, R] }
      ),
      createTableLabel('Disk Provisioning'),
    );

    const bullets: string[] = [
      `Total virtual disks: ${rawData.vDisk.length}`,
      `Thin provisioned: ${thinCount} (${((thinCount / rawData.vDisk.length) * 100).toFixed(0)}%)`,
    ];
    if (rawData.vDatastore.length > 0) {
      const totalCapGiB = rawData.vDatastore.reduce((s, ds) => s + mibToGiB(ds.capacityMiB), 0);
      const totalUsedGiB = rawData.vDatastore.reduce((s, ds) => s + mibToGiB(ds.inUseMiB), 0);
      bullets.push(`Total datastore capacity: ${totalCapGiB.toFixed(1)} GiB`);
      bullets.push(`Total datastore usage: ${totalUsedGiB.toFixed(1)} GiB (${totalCapGiB > 0 ? ((totalUsedGiB / totalCapGiB) * 100).toFixed(1) : '0'}%)`);
    }
    sections.push(...createBulletList(bullets));
  }

  return sections;
}

// ===== Cluster Analysis =====

export function buildClusterAppendix(rawData: RVToolsData, label: string): DocumentContent[] {
  if (rawData.vCluster.length === 0) return [];

  const sections: DocumentContent[] = [
    new Paragraph({ children: [new PageBreak()] }),
    createHeading(`Appendix ${label}: Cluster Analysis`, HeadingLevel.HEADING_2),
    createParagraph(`${rawData.vCluster.length} cluster${rawData.vCluster.length > 1 ? 's' : ''} found in the environment.`),
  ];

  const rows = rawData.vCluster.map(c => [
    c.name,
    `${c.vmCount}`,
    `${c.hostCount}`,
    `${c.numCpuCores}`,
    `${mibToGiB(c.totalMemoryMiB).toFixed(0)}`,
    c.haEnabled ? 'Yes' : 'No',
    c.drsEnabled ? 'Yes' : 'No',
    c.evcMode || 'N/A',
  ]);

  sections.push(
    ...createTableDescription('Cluster Inventory', 'Cluster configuration including HA, DRS, and EVC settings.'),
    createStyledTable(
      ['Cluster', 'VMs', 'Hosts', 'CPU Cores', 'Memory GiB', 'HA', 'DRS', 'EVC Mode'],
      rows,
      { columnAligns: [L, R, R, R, R, L, L, L] }
    ),
    createTableLabel('Cluster Inventory'),
  );

  return sections;
}

// ===== Host Inventory =====

export function buildHostAppendix(rawData: RVToolsData, label: string): DocumentContent[] {
  if (rawData.vHost.length === 0) return [];

  const sections: DocumentContent[] = [
    new Paragraph({ children: [new PageBreak()] }),
    createHeading(`Appendix ${label}: Host Inventory`, HeadingLevel.HEADING_2),
    createParagraph(`${rawData.vHost.length} ESXi host${rawData.vHost.length > 1 ? 's' : ''} found in the environment.`),
  ];

  const rows = rawData.vHost.map(h => [
    h.name.length > 25 ? h.name.substring(0, 22) + '...' : h.name,
    h.cluster,
    h.esxiVersion,
    h.cpuModel.length > 20 ? h.cpuModel.substring(0, 17) + '...' : h.cpuModel,
    `${h.cpuSockets}`,
    `${h.totalCpuCores}`,
    `${mibToGiB(h.memoryMiB).toFixed(0)}`,
    `${h.vmCount}`,
  ]);

  sections.push(
    ...createTableDescription('Host Inventory', 'ESXi host specifications and workload distribution.'),
    createStyledTable(
      ['Host', 'Cluster', 'ESXi', 'CPU Model', 'Sockets', 'Cores', 'Memory GiB', 'VMs'],
      rows,
      { columnAligns: [L, L, L, L, R, R, R, R] }
    ),
    createTableLabel('Host Inventory'),
  );

  return sections;
}

// ===== Snapshot Details =====

export function buildSnapshotAppendix(rawData: RVToolsData, label: string): DocumentContent[] {
  const aged = rawData.vSnapshot.filter(s => s.ageInDays > SNAPSHOT_BLOCKER_AGE_DAYS);
  if (aged.length === 0) return [];

  const sorted = [...aged].sort((a, b) => b.ageInDays - a.ageInDays);

  const sections: DocumentContent[] = [
    new Paragraph({ children: [new PageBreak()] }),
    createHeading(`Appendix ${label}: Snapshot Details`, HeadingLevel.HEADING_2),
    createParagraph(`${sorted.length} snapshot${sorted.length > 1 ? 's' : ''} older than ${SNAPSHOT_BLOCKER_AGE_DAYS} days found. Aged snapshots should be consolidated before migration to reduce data transfer and avoid delta-chain issues.`),
  ];

  const rows = sorted.map(s => [
    s.vmName.length > 25 ? s.vmName.substring(0, 22) + '...' : s.vmName,
    s.snapshotName.length > 25 ? s.snapshotName.substring(0, 22) + '...' : s.snapshotName,
    `${s.ageInDays}`,
    `${mibToGiB(s.sizeTotalMiB).toFixed(1)}`,
  ]);

  sections.push(
    ...createTableDescription('Aged Snapshots', `Snapshots older than ${SNAPSHOT_BLOCKER_AGE_DAYS} days, sorted by age.`),
    createStyledTable(
      ['VM Name', 'Snapshot Name', 'Age (Days)', 'Size GiB'],
      rows,
      { columnAligns: [L, L, R, R] }
    ),
    createTableLabel('Aged Snapshots'),
  );

  return sections;
}

// ===== Full VM Inventory =====

const VM_INVENTORY_CAP = 500;

export function buildVMInventoryAppendix(rawData: RVToolsData, label: string): DocumentContent[] {
  if (rawData.vInfo.length === 0) return [];

  const sections: DocumentContent[] = [
    new Paragraph({ children: [new PageBreak()] }),
    createHeading(`Appendix ${label}: Full VM Inventory`, HeadingLevel.HEADING_2),
    createParagraph(`Complete inventory of ${rawData.vInfo.length} virtual machines.`),
  ];

  const vms = rawData.vInfo.slice(0, VM_INVENTORY_CAP);
  const rows = vms.map(vm => [
    vm.vmName.length > 25 ? vm.vmName.substring(0, 22) + '...' : vm.vmName,
    vm.powerState === 'poweredOn' ? 'On' : vm.powerState === 'poweredOff' ? 'Off' : 'Susp',
    vm.guestOS.length > 20 ? vm.guestOS.substring(0, 17) + '...' : vm.guestOS,
    `${vm.cpus}`,
    `${mibToGiB(vm.memory).toFixed(1)}`,
    `${mibToGiB(vm.provisionedMiB).toFixed(1)}`,
    vm.cluster,
    vm.datacenter,
  ]);

  sections.push(
    ...createTableDescription('VM Inventory', `Full list of VMs${rawData.vInfo.length > VM_INVENTORY_CAP ? ` (showing first ${VM_INVENTORY_CAP} of ${rawData.vInfo.length})` : ''}.`),
    createStyledTable(
      ['VM Name', 'Power', 'Guest OS', 'vCPUs', 'Memory GiB', 'Storage GiB', 'Cluster', 'Datacenter'],
      rows,
      { columnAligns: [L, L, L, R, R, R, L, L] }
    ),
    createTableLabel('VM Inventory'),
  );

  if (rawData.vInfo.length > VM_INVENTORY_CAP) {
    sections.push(
      createParagraph(`Note: ${rawData.vInfo.length - VM_INVENTORY_CAP} additional VMs not shown. Refer to the Excel export for the complete inventory.`),
    );
  }

  return sections;
}
