// Interactive sizing calculator for OpenShift Virtualization and ODF
import { useState, useMemo, useEffect } from 'react';
import {
  Grid,
  Column,
  Tile,
  Slider,
  Dropdown,
  Tag,
  Toggle,
  RadioButtonGroup,
  RadioButton,
} from '@carbon/react';
import { useData, useDynamicProfiles } from '@/hooks';
import { formatNumber, formatBytes } from '@/utils/formatters';
import { ProfilesRefresh } from '@/components/profiles';
import ibmCloudConfig from '@/data/ibmCloudConfig.json';
import './SizingCalculator.scss';

interface BareMetalProfile {
  name: string;
  physicalCores: number;
  vcpus: number;
  memoryGiB: number;
  hasNvme: boolean;
  nvmeDisks?: number;
  nvmeSizeGiB?: number;
  totalNvmeGiB?: number;
  useCase?: string;
  description?: string;
}

export interface SizingResult {
  computeNodes: number;
  computeProfile: string;
  storageTiB: number;
  useNvme: boolean;
}

interface SizingCalculatorProps {
  onSizingChange?: (sizing: SizingResult) => void;
}

export function SizingCalculator({ onSizingChange }: SizingCalculatorProps) {
  const { rawData } = useData();
  const hasData = !!rawData;

  // Dynamic profiles hook for refreshing from API
  const {
    isRefreshing: isRefreshingProfiles,
    lastUpdated: profilesLastUpdated,
    source: profilesSource,
    refreshProfiles,
    isApiAvailable: isProfilesApiAvailable,
    error: profilesError,
    profileCounts,
  } = useDynamicProfiles();

  // Get bare metal profiles (flatten from family-organized structure)
  const bareMetalProfiles = useMemo(() => {
    const profiles: BareMetalProfile[] = [];
    const bmProfiles = ibmCloudConfig.bareMetalProfiles;
    for (const family of Object.keys(bmProfiles) as Array<keyof typeof bmProfiles>) {
      profiles.push(...(bmProfiles[family] as BareMetalProfile[]));
    }
    // Filter to only include profiles with NVMe (required for ODF)
    return profiles.filter(p => p.hasNvme);
  }, []);
  const defaults = ibmCloudConfig.defaults;

  // Default to first profile if available
  const defaultProfile = bareMetalProfiles[0];

  // State for sizing parameters
  const [selectedProfile, setSelectedProfile] = useState<BareMetalProfile>(defaultProfile);
  const [cpuOvercommit, setCpuOvercommit] = useState(defaults.cpuOvercommitRatio);
  const [memoryOvercommit, setMemoryOvercommit] = useState(defaults.memoryOvercommitRatio);
  const [htMultiplier, setHtMultiplier] = useState(1.25); // Default HT efficiency
  const [useHyperthreading, setUseHyperthreading] = useState(true);
  const [replicaFactor, setReplicaFactor] = useState(defaults.odfReplicationFactor);
  const [operationalCapacity, setOperationalCapacity] = useState(defaults.odfOperationalCapacity * 100);
  const [cephOverhead, setCephOverhead] = useState(defaults.odfCephOverhead * 100);
  const [systemReservedMemory, setSystemReservedMemory] = useState(defaults.systemReservedMemoryGiB);
  const [nodeRedundancy, setNodeRedundancy] = useState(defaults.nodeRedundancy);
  const [storageMetric, setStorageMetric] = useState<'provisioned' | 'inUse'>('inUse'); // Recommended: use actual data footprint
  const [annualGrowthRate, setAnnualGrowthRate] = useState(20); // 20% annual growth default
  const [planningHorizonYears, setPlanningHorizonYears] = useState(2); // 2-year planning horizon
  const [virtOverhead, setVirtOverhead] = useState(15); // 10-15% for OpenShift Virtualization

  // Calculate per-node capacities
  const nodeCapacity = useMemo(() => {
    // CPU capacity calculation
    // Physical cores × HT multiplier (if enabled) × CPU overcommit ratio
    const effectiveCores = useHyperthreading
      ? selectedProfile.physicalCores * htMultiplier
      : selectedProfile.physicalCores;
    const vcpuCapacity = Math.floor(effectiveCores * cpuOvercommit);

    // Memory capacity calculation
    // Total memory - system reserved × memory overcommit
    const availableMemoryGiB = Math.max(0, selectedProfile.memoryGiB - systemReservedMemory);
    const memoryCapacity = Math.floor(availableMemoryGiB * memoryOvercommit);

    // Storage capacity calculation
    // Raw NVMe / replica factor × operational capacity × (1 - Ceph overhead)
    const rawStorageGiB = selectedProfile.totalNvmeGiB ?? 0;
    const storageEfficiency = (1 / replicaFactor) * (operationalCapacity / 100) * (1 - cephOverhead / 100);
    const usableStorageGiB = Math.floor(rawStorageGiB * storageEfficiency);

    return {
      vcpuCapacity,
      memoryCapacity,
      usableStorageGiB,
      rawStorageGiB,
      storageEfficiency,
      effectiveCores,
    };
  }, [
    selectedProfile,
    cpuOvercommit,
    memoryOvercommit,
    htMultiplier,
    useHyperthreading,
    replicaFactor,
    operationalCapacity,
    cephOverhead,
    systemReservedMemory,
  ]);

  // Calculate required nodes based on uploaded data
  const nodeRequirements = useMemo(() => {
    if (!hasData || !rawData) return null;

    // Filter to only powered-on VMs (non-templates)
    const vms = rawData.vInfo.filter(vm => !vm.template && vm.powerState === 'poweredOn');

    // Calculate totals directly from rawData
    const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const totalMemoryGiB = vms.reduce((sum, vm) => sum + vm.memory, 0) / 1024; // MiB to GiB
    const provisionedStorageGiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0) / 1024;
    const inUseStorageGiB = vms.reduce((sum, vm) => sum + vm.inUseMiB, 0) / 1024;
    const baseStorageGiB = storageMetric === 'provisioned' ? provisionedStorageGiB : inUseStorageGiB;

    // Apply growth factor: (1 + rate)^years
    const growthMultiplier = Math.pow(1 + annualGrowthRate / 100, planningHorizonYears);

    // Apply virtualization overhead (snapshots, clones, live migration scratch space)
    const virtOverheadMultiplier = 1 + virtOverhead / 100;

    // Total storage with all factors applied
    const totalStorageGiB = baseStorageGiB * growthMultiplier * virtOverheadMultiplier;

    // Nodes required for each dimension
    const nodesForCPU = Math.ceil(totalVCPUs / nodeCapacity.vcpuCapacity);
    const nodesForMemory = Math.ceil(totalMemoryGiB / nodeCapacity.memoryCapacity);
    const nodesForStorage = Math.ceil(totalStorageGiB / nodeCapacity.usableStorageGiB);

    // Minimum 3 nodes for ODF quorum
    const baseNodes = Math.max(3, nodesForCPU, nodesForMemory, nodesForStorage);
    const totalNodes = baseNodes + nodeRedundancy;

    // Determine limiting factor
    let limitingFactor: 'cpu' | 'memory' | 'storage' = 'cpu';
    if (nodesForMemory >= nodesForCPU && nodesForMemory >= nodesForStorage) {
      limitingFactor = 'memory';
    } else if (nodesForStorage >= nodesForCPU && nodesForStorage >= nodesForMemory) {
      limitingFactor = 'storage';
    }

    return {
      totalVCPUs,
      totalMemoryGiB,
      baseStorageGiB,
      totalStorageGiB,
      provisionedStorageGiB,
      inUseStorageGiB,
      growthMultiplier,
      virtOverheadMultiplier,
      nodesForCPU,
      nodesForMemory,
      nodesForStorage,
      baseNodes,
      totalNodes,
      limitingFactor,
      vmCount: vms.length,
    };
  }, [hasData, rawData, nodeCapacity, nodeRedundancy, storageMetric, annualGrowthRate, planningHorizonYears, virtOverhead]);

  // Notify parent component of sizing changes
  useEffect(() => {
    if (onSizingChange && nodeRequirements) {
      // Map profile name to pricing profile name
      const pricingProfileMap: Record<string, string> = {
        'mx2d.metal.96x768.24xSSD': 'mx2d.metal.96x768',
        'bx2d.metal.96x384.8xSSD': 'bx2d.metal.96x384',
        'cx2d.metal.96x192.8xSSD': 'cx2d.metal.96x192',
      };

      onSizingChange({
        computeNodes: nodeRequirements.totalNodes,
        computeProfile: pricingProfileMap[selectedProfile.name] || 'mx2d.metal.96x768',
        storageTiB: Math.ceil(nodeRequirements.totalStorageGiB / 1024),
        useNvme: true,
      });
    }
  }, [nodeRequirements, selectedProfile, onSizingChange]);

  // Profile dropdown items
  const profileItems = bareMetalProfiles.map((p) => ({
    id: p.name,
    text: `${p.name} (${p.physicalCores}c/${p.vcpus}t, ${p.memoryGiB} GiB, ${p.nvmeDisks}×${p.nvmeSizeGiB} GiB NVMe)`,
  }));

  return (
    <div className="sizing-calculator">
      <Grid narrow>
        {/* Node Profile Selection */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="sizing-calculator__section">
            <div className="sizing-calculator__section-header">
              <h3 className="sizing-calculator__section-title">Bare Metal Node Profile</h3>
              <ProfilesRefresh
                lastUpdated={profilesLastUpdated}
                source={profilesSource}
                isRefreshing={isRefreshingProfiles}
                onRefresh={refreshProfiles}
                isApiAvailable={isProfilesApiAvailable}
                error={profilesError}
                profileCounts={profileCounts}
                compact
              />
            </div>
            <Dropdown
              id="profile-selector"
              titleText="Select IBM Cloud Bare Metal Profile"
              label="Choose a profile"
              items={profileItems}
              itemToString={(item) => item?.text || ''}
              selectedItem={profileItems.find((p) => p.id === selectedProfile.name) || profileItems[0]}
              onChange={({ selectedItem }) => {
                const profile = bareMetalProfiles.find((p) => p.name === selectedItem?.id);
                if (profile) setSelectedProfile(profile);
              }}
            />
            <div className="sizing-calculator__profile-details">
              <Tag type="blue">{selectedProfile.physicalCores} Physical Cores</Tag>
              <Tag type="cyan">{selectedProfile.vcpus} Threads (HT)</Tag>
              <Tag type="teal">{selectedProfile.memoryGiB} GiB RAM</Tag>
              <Tag type="purple">{selectedProfile.nvmeDisks}× {selectedProfile.nvmeSizeGiB} GiB NVMe</Tag>
            </div>
          </Tile>
        </Column>

        {/* CPU Settings */}
        <Column lg={8} md={4} sm={4}>
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
                formatLabel={(val) => `${val.toFixed(2)}×`}
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
              <span className="label">Recommended:</span> 1.8:1 (conservative), 4:1 (standard), 10:1 (max)
            </div>
          </Tile>
        </Column>

        {/* Memory Settings */}
        <Column lg={8} md={4} sm={4}>
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

            <Slider
              id="system-reserved"
              labelText="System Reserved Memory (GiB)"
              min={8}
              max={24}
              step={1}
              value={systemReservedMemory}
              onChange={({ value }) => setSystemReservedMemory(value)}
              formatLabel={(val) => `${val} GiB`}
            />

            <div className="sizing-calculator__info-text">
              <span className="label">Recommended:</span> 1:1 (no overcommit) for VM workloads
            </div>
          </Tile>
        </Column>

        {/* ODF Storage Settings */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="sizing-calculator__section">
            <h3 className="sizing-calculator__section-title">ODF Storage Settings</h3>

            <div className="sizing-calculator__radio-group">
              <RadioButtonGroup
                legendText="Storage Metric for Sizing"
                name="storage-metric"
                valueSelected={storageMetric}
                onChange={(value) => setStorageMetric(value as 'provisioned' | 'inUse')}
                orientation="horizontal"
              >
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
              <strong>Recommended:</strong> Use &quot;In Use&quot; (actual data footprint). Avoid &quot;Provisioned&quot; which includes thin-provisioned promises.
            </div>

            <Slider
              id="replica-factor"
              labelText="Replica Factor (Data Protection)"
              min={2}
              max={3}
              step={1}
              value={replicaFactor}
              onChange={({ value }) => setReplicaFactor(value)}
              formatLabel={(val) => `${val}× replication`}
            />

            <Slider
              id="operational-capacity"
              labelText="Operational Capacity (Free Space)"
              min={50}
              max={90}
              step={5}
              value={operationalCapacity}
              onChange={({ value }) => setOperationalCapacity(value)}
              formatLabel={(val) => `${val}% (${100 - val}% free)`}
            />

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
          </Tile>
        </Column>

        {/* Growth & Virtualization Overhead */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="sizing-calculator__section">
            <h3 className="sizing-calculator__section-title">Growth &amp; Virtualization Overhead</h3>

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
              labelText="OpenShift Virtualization Overhead"
              min={0}
              max={25}
              step={5}
              value={virtOverhead}
              onChange={({ value }) => setVirtOverhead(value)}
              formatLabel={(val) => `${val}%`}
            />

            <div className="sizing-calculator__info-text">
              <span className="label">Virt overhead includes:</span> VM snapshots, clone operations, live migration scratch space, CDI imports
            </div>
          </Tile>
        </Column>

        {/* Redundancy Settings */}
        <Column lg={8} md={4} sm={4}>
          <Tile className="sizing-calculator__section">
            <h3 className="sizing-calculator__section-title">Redundancy Settings</h3>

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
              <span className="label">Recommended:</span> N+2 for maintenance + failure tolerance
            </div>
          </Tile>
        </Column>

        {/* Per-Node Capacity Results */}
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
                    {selectedProfile.physicalCores} cores × {useHyperthreading ? `${htMultiplier}× HT × ` : ''}{cpuOvercommit}:1
                  </span>
                </div>
              </Column>

              <Column lg={4} md={4} sm={4}>
                <div className="sizing-calculator__result-card sizing-calculator__result-card--memory">
                  <span className="sizing-calculator__result-label">Memory Capacity</span>
                  <span className="sizing-calculator__result-value">{formatNumber(nodeCapacity.memoryCapacity)} GiB</span>
                  <span className="sizing-calculator__result-detail">
                    ({selectedProfile.memoryGiB} - {systemReservedMemory}) × {memoryOvercommit}:1
                  </span>
                </div>
              </Column>

              <Column lg={4} md={4} sm={4}>
                <div className="sizing-calculator__result-card sizing-calculator__result-card--storage">
                  <span className="sizing-calculator__result-label">Usable Storage</span>
                  <span className="sizing-calculator__result-value">{formatBytes(nodeCapacity.usableStorageGiB * 1024 * 1024 * 1024)}</span>
                  <span className="sizing-calculator__result-detail">
                    1/{replicaFactor} × {operationalCapacity}% × {100 - cephOverhead}%
                  </span>
                </div>
              </Column>
            </Grid>
          </Tile>
        </Column>

        {/* Workload-Based Node Requirements (if data is loaded) */}
        {nodeRequirements && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="sizing-calculator__workload-results">
              <h3 className="sizing-calculator__section-title">Node Requirements for Your Workload</h3>
              <p className="sizing-calculator__subtitle">
                Based on {formatNumber(nodeRequirements.vmCount)} powered-on VMs from uploaded RVTools data
              </p>

              <Grid narrow>
                <Column lg={4} md={4} sm={2}>
                  <div className="sizing-calculator__workload-card">
                    <span className="sizing-calculator__workload-label">Total vCPUs</span>
                    <span className="sizing-calculator__workload-value">{formatNumber(nodeRequirements.totalVCPUs)}</span>
                    <span className={`sizing-calculator__workload-nodes ${nodeRequirements.limitingFactor === 'cpu' ? 'sizing-calculator__workload-nodes--limiting' : ''}`}>
                      {nodeRequirements.nodesForCPU} nodes
                      {nodeRequirements.limitingFactor === 'cpu' && <Tag type="red" size="sm">Limiting</Tag>}
                    </span>
                  </div>
                </Column>

                <Column lg={4} md={4} sm={2}>
                  <div className="sizing-calculator__workload-card">
                    <span className="sizing-calculator__workload-label">Total Memory</span>
                    <span className="sizing-calculator__workload-value">{formatNumber(Math.round(nodeRequirements.totalMemoryGiB))} GiB</span>
                    <span className={`sizing-calculator__workload-nodes ${nodeRequirements.limitingFactor === 'memory' ? 'sizing-calculator__workload-nodes--limiting' : ''}`}>
                      {nodeRequirements.nodesForMemory} nodes
                      {nodeRequirements.limitingFactor === 'memory' && <Tag type="red" size="sm">Limiting</Tag>}
                    </span>
                  </div>
                </Column>

                <Column lg={4} md={4} sm={2}>
                  <div className="sizing-calculator__workload-card">
                    <span className="sizing-calculator__workload-label">Total Storage (with growth)</span>
                    <span className="sizing-calculator__workload-value">{formatBytes(nodeRequirements.totalStorageGiB * 1024 * 1024 * 1024)}</span>
                    <span className={`sizing-calculator__workload-nodes ${nodeRequirements.limitingFactor === 'storage' ? 'sizing-calculator__workload-nodes--limiting' : ''}`}>
                      {nodeRequirements.nodesForStorage} nodes
                      {nodeRequirements.limitingFactor === 'storage' && <Tag type="red" size="sm">Limiting</Tag>}
                    </span>
                    <span className="sizing-calculator__workload-detail" style={{ fontSize: '0.7rem', color: '#525252', marginTop: '0.25rem' }}>
                      Base: {formatBytes(nodeRequirements.baseStorageGiB * 1024 * 1024 * 1024)} ({storageMetric === 'inUse' ? 'In Use' : 'Provisioned'})
                    </span>
                  </div>
                </Column>

                <Column lg={4} md={4} sm={2}>
                  <div className="sizing-calculator__workload-card sizing-calculator__workload-card--total">
                    <span className="sizing-calculator__workload-label">Recommended Nodes</span>
                    <span className="sizing-calculator__workload-value sizing-calculator__workload-value--large">
                      {nodeRequirements.totalNodes}
                    </span>
                    <span className="sizing-calculator__workload-nodes">
                      {nodeRequirements.baseNodes} base + {nodeRedundancy} redundancy
                    </span>
                  </div>
                </Column>
              </Grid>

              <div className="sizing-calculator__formula-display">
                <code>
                  max({nodeRequirements.nodesForCPU} CPU, {nodeRequirements.nodesForMemory} Memory, {nodeRequirements.nodesForStorage} Storage)
                  + {nodeRedundancy} = <strong>{nodeRequirements.totalNodes} nodes</strong>
                </code>
              </div>
            </Tile>
          </Column>
        )}

        {/* No Data Message */}
        {!hasData && (
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
