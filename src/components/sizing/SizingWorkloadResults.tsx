// Workload-based node requirements and resource breakdown bars for the Sizing Calculator
import {
  Grid,
  Column,
  Tile,
  Tag,
} from '@carbon/react';
import { formatNumber, formatBytes } from '@/utils/formatters';
import { StorageBreakdownBar, STORAGE_SEGMENT_COLORS } from '@/components/sizing/StorageBreakdownBar';
import { ResourceBreakdownBar, RESOURCE_SEGMENT_COLORS } from '@/components/sizing/ResourceBreakdownBar';
import type { BareMetalProfile, NodeCapacity, NodeRequirements } from '@/hooks/useSizingCalculator';
import type { OdfReservation } from '@/utils/odfCalculation';
import type { RoksSolutionType } from '@/services/costEstimation';
import type { VDiskInfo } from '@/types/rvtools';
import { BlockStorageInventory } from '@/components/sizing/BlockStorageInventory';

interface SizingWorkloadResultsProps {
  nodeRequirements: NodeRequirements;
  nodeCapacity: NodeCapacity;
  selectedProfile: BareMetalProfile;
  nodeRedundancy: number;
  odfReservedCpu: number;
  odfReservedMemory: number;
  systemReservedCpu: number;
  systemReservedMemory: number;
  useHyperthreading: boolean;
  htMultiplier: number;
  cpuOvercommit: number;
  memoryOvercommit: number;
  cpuFixedPerVM: number;
  cpuProportionalPercent: number;
  memoryFixedPerVMMiB: number;
  memoryProportionalPercent: number;
  storageMetric: 'provisioned' | 'inUse' | 'diskCapacity';
  annualGrowthRate: number;
  planningHorizonYears: number;
  virtOverhead: number;
  replicaFactor: number;
  operationalCapacity: number;
  cephOverhead: number;
  evictionThreshold: number;
  odfReservation: OdfReservation;
  solutionType?: RoksSolutionType;
  filteredDisks?: VDiskInfo[];
}

