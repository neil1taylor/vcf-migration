// Pure calculation functions for ODF/Ceph resource reservations based on tuning profiles.
// Profiles (lean/balanced/performance) define per-component CPU and memory requests
// matching Red Hat ODF tuning profile documentation.

import virtualizationOverhead from '@/data/virtualizationOverhead.json';

export type OdfTuningProfile = 'lean' | 'balanced' | 'performance';
export type OdfCpuUnitMode = 'physical' | 'vcpu';

export interface OdfComponentDetail {
  cpu: number;
  memoryGiB: number;
  count: number;
  totalCpu: number;
  totalMemoryGiB: number;
}

export interface OdfReservation {
  mgr: OdfComponentDetail;
  mon: OdfComponentDetail;
  osd: OdfComponentDetail;
  mds: OdfComponentDetail;
  rgw: OdfComponentDetail | null;
  totalCpu: number;
  totalMemoryGiB: number;
  profileLabel: string;
  profileWarning: string | null;
}

const odfConfig = virtualizationOverhead.odfReserved;

function makeComponent(
  cpuPerInstance: number,
  memPerInstance: number,
  count: number,
): OdfComponentDetail {
  return {
    cpu: cpuPerInstance,
    memoryGiB: memPerInstance,
    count,
    totalCpu: cpuPerInstance * count,
    totalMemoryGiB: memPerInstance * count,
  };
}

/**
 * Calculate ODF resource reservations for a single node based on the selected tuning profile.
 *
 * Cluster-wide components (MON, MGR, MDS, RGW) have a fixed total count distributed
 * across all nodes. OSD runs 1 instance per NVMe device on every node.
 *
 * @param profile - ODF tuning profile (lean/balanced/performance)
 * @param nvmeDisks - Number of NVMe devices per node
 * @param totalNodes - Total nodes in the cluster (minimum 3 for ODF quorum)
 * @param includeRgw - Whether to include RADOS Gateway (S3) resources
 * @param cpuUnitMode - 'physical' divides by HT multiplier; 'vcpu' uses raw K8s CPU units
 * @param htMultiplier - Hyperthreading efficiency multiplier (e.g. 1.25)
 * @param useHyperthreading - Whether HT is enabled
 */
export function calculateOdfReservation(
  profile: OdfTuningProfile,
  nvmeDisks: number,
  totalNodes: number,
  includeRgw: boolean,
  cpuUnitMode: OdfCpuUnitMode,
  htMultiplier: number,
  useHyperthreading: boolean,
): OdfReservation {
  const profileData = odfConfig.profiles[profile];
  const counts = odfConfig.clusterWideCounts;

  // ODF requires minimum 3 nodes for quorum
  const effectiveNodes = Math.max(3, totalNodes);

  const components = profileData.components;

  // Cluster-wide components: distributed across nodes
  const mgrCount = counts.mgr / effectiveNodes;
  const monCount = counts.mon / effectiveNodes;
  const mdsCount = counts.mds / effectiveNodes;
  const rgwCount = counts.rgw / effectiveNodes;

  // OSD: 1 per NVMe device, per node
  const osdCount = nvmeDisks;

  const mgr = makeComponent(components.mgr.cpu, components.mgr.memoryGiB, mgrCount);
  const mon = makeComponent(components.mon.cpu, components.mon.memoryGiB, monCount);
  const osd = makeComponent(components.osd.cpu, components.osd.memoryGiB, osdCount);
  const mds = makeComponent(components.mds.cpu, components.mds.memoryGiB, mdsCount);
  const rgw = includeRgw
    ? makeComponent(components.rgw.cpu, components.rgw.memoryGiB, rgwCount)
    : null;

  // Total in vCPU units (K8s CPU)
  const totalCpuVcpu = mgr.totalCpu + mon.totalCpu + osd.totalCpu + mds.totalCpu + (rgw?.totalCpu ?? 0);
  const totalMemoryGiB = mgr.totalMemoryGiB + mon.totalMemoryGiB + osd.totalMemoryGiB + mds.totalMemoryGiB + (rgw?.totalMemoryGiB ?? 0);

  // Convert CPU based on unit mode
  let totalCpu: number;
  if (cpuUnitMode === 'physical') {
    const divisor = useHyperthreading ? htMultiplier : 1;
    totalCpu = totalCpuVcpu / divisor;
  } else {
    totalCpu = totalCpuVcpu;
  }

  return {
    mgr,
    mon,
    osd,
    mds,
    rgw,
    totalCpu,
    totalMemoryGiB,
    profileLabel: profileData.label,
    profileWarning: ('warning' in profileData ? (profileData as { warning: string }).warning : null),
  };
}

/**
 * Get the list of available ODF tuning profiles with their labels and descriptions.
 */
export function getOdfProfiles(): Array<{
  id: OdfTuningProfile;
  label: string;
  description: string;
  warning?: string;
}> {
  return (['lean', 'balanced', 'performance'] as const).map((id) => {
    const p = odfConfig.profiles[id];
    return {
      id,
      label: p.label,
      description: p.description,
      ...('warning' in p ? { warning: (p as { warning: string }).warning } : {}),
    };
  });
}
