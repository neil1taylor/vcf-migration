// Interactive sizing calculator for OpenShift Virtualization and ODF
import {
  Grid,
  Column,
  Tile,
} from '@carbon/react';
import { useSizingCalculator } from '@/hooks/useSizingCalculator';
import { SizingProfileSection } from '@/components/sizing/SizingProfileSection';
import { SizingCPUMemorySection } from '@/components/sizing/SizingCPUMemorySection';
import { SizingStorageSection } from '@/components/sizing/SizingStorageSection';
import { SizingNodeCapacity } from '@/components/sizing/SizingNodeCapacity';
import { SizingWorkloadResults } from '@/components/sizing/SizingWorkloadResults';
import { SizingRedundancyValidation } from '@/components/sizing/SizingRedundancyValidation';
import './SizingCalculator.scss';

export interface SizingResult {
  computeNodes: number;
  computeProfile: string;
  storageTiB: number;
  useNvme: boolean;
}

interface SizingCalculatorProps {
  onSizingChange?: (sizing: SizingResult) => void;
  requestedProfile?: string | null;
  onRequestedProfileHandled?: () => void;
}

export function SizingCalculator({ onSizingChange, requestedProfile, onRequestedProfileHandled }: SizingCalculatorProps) {
  const sizing = useSizingCalculator({ onSizingChange, requestedProfile, onRequestedProfileHandled });

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
        />

        {/* Row 1: CPU + Memory Settings */}
        <SizingCPUMemorySection
          selectedProfile={sizing.selectedProfile}
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
          odfReservedCpu={sizing.odfReservedCpu}
          odfReservedMemory={sizing.odfReservedMemory}
          totalReservedCpu={sizing.totalReservedCpu}
          totalReservedMemory={sizing.totalReservedMemory}
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
