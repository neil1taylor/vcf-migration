// CPU and Memory settings section for the Sizing Calculator
import {
  Column,
  Tile,
  Slider,
  Toggle,
} from '@carbon/react';
import type { BareMetalProfile } from '@/hooks/useSizingCalculator';

interface SizingCPUMemorySectionProps {
  selectedProfile: BareMetalProfile;
  cpuOvercommit: number;
  setCpuOvercommit: (value: number) => void;
  memoryOvercommit: number;
  setMemoryOvercommit: (value: number) => void;
  htMultiplier: number;
  setHtMultiplier: (value: number) => void;
  useHyperthreading: boolean;
  setUseHyperthreading: (value: boolean) => void;
  systemReservedCpu: number;
  systemReservedMemory: number;
  odfReservedCpu: number;
  odfReservedMemory: number;
  totalReservedCpu: number;
  totalReservedMemory: number;
}

export function SizingCPUMemorySection({
  selectedProfile,
  cpuOvercommit,
  setCpuOvercommit,
  memoryOvercommit,
  setMemoryOvercommit,
  htMultiplier,
  setHtMultiplier,
  useHyperthreading,
  setUseHyperthreading,
  systemReservedCpu,
  systemReservedMemory,
  odfReservedCpu,
  odfReservedMemory,
  totalReservedCpu,
  totalReservedMemory,
}: SizingCPUMemorySectionProps) {
  return (
    <Column lg={16} md={8} sm={4}>
      <div className="sizing-calculator__settings-grid">
        {/* CPU Settings */}
        <div>
          <Tile className="sizing-calculator__section">
            <h3 className="sizing-calculator__section-title">CPU Settings</h3>

            <div className="sizing-calculator__toggle-row">
              <Toggle
                id="ht-toggle"
                labelText="Hyperthreading (SMT)"
                labelA="Disabled"
                labelB="Enabled"
                toggled={useHyperthreading}
                onToggle={(checked) => setUseHyperthreading(checked)}
              />
            </div>

            {useHyperthreading && (
              <Slider
                id="ht-multiplier"
                labelText="Hyperthreading Efficiency Multiplier"
                min={1.0}
                max={1.5}
                step={0.05}
                value={htMultiplier}
                onChange={({ value }) => setHtMultiplier(value)}
                formatLabel={(val) => `${val.toFixed(2)}\u00d7`}
              />
            )}

            <Slider
              id="cpu-overcommit"
              labelText="CPU Overcommit Ratio"
              min={1.0}
              max={10.0}
              step={0.1}
              value={cpuOvercommit}
              onChange={({ value }) => setCpuOvercommit(value)}
              formatLabel={(val) => `${val.toFixed(1)}:1`}
            />

            <div className="sizing-calculator__info-text">
              <span className="label">Recommended:</span> 4:1 (conservative), 5:1 (standard), 10:1 (max)
            </div>

            <div className="sizing-calculator__reserved-summary" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-layer-02)', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Infrastructure Reserved (per node):</div>
              <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                <span>System (kubelet, etc.):</span>
                <span style={{ textAlign: 'right' }}>{systemReservedCpu} cores</span>
                <span>ODF/Ceph ({selectedProfile.nvmeDisks} devices):</span>
                <span style={{ textAlign: 'right' }}>{odfReservedCpu} cores</span>
                <span style={{ fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.25rem' }}>Total Reserved:</span>
                <span style={{ textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.25rem' }}>{totalReservedCpu} cores</span>
              </div>
            </div>
          </Tile>
        </div>

        {/* Memory Settings */}
        <div>
          <Tile className="sizing-calculator__section">
            <h3 className="sizing-calculator__section-title">Memory Settings</h3>

            <Slider
              id="memory-overcommit"
              labelText="Memory Overcommit Ratio"
              min={1.0}
              max={2.0}
              step={0.1}
              value={memoryOvercommit}
              onChange={({ value }) => setMemoryOvercommit(value)}
              formatLabel={(val) => `${val.toFixed(1)}:1`}
            />

            <div className="sizing-calculator__info-text">
              <span className="label">Recommended:</span> 1:1 (no overcommit) for VM workloads
            </div>

            <div className="sizing-calculator__info-text" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <span className="label">Why 1:1?</span> Unlike containers, VMs have fixed memory allocations. Memory overcommit can cause:<br />
              &bull; OOM kills when host memory is exhausted<br />
              &bull; Performance degradation from memory ballooning<br />
              &bull; Unpredictable VM behavior under pressure
            </div>

            <div className="sizing-calculator__info-text" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <span className="label">When to consider 1.5:1</span><br />
              &bull; VMs with large memory allocations but low actual usage<br />
              &bull; Dev/test environments with lower SLA requirements<br />
              &bull; Workloads with predictable, non-overlapping peak usage
            </div>

            <div className="sizing-calculator__reserved-summary" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-layer-02)', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>Infrastructure Reserved (per node):</div>
              <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                <span>System (kubelet, etc.):</span>
                <span style={{ textAlign: 'right' }}>{systemReservedMemory} GiB</span>
                <span>ODF/Ceph ({selectedProfile.nvmeDisks} devices):</span>
                <span style={{ textAlign: 'right' }}>{odfReservedMemory} GiB</span>
                <span style={{ fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.25rem' }}>Total Reserved:</span>
                <span style={{ textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.25rem' }}>{totalReservedMemory} GiB</span>
              </div>
            </div>
          </Tile>
        </div>
      </div>
    </Column>
  );
}
