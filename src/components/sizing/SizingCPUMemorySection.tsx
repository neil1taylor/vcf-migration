// CPU and Memory settings section for the Sizing Calculator
import {
  Column,
  Tile,
  Slider,
  Toggle,
  ContentSwitcher,
  Switch,
  InlineNotification,
} from '@carbon/react';
import type { OdfTuningProfile, OdfCpuUnitMode, OdfReservation } from '@/utils/odfCalculation';
import { getOdfProfiles } from '@/utils/odfCalculation';
import type { RoksSolutionType } from '@/services/costEstimation';

interface SizingCPUMemorySectionProps {
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
  totalReservedCpu: number;
  totalReservedMemory: number;
  odfTuningProfile: OdfTuningProfile;
  setOdfTuningProfile: (profile: OdfTuningProfile) => void;
  includeRgw: boolean;
  setIncludeRgw: (value: boolean) => void;
  odfCpuUnitMode: OdfCpuUnitMode;
  setOdfCpuUnitMode: (mode: OdfCpuUnitMode) => void;
  odfReservation: OdfReservation;
  totalNodes: number;
  solutionType?: RoksSolutionType;
}

const odfProfiles = getOdfProfiles();

export function SizingCPUMemorySection({
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
  totalReservedCpu,
  totalReservedMemory,
  odfTuningProfile,
  setOdfTuningProfile,
  includeRgw,
  setIncludeRgw,
  odfCpuUnitMode,
  setOdfCpuUnitMode,
  odfReservation,
  totalNodes,
  solutionType,
}: SizingCPUMemorySectionProps) {
  // ODF runs on compute nodes for converged/hybrid/bm-block-odf, but NOT for bm-block-csi or bm-disaggregated
  const hasOdfOnCompute = solutionType !== 'bm-block-csi' && solutionType !== 'bm-disaggregated';
  // ODF tuning controls are relevant whenever ODF exists (all except bm-block-csi)
  const hasOdf = solutionType !== 'bm-block-csi';
  const selectedProfileIndex = odfProfiles.findIndex(p => p.id === odfTuningProfile);
  const cpuUnit = odfCpuUnitMode === 'physical' ? 'cores' : 'vCPUs';

  // Format component count for display (e.g., "2 cluster / 3 nodes" or "8 per node")
  const formatComponentLabel = (name: string, detail: { count: number }, isPerNvme: boolean) => {
    if (isPerNvme) {
      return `ODF ${name.toUpperCase()} (${detail.count} per node)`;
    }
    const clusterCounts: Record<string, number> = { mgr: 2, mon: 3, mds: 2, rgw: 2 };
    return `ODF ${name.toUpperCase()} (${clusterCounts[name]} cluster / ${totalNodes} nodes)`;
  };

  return (
    <Column lg={16} md={8} sm={4}>
      {/* ODF Tuning Profile selector — hidden for bm-block-csi (no ODF) */}
      {hasOdf && (
      <Tile className="sizing-calculator__section" style={{ marginBottom: '1rem' }}>
        <h3 className="sizing-calculator__section-title">ODF Tuning Profile</h3>
        <p style={{ fontSize: '0.75rem', marginBottom: '0.75rem', color: 'var(--cds-text-secondary)' }}>
          {solutionType === 'bm-disaggregated'
            ? 'Controls CPU and memory reservations for ODF/Ceph on the dedicated storage pool nodes. Does not affect compute nodes.'
            : 'Controls CPU and memory reservations for ODF/Ceph storage components. Values match Red Hat ODF tuning profile documentation.'}
        </p>

        <ContentSwitcher
          onChange={(e) => {
            if (e.index == null) return;
            const profileId = odfProfiles[e.index]?.id;
            if (profileId) setOdfTuningProfile(profileId);
          }}
          selectedIndex={selectedProfileIndex}
          size="md"
        >
          {odfProfiles.map((p) => (
            <Switch key={p.id} name={p.id} text={p.label} />
          ))}
        </ContentSwitcher>

        <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--cds-text-secondary)' }}>
          {odfProfiles[selectedProfileIndex]?.description}
        </p>

        {odfReservation.profileWarning && (
          <InlineNotification
            kind="warning"
            title="Profile Warning"
            subtitle={odfReservation.profileWarning}
            lowContrast
            hideCloseButton
            style={{ marginTop: '0.5rem' }}
          />
        )}

        <div style={{ display: 'flex', gap: '2rem', marginTop: '0.75rem' }}>
          <Toggle
            id="rgw-toggle"
            labelText="RADOS Gateway (S3)"
            labelA="Off"
            labelB="On"
            toggled={includeRgw}
            onToggle={setIncludeRgw}
            size="sm"
          />
          <Toggle
            id="odf-cpu-unit-toggle"
            labelText="ODF CPU units"
            labelA="Physical Cores"
            labelB="vCPU"
            toggled={odfCpuUnitMode === 'vcpu'}
            onToggle={(checked) => setOdfCpuUnitMode(checked ? 'vcpu' : 'physical')}
            size="sm"
          />
        </div>
        <p style={{ fontSize: '0.6875rem', marginTop: '0.25rem', color: 'var(--cds-text-helper)' }}>
          ODF tuning profiles define CPU in Kubernetes CPU units (vCPUs). Physical Cores mode converts to physical cores for comparison with bare metal specs.
        </p>
      </Tile>
      )}

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
              <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem' }}>
                <span>System (kubelet, etc.):</span>
                <span style={{ textAlign: 'right' }}>{systemReservedCpu} cores</span>

                {/* ODF per-component breakdown — only shown when ODF runs on compute nodes */}
                {hasOdfOnCompute && (<>
                <span>{formatComponentLabel('mgr', odfReservation.mgr, false)}:</span>
                <span style={{ textAlign: 'right' }}>{odfReservation.mgr.totalCpu.toFixed(1)} {cpuUnit}</span>
                <span>{formatComponentLabel('mon', odfReservation.mon, false)}:</span>
                <span style={{ textAlign: 'right' }}>{odfReservation.mon.totalCpu.toFixed(1)} {cpuUnit}</span>
                <span>{formatComponentLabel('osd', odfReservation.osd, true)}:</span>
                <span style={{ textAlign: 'right' }}>{odfReservation.osd.totalCpu.toFixed(1)} {cpuUnit}</span>
                <span>{formatComponentLabel('mds', odfReservation.mds, false)}:</span>
                <span style={{ textAlign: 'right' }}>{odfReservation.mds.totalCpu.toFixed(1)} {cpuUnit}</span>
                {odfReservation.rgw && (
                  <>
                    <span>{formatComponentLabel('rgw', odfReservation.rgw, false)}:</span>
                    <span style={{ textAlign: 'right' }}>{odfReservation.rgw.totalCpu.toFixed(1)} {cpuUnit}</span>
                  </>
                )}
                </>)}

                <span style={{ fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.25rem' }}>Total Reserved:</span>
                <span style={{ textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.25rem' }}>{hasOdfOnCompute ? totalReservedCpu.toFixed(1) : systemReservedCpu} {hasOdfOnCompute ? (odfCpuUnitMode === 'physical' ? 'cores' : 'mixed') : 'cores'}</span>
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
              <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem' }}>
                <span>System (kubelet, etc.):</span>
                <span style={{ textAlign: 'right' }}>{systemReservedMemory} GiB</span>

                {/* ODF per-component memory breakdown — hidden for bm-block-csi */}
                {hasOdf && (<>
                <span>{formatComponentLabel('mgr', odfReservation.mgr, false)}:</span>
                <span style={{ textAlign: 'right' }}>{odfReservation.mgr.totalMemoryGiB.toFixed(1)} GiB</span>
                <span>{formatComponentLabel('mon', odfReservation.mon, false)}:</span>
                <span style={{ textAlign: 'right' }}>{odfReservation.mon.totalMemoryGiB.toFixed(1)} GiB</span>
                <span>{formatComponentLabel('osd', odfReservation.osd, true)}:</span>
                <span style={{ textAlign: 'right' }}>{odfReservation.osd.totalMemoryGiB.toFixed(1)} GiB</span>
                <span>{formatComponentLabel('mds', odfReservation.mds, false)}:</span>
                <span style={{ textAlign: 'right' }}>{odfReservation.mds.totalMemoryGiB.toFixed(1)} GiB</span>
                {odfReservation.rgw && (
                  <>
                    <span>{formatComponentLabel('rgw', odfReservation.rgw, false)}:</span>
                    <span style={{ textAlign: 'right' }}>{odfReservation.rgw.totalMemoryGiB.toFixed(1)} GiB</span>
                  </>
                )}
                </>)}

                <span style={{ fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.25rem' }}>Total Reserved:</span>
                <span style={{ textAlign: 'right', fontWeight: 600, borderTop: '1px solid var(--cds-border-subtle-01)', paddingTop: '0.25rem' }}>{hasOdfOnCompute ? totalReservedMemory.toFixed(1) : systemReservedMemory} GiB</span>
              </div>
            </div>
          </Tile>
        </div>
      </div>
    </Column>
  );
}
