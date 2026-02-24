// ODF Storage settings and Capacity Planning section for the Sizing Calculator
import {
  Column,
  Tile,
  Slider,
  Tag,
  RadioButtonGroup,
  RadioButton,
} from '@carbon/react';

interface SizingStorageSectionProps {
  storageMetric: 'provisioned' | 'inUse' | 'diskCapacity';
  setStorageMetric: (value: 'provisioned' | 'inUse' | 'diskCapacity') => void;
  replicaFactor: number;
  setReplicaFactor: (value: number) => void;
  operationalCapacity: number;
  setOperationalCapacity: (value: number) => void;
  cephOverhead: number;
  setCephOverhead: (value: number) => void;
  annualGrowthRate: number;
  setAnnualGrowthRate: (value: number) => void;
  planningHorizonYears: number;
  setPlanningHorizonYears: (value: number) => void;
  virtOverhead: number;
  setVirtOverhead: (value: number) => void;
  nodeRedundancy: number;
  setNodeRedundancy: (value: number) => void;
  evictionThreshold: number;
  setEvictionThreshold: (value: number) => void;
}

export function SizingStorageSection({
  storageMetric,
  setStorageMetric,
  replicaFactor,
  setReplicaFactor,
  operationalCapacity,
  setOperationalCapacity,
  cephOverhead,
  setCephOverhead,
  annualGrowthRate,
  setAnnualGrowthRate,
  planningHorizonYears,
  setPlanningHorizonYears,
  virtOverhead,
  setVirtOverhead,
  nodeRedundancy,
  setNodeRedundancy,
  evictionThreshold,
  setEvictionThreshold,
}: SizingStorageSectionProps) {
  return (
    <Column lg={16} md={8} sm={4}>
      <div className="sizing-calculator__settings-grid">
        {/* ODF Storage Settings */}
        <div>
          <Tile className="sizing-calculator__section">
            <h3 className="sizing-calculator__section-title">ODF Storage Settings</h3>

            <div className="sizing-calculator__radio-group">
              <RadioButtonGroup
                legendText="Storage Metric for Sizing"
                name="storage-metric"
                valueSelected={storageMetric}
                onChange={(value) => setStorageMetric(value as 'provisioned' | 'inUse' | 'diskCapacity')}
                orientation="horizontal"
              >
                <RadioButton
                  id="storage-disk-capacity"
                  value="diskCapacity"
                  labelText="Disk Capacity"
                />
                <RadioButton
                  id="storage-inuse"
                  value="inUse"
                  labelText="In Use (recommended)"
                />
                <RadioButton
                  id="storage-provisioned"
                  value="provisioned"
                  labelText="Provisioned (conservative)"
                />
              </RadioButtonGroup>
            </div>

            <div className="sizing-calculator__info-text" style={{ marginBottom: '1rem', fontSize: '0.75rem' }}>
              <strong>Disk Capacity:</strong> Full disk size (VMs may grow to use full capacity).<br />
              <strong>In Use (recommended):</strong> Actual consumed storage including snapshots.<br />
              <strong>Provisioned:</strong> Allocated capacity including thin-provisioned promises.
            </div>

            <Slider
              id="replica-factor"
              labelText="Replica Factor (Data Protection)"
              min={2}
              max={3}
              step={1}
              value={replicaFactor}
              onChange={({ value }) => setReplicaFactor(value)}
              formatLabel={(val) => `${val}\u00d7 replication`}
            />

            <Slider
              id="operational-capacity"
              labelText="Operational Capacity"
              min={50}
              max={90}
              step={5}
              value={operationalCapacity}
              onChange={({ value }) => setOperationalCapacity(value)}
              formatLabel={(val) => `${val}%`}
            />
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '-0.5rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: 'var(--cds-text-secondary)'
            }}>
              <span>Ceph Reserve:</span>
              <Tag type="purple" size="sm">{100 - operationalCapacity}%</Tag>
            </div>

            <Slider
              id="ceph-overhead"
              labelText="Ceph Metadata Overhead"
              min={10}
              max={25}
              step={1}
              value={cephOverhead}
              onChange={({ value }) => setCephOverhead(value)}
              formatLabel={(val) => `${val}%`}
            />

            <div className="sizing-calculator__info-text" style={{ marginTop: '0.5rem' }}>
              <span className="label">ODF best practice:</span> Keep 30-40% free space. Ceph degrades above 75-80% utilization.
            </div>

            <div className="sizing-calculator__info-text" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <span className="label">Replica Factor Tradeoffs</span><br />
              &bull; <strong>2&times; replication:</strong> 50% storage efficiency, tolerates 1 disk/node failure<br />
              &bull; <strong>3&times; replication:</strong> 33% storage efficiency, tolerates 2 failures (recommended for production)
            </div>

            <div className="sizing-calculator__info-text" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
              <span className="label">NVMe Storage Benefits</span><br />
              &bull; Local NVMe provides lowest latency for VM disk I/O<br />
              &bull; ODF pools NVMe across nodes for shared storage<br />
              &bull; No external SAN/NAS dependencies
            </div>
          </Tile>
        </div>

        {/* Capacity Planning - Growth, Overhead & Redundancy */}
        <div>
          <Tile className="sizing-calculator__section">
            <h3 className="sizing-calculator__section-title">Capacity Planning</h3>

            <div className="sizing-calculator__subsection">
              <h4 className="sizing-calculator__subsection-title">Growth &amp; Virtualization Overhead</h4>

              <Slider
                id="annual-growth"
                labelText="Annual Data Growth Rate"
                min={0}
                max={50}
                step={5}
                value={annualGrowthRate}
                onChange={({ value }) => setAnnualGrowthRate(value)}
                formatLabel={(val) => `${val}%`}
              />

              <Slider
                id="planning-horizon"
                labelText="Planning Horizon"
                min={1}
                max={5}
                step={1}
                value={planningHorizonYears}
                onChange={({ value }) => setPlanningHorizonYears(value)}
                formatLabel={(val) => `${val} year${val > 1 ? 's' : ''}`}
              />

              <Slider
                id="virt-overhead"
                labelText="Storage Virtualization Overhead"
                min={0}
                max={25}
                step={5}
                value={virtOverhead}
                onChange={({ value }) => setVirtOverhead(value)}
                formatLabel={(val) => `${val}%`}
              />

              <div className="sizing-calculator__info-text">
                <span className="label">Storage overhead includes:</span> VM snapshots, clone operations, live migration scratch space, CDI imports
              </div>

              <div className="sizing-calculator__info-box" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-layer-02)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>CPU &amp; Memory Virtualization Overhead</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
                  Calculated automatically based on VM count and sizes using KubeVirt overhead formulas.
                  <a href="/overhead-reference" style={{ marginLeft: '0.5rem', color: 'var(--cds-link-primary)' }}>View details</a>
                </div>
              </div>
            </div>

            <div className="sizing-calculator__subsection">
              <h4 className="sizing-calculator__subsection-title">Redundancy Settings</h4>

              <Slider
                id="node-redundancy"
                labelText="Node Redundancy (N+X)"
                min={0}
                max={4}
                step={1}
                value={nodeRedundancy}
                onChange={({ value }) => setNodeRedundancy(value)}
                formatLabel={(val) => `N+${val}`}
              />

              <div className="sizing-calculator__info-text">
                <span className="label">N+{nodeRedundancy}:</span> Cluster survives {nodeRedundancy} node failure{nodeRedundancy !== 1 ? 's' : ''} while staying below eviction threshold
              </div>

              <Slider
                id="eviction-threshold"
                labelText="Eviction Threshold"
                min={80}
                max={99}
                step={1}
                value={evictionThreshold}
                onChange={({ value }) => setEvictionThreshold(value)}
                formatLabel={(val) => `${val}% (${100 - val}% buffer)`}
              />

              <div className="sizing-calculator__info-text">
                <span className="label">Recommended:</span> 96% triggers VM migration before nodes become critically full
              </div>
            </div>
          </Tile>
        </div>
      </div>
    </Column>
  );
}
