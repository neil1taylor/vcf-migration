// Per-node usable capacity results section for the Sizing Calculator
import {
  Grid,
  Column,
  Tile,
} from '@carbon/react';
import { formatNumber, formatBytes } from '@/utils/formatters';
import type { BareMetalProfile, NodeCapacity } from '@/hooks/useSizingCalculator';

interface SizingNodeCapacityProps {
  selectedProfile: BareMetalProfile;
  nodeCapacity: NodeCapacity;
  totalReservedCpu: number;
  useHyperthreading: boolean;
  htMultiplier: number;
  cpuOvercommit: number;
  memoryOvercommit: number;
  totalReservedMemory: number;
  replicaFactor: number;
  cephOverhead: number;
  operationalCapacity: number;
}

export function SizingNodeCapacity({
  selectedProfile,
  nodeCapacity,
  totalReservedCpu,
  useHyperthreading,
  htMultiplier,
  cpuOvercommit,
  memoryOvercommit,
  totalReservedMemory,
  replicaFactor,
  cephOverhead,
  operationalCapacity,
}: SizingNodeCapacityProps) {
  return (
    <Column lg={16} md={8} sm={4}>
      <Tile className="sizing-calculator__results">
        <h3 className="sizing-calculator__section-title">Per-Node Usable Capacity</h3>
        <p className="sizing-calculator__subtitle">
          Based on {selectedProfile.name} with current settings
        </p>

        <Grid narrow>
          <Column lg={4} md={4} sm={4}>
            <div className="sizing-calculator__result-card sizing-calculator__result-card--cpu">
              <span className="sizing-calculator__result-label">vCPU Capacity</span>
              <span className="sizing-calculator__result-value">{formatNumber(nodeCapacity.vcpuCapacity)}</span>
              <span className="sizing-calculator__result-detail">
                ({selectedProfile.physicalCores} - {totalReservedCpu}) &times; {useHyperthreading ? `${htMultiplier}\u00d7 HT \u00d7 ` : ''}{cpuOvercommit}:1
              </span>
            </div>
          </Column>

          <Column lg={4} md={4} sm={4}>
            <div className="sizing-calculator__result-card sizing-calculator__result-card--memory">
              <span className="sizing-calculator__result-label">Memory Capacity</span>
              <span className="sizing-calculator__result-value">{formatNumber(nodeCapacity.memoryCapacity)} GiB</span>
              <span className="sizing-calculator__result-detail">
                ({selectedProfile.memoryGiB} - {totalReservedMemory}) &times; {memoryOvercommit}:1
              </span>
            </div>
          </Column>

          <Column lg={4} md={4} sm={4}>
            <div className="sizing-calculator__result-card sizing-calculator__result-card--storage">
              <span className="sizing-calculator__result-label">Max Usable Storage</span>
              <span className="sizing-calculator__result-value">{formatBytes(nodeCapacity.maxUsableStorageGiB * 1024 * 1024 * 1024)}</span>
              <span className="sizing-calculator__result-detail">
                1/{replicaFactor} &times; {100 - cephOverhead}%
              </span>
            </div>
          </Column>

          <Column lg={4} md={4} sm={4}>
            <div className="sizing-calculator__result-card sizing-calculator__result-card--storage">
              <span className="sizing-calculator__result-label">Usable Storage</span>
              <span className="sizing-calculator__result-value">{formatBytes(nodeCapacity.usableStorageGiB * 1024 * 1024 * 1024)}</span>
              <span className="sizing-calculator__result-detail">
                Max &times; {operationalCapacity}% Operational Capacity
              </span>
            </div>
          </Column>
        </Grid>
      </Tile>
    </Column>
  );
}
