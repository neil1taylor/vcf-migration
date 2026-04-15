// Interactive sizing calculator for OpenShift Virtualization and ODF
import { useEffect } from 'react';
import {
  Grid,
  Column,
  Tile,
  Dropdown,
  Tag,
} from '@carbon/react';
import { useSizingCalculator } from '@/hooks/useSizingCalculator';
import { SizingProfileSection } from '@/components/sizing/SizingProfileSection';
import { SizingCPUMemorySection } from '@/components/sizing/SizingCPUMemorySection';
import { SizingStorageSection } from '@/components/sizing/SizingStorageSection';
import { SizingNodeCapacity } from '@/components/sizing/SizingNodeCapacity';
import { SizingWorkloadResults } from '@/components/sizing/SizingWorkloadResults';
import { SizingRedundancyValidation } from '@/components/sizing/SizingRedundancyValidation';
import { SizingVMFitValidation } from '@/components/sizing/SizingVMFitValidation';
import { SizingDataQualityBanner } from '@/components/sizing/SizingDataQualityBanner';
import { useDataInconsistencies } from '@/hooks';
import type { RoksSolutionType } from '@/services/costEstimation';
import './SizingCalculator.scss';

export interface SizingResult {
  computeNodes: number;
  computeProfile: string;
  storageTiB: number;
  solutionType?: RoksSolutionType;
  /** @deprecated Use solutionType instead */
  useNvme: boolean;
  /** bm-disaggregated: dedicated NVMe storage pool node count */
  storageNodes?: number;
  /** bm-disaggregated: NVMe storage pool profile name */
  storageProfile?: string;
  /** Selected compute profile specs — for building sizing summary without re-lookup */
  profileSpecs?: {
    physicalCores: number;
    vcpus: number;
    memoryGiB: number;
    totalNvmeGiB: number;
  };
  /** Selected storage profile specs (bm-disaggregated only) */
  storageProfileSpecs?: {
    physicalCores: number;
    vcpus: number;
    memoryGiB: number;
    totalNvmeGiB: number;
  };
  /** ODF usable storage per node in GiB — from nodeCapacity.usableStorageGiB */
  odfUsableStoragePerNodeGiB?: number;
  /** CSI: boot disk count and capacity (unitNumber 0 per VM) */
  bootVolumeCount?: number;
  bootVolumeCapacityGiB?: number;
  /** CSI: data disk count and capacity (unitNumber > 0 per VM) */
  dataVolumeCount?: number;
  dataVolumeCapacityGiB?: number;
  /** ODF/capacity settings for per-profile viability checks in cost comparison */
  odfSettings?: {
    odfTuningProfile: string;
    odfCpuUnitMode: string;
    htMultiplier: number;
    useHyperthreading: boolean;
    includeRgw: boolean;
    systemReservedCpu: number;
    cpuOvercommit: number;
  };
  /** Parameters for calculating per-profile node counts in cost comparison */
  nodeCalcParams?: {
    totalVCPUs: number;
    totalMemoryGiB: number;
    totalStorageGiB: number;
    evictionThreshold: number;
    nodeRedundancy: number;
    memoryOvercommit: number;
    cpuOvercommit: number;
    replicaFactor: number;
    cephOverhead: number;
    operationalCapacity: number;
    odfTuningProfile: string;
    odfCpuUnitMode: string;
    htMultiplier: number;
    useHyperthreading: boolean;
    includeRgw: boolean;
    systemReservedCpu: number;
    systemReservedMemory: number;
    odfReservedMemory: number;
  };
}

interface SizingCalculatorProps {
  onSizingChange?: (sizing: SizingResult) => void;
  requestedProfile?: string | null;
  onRequestedProfileHandled?: () => void;
  solutionType?: RoksSolutionType;
}