export function SizingWorkloadResults({
  nodeRequirements,
  nodeCapacity,
  selectedProfile,
  nodeRedundancy,
  odfReservedCpu,
  odfReservedMemory,
  systemReservedCpu,
  systemReservedMemory,
  useHyperthreading,
  htMultiplier,
  cpuOvercommit,
  memoryOvercommit,
  cpuFixedPerVM,
  cpuProportionalPercent,
  memoryFixedPerVMMiB,
  memoryProportionalPercent,
  storageMetric,
  annualGrowthRate,
  planningHorizonYears,
  virtOverhead,
  replicaFactor,
  operationalCapacity,
  cephOverhead,
  evictionThreshold,
  odfReservation,
  solutionType,
  filteredDisks,
}: SizingWorkloadResultsProps) {
  const hasOdf = solutionType !== 'bm-block-csi' && solutionType !== 'bm-nfs-csi';
  // Calculate cluster totals for breakdown visualizations
  const totalClusterCpuRaw = selectedProfile.physicalCores * (useHyperthreading ? htMultiplier : 1) * cpuOvercommit * nodeRequirements.totalNodes;
  const totalClusterMemoryRaw = selectedProfile.memoryGiB * memoryOvercommit * nodeRequirements.totalNodes;

  const cpuUsed = nodeRequirements.totalVCPUs;
  const cpuOdfTotal = odfReservedCpu * nodeRequirements.totalNodes;
  const cpuSystemTotal = systemReservedCpu * nodeRequirements.totalNodes;
  const cpuTotalUsed = cpuUsed + cpuOdfTotal + cpuSystemTotal;
  const cpuFree = Math.max(0, totalClusterCpuRaw - cpuTotalUsed);
  const cpuAvailableCapacity = nodeCapacity.vcpuCapacity * nodeRequirements.totalNodes;
  const cpuUtilization = cpuAvailableCapacity > 0 ? (cpuUsed / cpuAvailableCapacity) * 100 : 0;

  const memoryUsed = nodeRequirements.totalMemoryGiB;
  const memoryOdfTotal = odfReservedMemory * nodeRequirements.totalNodes;
  const memorySystemTotal = systemReservedMemory * nodeRequirements.totalNodes;
  const memoryTotalUsed = memoryUsed + memoryOdfTotal + memorySystemTotal;
  const memoryFree = Math.max(0, totalClusterMemoryRaw - memoryTotalUsed);
  const memoryAvailableCapacity = nodeCapacity.memoryCapacity * nodeRequirements.totalNodes;
  const memoryUtilization = memoryAvailableCapacity > 0 ? (memoryUsed / memoryAvailableCapacity) * 100 : 0;

  const storageUsed = nodeRequirements.totalStorageGiB;
  const storageMaxUsableCapacity = nodeCapacity.maxUsableStorageGiB * nodeRequirements.totalNodes;
  const storageUtilization = storageMaxUsableCapacity > 0 ? (storageUsed / storageMaxUsableCapacity) * 100 : 0;

  return (
    <Column lg={16} md={8} sm={4}>
      <Tile className="sizing-calculator__workload-results">
        <h3 className="sizing-calculator__section-title">Node Requirements for Your Workload</h3>
        <p className="sizing-calculator__subtitle">
          Based on {formatNumber(nodeRequirements.vmCount)} powered-on VMs from uploaded RVTools data
        </p>

        <Grid narrow>
          <Column lg={4} md={4} sm={2}>
            <div className="sizing-calculator__workload-card">
              <span className="sizing-calculator__workload-label">Total vCPU Requirements</span>
              <span className="sizing-calculator__workload-value">
                {formatNumber(nodeRequirements.totalVCPUs + ((hasOdf ? odfReservedCpu : 0) + systemReservedCpu) * nodeRequirements.totalNodes)}
              </span>
              <span className={`sizing-calculator__workload-nodes ${nodeRequirements.limitingFactor === 'cpu' ? 'sizing-calculator__workload-nodes--limiting' : ''}`}>
                {nodeRequirements.nodesForCPU} nodes (min fit)
                {nodeRequirements.limitingFactor === 'cpu' && <Tag type="red" size="sm">Limiting</Tag>}
                {nodeRequirements.cpuCapacityExceeded && <Tag type="magenta" size="sm">ODF exceeds node CPU</Tag>}
              </span>
              <span className="sizing-calculator__workload-detail">
                Workload: {formatNumber(nodeRequirements.totalVCPUs)} + Infra: {formatNumber(((hasOdf ? odfReservedCpu : 0) + systemReservedCpu) * nodeRequirements.totalNodes)}
              </span>
            </div>
          </Column>

          <Column lg={4} md={4} sm={2}>
            <div className="sizing-calculator__workload-card">
              <span className="sizing-calculator__workload-label">Total Memory Requirements</span>
              <span className="sizing-calculator__workload-value">
                {formatNumber(Math.round(nodeRequirements.totalMemoryGiB + ((hasOdf ? odfReservedMemory : 0) + systemReservedMemory) * nodeRequirements.totalNodes))} GiB
              </span>
              <span className={`sizing-calculator__workload-nodes ${nodeRequirements.limitingFactor === 'memory' ? 'sizing-calculator__workload-nodes--limiting' : ''}`}>
                {nodeRequirements.nodesForMemory} nodes (min fit)
                {nodeRequirements.limitingFactor === 'memory' && <Tag type="red" size="sm">Limiting</Tag>}
              </span>
              <span className="sizing-calculator__workload-detail">
                Workload: {formatNumber(Math.round(nodeRequirements.totalMemoryGiB))} + Infra: {formatNumber(((hasOdf ? odfReservedMemory : 0) + systemReservedMemory) * nodeRequirements.totalNodes)} GiB
              </span>
            </div>
          </Column>

          <Column lg={4} md={4} sm={2}>
            <div className="sizing-calculator__workload-card">
              <span className="sizing-calculator__workload-label">Total Storage Requirements</span>
              <span className="sizing-calculator__workload-value">{formatBytes(nodeRequirements.totalStorageGiB * 1024 * 1024 * 1024)}</span>
              <span className={`sizing-calculator__workload-nodes ${nodeRequirements.limitingFactor === 'storage' ? 'sizing-calculator__workload-nodes--limiting' : ''}`}>
                {nodeRequirements.nodesForStorage} nodes (min fit)
                {nodeRequirements.limitingFactor === 'storage' && <Tag type="red" size="sm">Limiting</Tag>}
              </span>
              <span className="sizing-calculator__workload-detail">
                Workload: {formatBytes(nodeRequirements.baseStorageGiB * 1024 * 1024 * 1024)} + Growth/Overhead
              </span>
            </div>
          </Column>

          <Column lg={4} md={4} sm={2}>
            <div className="sizing-calculator__workload-card sizing-calculator__workload-card--total">
              <span className="sizing-calculator__workload-label">Recommended Nodes</span>
              <span className="sizing-calculator__workload-value sizing-calculator__workload-value--large">
                {nodeRequirements.totalNodes}
              </span>
              <div className="sizing-calculator__node-breakdown">
                {(() => {
                  const baseNodes = Math.max(nodeRequirements.nodesForCPU, nodeRequirements.nodesForMemory, nodeRequirements.nodesForStorage);
                  const limitLabel = nodeRequirements.limitingFactor === 'cpu' ? 'CPU' : nodeRequirements.limitingFactor === 'memory' ? 'memory' : 'storage';
                  const evictionAdded = nodeRequirements.minSurvivingNodes - baseNodes;
                  return (
                    <>
                      <div className="sizing-calculator__breakdown-step">
                        <span className="sizing-calculator__breakdown-step-label">Minimum nodes needed:</span>
                        <span className="sizing-calculator__breakdown-step-value">{baseNodes}</span>
                        <span className="sizing-calculator__breakdown-step-note">({limitLabel} limiting)</span>
                      </div>
                      {evictionAdded > 0 && (
                        <div className="sizing-calculator__breakdown-step">
                          <span className="sizing-calculator__breakdown-step-label">Eviction safety ({evictionThreshold}%):</span>
                          <span className="sizing-calculator__breakdown-step-value">+{evictionAdded}</span>
                          <span className="sizing-calculator__breakdown-step-note">&rarr; {nodeRequirements.minSurvivingNodes} nodes</span>
                        </div>
                      )}
                      {nodeRedundancy > 0 && (
                        <div className="sizing-calculator__breakdown-step">
                          <span className="sizing-calculator__breakdown-step-label">Redundancy buffer (N+{nodeRedundancy}):</span>
                          <span className="sizing-calculator__breakdown-step-value">+{nodeRedundancy}</span>
                          <span className="sizing-calculator__breakdown-step-note">&rarr; {nodeRequirements.preRoundingTotal} nodes</span>
                        </div>
                      )}
                      {hasOdf && (
                      <div className="sizing-calculator__breakdown-step">
                        <span className="sizing-calculator__breakdown-step-label">ODF fault domain (&times;3):</span>
                        <span className="sizing-calculator__breakdown-step-value">
                          {nodeRequirements.totalNodes !== nodeRequirements.preRoundingTotal
                            ? `+${nodeRequirements.totalNodes - nodeRequirements.preRoundingTotal}`
                            : '\u2713'}
                        </span>
                        <span className="sizing-calculator__breakdown-step-note">{nodeRequirements.totalNodes} nodes</span>
                      </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </Column>
        </Grid>

        {/* Resource Breakdown Visualizations */}
        <div style={{ marginTop: '1.5rem', padding: '0 1rem' }}>
          {/* CPU Cluster Capacity Breakdown */}
          <ResourceBreakdownBar
            title="CPU Cluster Capacity"
            unit="vcpus"
            infoLink={{
              text: 'View overhead details',
              href: '/overhead-reference',
            }}
            segments={[
              {
                label: 'VM vCPUs',
                value: nodeRequirements.baseVCPUs,
                color: RESOURCE_SEGMENT_COLORS.vmCpu,
                description: 'Base vCPU requirements from VMs',
              },
              {
                label: 'Virt. Overhead',
                value: nodeRequirements.cpuVirtOverheadTotal,
                color: RESOURCE_SEGMENT_COLORS.cpuOverhead,
                description: `${nodeRequirements.vmCount} VMs \u00d7 ${cpuFixedPerVM} vCPU + ${cpuProportionalPercent}% emulation`,
              },
              ...(hasOdf ? [{
                label: 'ODF Reserved',
                value: cpuOdfTotal,
                color: RESOURCE_SEGMENT_COLORS.odfReserved,
                description: `${odfReservation.profileLabel} profile: OSD ${odfReservation.osd.totalCpu.toFixed(1)} + MGR ${odfReservation.mgr.totalCpu.toFixed(1)} + MON ${odfReservation.mon.totalCpu.toFixed(1)} + MDS ${odfReservation.mds.totalCpu.toFixed(1)}${odfReservation.rgw ? ` + RGW ${odfReservation.rgw.totalCpu.toFixed(1)}` : ''} per node \u00d7 ${nodeRequirements.totalNodes} nodes`,
              }] : []),
              {
                label: 'System Reserved',
                value: cpuSystemTotal,
                color: RESOURCE_SEGMENT_COLORS.systemReserved,
                description: `${systemReservedCpu} core/node \u00d7 ${nodeRequirements.totalNodes} nodes`,
              },
              {
                label: 'Free',
                value: cpuFree,
                color: RESOURCE_SEGMENT_COLORS.free,
                description: 'Available capacity for additional workloads',
              },
            ]}
          />
          <div className="sizing-calculator__breakdown-summary">
            <span>Total: <strong>{formatNumber(Math.round(totalClusterCpuRaw))} vCPUs</strong></span>
            <span>Workload: <strong>{formatNumber(Math.round(cpuUsed))} vCPUs</strong></span>
            <span>Available: <strong>{formatNumber(Math.round(cpuAvailableCapacity))} vCPUs</strong></span>
            <span>Utilization: <strong>{cpuAvailableCapacity === 0 && cpuUsed > 0 ? 'Oversubscribed' : `${cpuUtilization.toFixed(1)}%`}</strong></span>
          </div>

          {/* Memory Cluster Capacity Breakdown */}
          <ResourceBreakdownBar
            title="Memory Cluster Capacity"
            unit="gib"
            infoLink={{
              text: 'View overhead details',
              href: '/overhead-reference',
            }}
            segments={[
              {
                label: 'VM Memory',
                value: nodeRequirements.baseMemoryGiB,
                color: RESOURCE_SEGMENT_COLORS.vmMemory,
                description: 'Base memory requirements from VMs',
              },
              {
                label: 'Virt. Overhead',
                value: nodeRequirements.memoryVirtOverheadTotalGiB,
                color: RESOURCE_SEGMENT_COLORS.memoryOverhead,
                description: `${nodeRequirements.vmCount} VMs \u00d7 ${memoryFixedPerVMMiB} MiB + ${memoryProportionalPercent}% guest overhead`,
              },
              ...(hasOdf ? [{
                label: 'ODF Reserved',
                value: memoryOdfTotal,
                color: RESOURCE_SEGMENT_COLORS.odfReserved,
                description: `${odfReservation.profileLabel} profile: OSD ${odfReservation.osd.totalMemoryGiB.toFixed(1)} + MGR ${odfReservation.mgr.totalMemoryGiB.toFixed(1)} + MON ${odfReservation.mon.totalMemoryGiB.toFixed(1)} + MDS ${odfReservation.mds.totalMemoryGiB.toFixed(1)}${odfReservation.rgw ? ` + RGW ${odfReservation.rgw.totalMemoryGiB.toFixed(1)}` : ''} GiB/node \u00d7 ${nodeRequirements.totalNodes} nodes`,
              }] : []),
              {
                label: 'System Reserved',
                value: memorySystemTotal,
                color: RESOURCE_SEGMENT_COLORS.systemReserved,
                description: `${systemReservedMemory} GiB/node \u00d7 ${nodeRequirements.totalNodes} nodes`,
              },
              {
                label: 'Free',
                value: memoryFree,
                color: RESOURCE_SEGMENT_COLORS.free,
                description: 'Available capacity for additional workloads',
              },
            ]}
          />
          <div className="sizing-calculator__breakdown-summary">
            <span>Total: <strong>{formatNumber(Math.round(totalClusterMemoryRaw))} GiB</strong></span>
            <span>Workload: <strong>{formatNumber(Math.round(memoryUsed))} GiB</strong></span>
            <span>Available: <strong>{formatNumber(Math.round(memoryAvailableCapacity))} GiB</strong></span>
            <span>Utilization: <strong>{memoryUtilization.toFixed(1)}%</strong></span>
          </div>

          {/* Storage section — ODF breakdown or Block Storage inventory */}
          {!hasOdf && filteredDisks && (
            <BlockStorageInventory
              disks={filteredDisks}
              vmCount={nodeRequirements.vmCount}
            />
          )}
          {hasOdf && (<><StorageBreakdownBar
            title="ODF Storage Cluster"
            segments={[
              {
                label: 'VM Data',
                value: nodeRequirements.baseStorageGiB,
                color: STORAGE_SEGMENT_COLORS.vmData,
                description: `Base ${storageMetric === 'inUse' ? 'in-use' : storageMetric === 'diskCapacity' ? 'disk capacity' : 'provisioned'} storage`,
              },
              {
                label: 'Growth',
                value: nodeRequirements.baseStorageGiB * (nodeRequirements.growthMultiplier - 1),
                color: STORAGE_SEGMENT_COLORS.growth,
                description: `${annualGrowthRate}% annual growth over ${planningHorizonYears} year${planningHorizonYears !== 1 ? 's' : ''}`,
              },
              {
                label: 'Storage Overhead',
                value: (nodeRequirements.baseStorageGiB * nodeRequirements.growthMultiplier) * (nodeRequirements.virtOverheadMultiplier - 1),
                color: STORAGE_SEGMENT_COLORS.overhead,
                description: `${virtOverhead}% storage overhead (snapshots, clones, migration scratch)`,
              },
              {
                label: 'Replica',
                value: storageUsed * (replicaFactor - 1),
                color: STORAGE_SEGMENT_COLORS.replica,
                description: `${replicaFactor}x replication for data protection`,
              },
              {
                label: 'Ceph Reserve',
                value: (storageUsed * replicaFactor) * ((100 / operationalCapacity) - 1),
                color: STORAGE_SEGMENT_COLORS.headroom,
                description: `${100 - operationalCapacity}% reserve to maintain ${operationalCapacity}% operational capacity`,
              },
              {
                label: 'Ceph Overhead',
                value: (() => {
                  const dataWithReplicaAndHeadroom = storageUsed * replicaFactor * (100 / operationalCapacity);
                  return dataWithReplicaAndHeadroom * (cephOverhead / (100 - cephOverhead));
                })(),
                color: RESOURCE_SEGMENT_COLORS.odfReserved,
                description: `${cephOverhead}% Ceph metadata overhead`,
              },
              {
                label: 'Free',
                value: (() => {
                  const totalClusterRawStorage = (selectedProfile.totalNvmeGiB ?? 0) * nodeRequirements.totalNodes;
                  const dataWithReplicaAndHeadroom = storageUsed * replicaFactor * (100 / operationalCapacity);
                  const cephOH = dataWithReplicaAndHeadroom * (cephOverhead / (100 - cephOverhead));
                  const totalUsed = dataWithReplicaAndHeadroom + cephOH;
                  return Math.max(0, totalClusterRawStorage - totalUsed);
                })(),
                color: RESOURCE_SEGMENT_COLORS.free,
                description: 'Available raw storage capacity',
              },
            ]}
          />
          <div className="sizing-calculator__breakdown-summary">
            <span>Raw NVMe: <strong>{formatBytes((selectedProfile.totalNvmeGiB ?? 0) * nodeRequirements.totalNodes * 1024 * 1024 * 1024)}</strong></span>
            <span>Workload: <strong>{formatBytes(storageUsed * 1024 * 1024 * 1024)}</strong></span>
            <span>Utilization: <strong>{storageUtilization.toFixed(1)}%</strong></span>
          </div>
          </>)}
        </div>

      </Tile>
    </Column>
  );
}