export function SizingCalculator({ onSizingChange, requestedProfile, onRequestedProfileHandled, solutionType: externalSolutionType }: SizingCalculatorProps) {
  const sizing = useSizingCalculator({ onSizingChange, requestedProfile, onRequestedProfileHandled });

  // Sync external solutionType (from page ContentSwitcher) into the hook's state
  useEffect(() => {
    if (externalSolutionType && externalSolutionType !== sizing.solutionType) {
      sizing.setSolutionType(externalSolutionType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when external prop changes
  }, [externalSolutionType]);
  const dataInconsistencies = useDataInconsistencies();

  return (
    <div className="sizing-calculator">
      <Grid narrow>
        {/* Node Profile Selection */}
        <SizingProfileSection
          selectedProfile={sizing.selectedProfile}
          selectedProfileName={sizing.selectedProfileName}
          setSelectedProfileName={sizing.setSelectedProfileName}
          hasUserSelectedProfileRef={sizing.hasUserSelectedProfileRef}
          profileItems={sizing.profileItems}
          profilesLastUpdated={sizing.profilesLastUpdated}
          profilesSource={sizing.profilesSource}
          isRefreshingProfiles={sizing.isRefreshingProfiles}
          refreshProfiles={sizing.refreshProfiles}
          isProfilesApiAvailable={sizing.isProfilesApiAvailable}
          profilesError={sizing.profilesError}
          profileCounts={sizing.profileCounts}
          solutionType={sizing.solutionType}
        />

        {/* Storage Pool Profile (bm-disaggregated only) */}
        {sizing.solutionType === 'bm-disaggregated' && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="sizing-calculator__section">
              <h3 className="sizing-calculator__section-title">Storage Pool Profile (ODF)</h3>
              <p style={{ fontSize: '0.75rem', marginBottom: '0.75rem', color: 'var(--cds-text-secondary)' }}>
                Dedicated NVMe bare metal nodes for ODF storage. These nodes do not run VM workloads.
              </p>
              <Dropdown
                id="storage-profile-dropdown"
                titleText="NVMe Storage Profile"
                label="Select a storage profile"
                items={sizing.storageProfileItems}
                itemToString={(item: { id: string; text: string } | null) => item?.text || ''}
                selectedItem={sizing.storageProfileItems.find(i => i.id === sizing.selectedStorageProfileName) || null}
                onChange={({ selectedItem }: { selectedItem: { id: string; text: string } | null }) => {
                  if (selectedItem) {
                    sizing.setSelectedStorageProfileName(selectedItem.id);
                  }
                }}
              />
              {sizing.selectedStorageProfile && (
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Tag type="blue">{sizing.selectedStorageProfile.physicalCores} cores</Tag>
                  <Tag type="teal">{sizing.selectedStorageProfile.memoryGiB} GiB RAM</Tag>
                  <Tag type="purple">
                    {sizing.selectedStorageProfile.nvmeDisks}&times; {sizing.selectedStorageProfile.nvmeSizeGiB} GiB NVMe
                  </Tag>
                  {sizing.storageNodeCount !== null && (
                    <Tag type="green">{sizing.storageNodeCount} storage nodes</Tag>
                  )}
                </div>
              )}
            </Tile>
          </Column>
        )}

        {/* Row 1: CPU + Memory Settings */}
        <SizingCPUMemorySection
          cpuOvercommit={sizing.cpuOvercommit}
          setCpuOvercommit={sizing.setCpuOvercommit}
          memoryOvercommit={sizing.memoryOvercommit}
          setMemoryOvercommit={sizing.setMemoryOvercommit}
          htMultiplier={sizing.htMultiplier}
          setHtMultiplier={sizing.setHtMultiplier}
          useHyperthreading={sizing.useHyperthreading}
          setUseHyperthreading={sizing.setUseHyperthreading}
          systemReservedCpu={sizing.systemReservedCpu}
          systemReservedMemory={sizing.systemReservedMemory}
          totalReservedCpu={sizing.totalReservedCpu}
          totalReservedMemory={sizing.totalReservedMemory}
          odfTuningProfile={sizing.odfTuningProfile}
          setOdfTuningProfile={sizing.setOdfTuningProfile}
          includeRgw={sizing.includeRgw}
          setIncludeRgw={sizing.setIncludeRgw}
          odfCpuUnitMode={sizing.odfCpuUnitMode}
          setOdfCpuUnitMode={sizing.setOdfCpuUnitMode}
          odfReservation={sizing.odfReservation}
          totalNodes={sizing.nodeRequirements?.totalNodes ?? 3}
          solutionType={sizing.solutionType}
        />

        {/* Row 2: ODF Storage + Capacity Planning */}
        <SizingStorageSection
          storageMetric={sizing.storageMetric}
          setStorageMetric={sizing.setStorageMetric}
          replicaFactor={sizing.replicaFactor}
          setReplicaFactor={sizing.setReplicaFactor}
          operationalCapacity={sizing.operationalCapacity}
          setOperationalCapacity={sizing.setOperationalCapacity}
          cephOverhead={sizing.cephOverhead}
          setCephOverhead={sizing.setCephOverhead}
          annualGrowthRate={sizing.annualGrowthRate}
          setAnnualGrowthRate={sizing.setAnnualGrowthRate}
          planningHorizonYears={sizing.planningHorizonYears}
          setPlanningHorizonYears={sizing.setPlanningHorizonYears}
          virtOverhead={sizing.virtOverhead}
          setVirtOverhead={sizing.setVirtOverhead}
          nodeRedundancy={sizing.nodeRedundancy}
          setNodeRedundancy={sizing.setNodeRedundancy}
          evictionThreshold={sizing.evictionThreshold}
          setEvictionThreshold={sizing.setEvictionThreshold}
          solutionType={sizing.solutionType}
        />

        {/* Per-Node Capacity Results */}
        <SizingNodeCapacity
          selectedProfile={sizing.selectedProfile}
          nodeCapacity={sizing.nodeCapacity}
          totalReservedCpu={sizing.totalReservedCpu}
          useHyperthreading={sizing.useHyperthreading}
          htMultiplier={sizing.htMultiplier}
          cpuOvercommit={sizing.cpuOvercommit}
          memoryOvercommit={sizing.memoryOvercommit}
          totalReservedMemory={sizing.totalReservedMemory}
          replicaFactor={sizing.replicaFactor}
          cephOverhead={sizing.cephOverhead}
          operationalCapacity={sizing.operationalCapacity}
          solutionType={sizing.solutionType}
        />

        {/* Workload-Based Node Requirements (if data is loaded) */}
        {sizing.nodeRequirements && (
          <SizingWorkloadResults
            nodeRequirements={sizing.nodeRequirements}
            nodeCapacity={sizing.nodeCapacity}
            selectedProfile={sizing.selectedProfile}
            nodeRedundancy={sizing.nodeRedundancy}
            odfReservedCpu={sizing.odfReservedCpu}
            odfReservedMemory={sizing.odfReservedMemory}
            systemReservedCpu={sizing.systemReservedCpu}
            systemReservedMemory={sizing.systemReservedMemory}
            useHyperthreading={sizing.useHyperthreading}
            htMultiplier={sizing.htMultiplier}
            cpuOvercommit={sizing.cpuOvercommit}
            memoryOvercommit={sizing.memoryOvercommit}
            cpuFixedPerVM={sizing.cpuFixedPerVM}
            cpuProportionalPercent={sizing.cpuProportionalPercent}
            memoryFixedPerVMMiB={sizing.memoryFixedPerVMMiB}
            memoryProportionalPercent={sizing.memoryProportionalPercent}
            storageMetric={sizing.storageMetric}
            annualGrowthRate={sizing.annualGrowthRate}
            planningHorizonYears={sizing.planningHorizonYears}
            virtOverhead={sizing.virtOverhead}
            replicaFactor={sizing.replicaFactor}
            operationalCapacity={sizing.operationalCapacity}
            cephOverhead={sizing.cephOverhead}
            evictionThreshold={sizing.evictionThreshold}
            odfReservation={sizing.odfReservation}
            solutionType={sizing.solutionType}
            filteredDisks={sizing.filteredDisks}
          />
        )}

        {/* Per-VM Node Fit Check */}
        {sizing.vmFitValidation && !sizing.vmFitValidation.allFit && (
          <SizingVMFitValidation vmFitValidation={sizing.vmFitValidation} />
        )}

        {/* Data Quality Warnings */}
        {dataInconsistencies.warnings.length > 0 && (
          <SizingDataQualityBanner
            warnings={dataInconsistencies.warnings}
            hasCritical={dataInconsistencies.hasCritical}
          />
        )}

        {/* N+X Redundancy Validation */}
        {sizing.redundancyValidation && (
          <SizingRedundancyValidation
            redundancyValidation={sizing.redundancyValidation}
            nodeCapacity={sizing.nodeCapacity}
            nodeRedundancy={sizing.nodeRedundancy}
            evictionThreshold={sizing.evictionThreshold}
            operationalCapacity={sizing.operationalCapacity}
            solutionType={sizing.solutionType}
          />
        )}

        {/* No Data Message */}
        {!sizing.hasData && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="sizing-calculator__no-data">
              <p>Upload RVTools data to calculate node requirements for your specific workload.</p>
            </Tile>
          </Column>
        )}
      </Grid>
    </div>
  );
}
