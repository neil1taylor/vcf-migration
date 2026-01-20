// Interactive sizing calculator for OpenShift Virtualization and ODF
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Grid,
  Column,
  Tile,
  Slider,
  Select,
  SelectItem,
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
  roksSupported?: boolean;
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
  // Include all profiles, not just NVMe-enabled ones
  const bareMetalProfiles = useMemo(() => {
    const profiles: BareMetalProfile[] = [];
    const bmProfiles = ibmCloudConfig.bareMetalProfiles;
    for (const family of Object.keys(bmProfiles) as Array<keyof typeof bmProfiles>) {
      profiles.push(...(bmProfiles[family] as BareMetalProfile[]));
    }
    // Sort: ROKS-supported profiles with NVMe first, then others
    return profiles.sort((a, b) => {
      // First, sort by ROKS support (supported first)
      if (a.roksSupported && !b.roksSupported) return -1;
      if (!a.roksSupported && b.roksSupported) return 1;
      // Then by NVMe (with NVMe first)
      if (a.hasNvme && !b.hasNvme) return -1;
      if (!a.hasNvme && b.hasNvme) return 1;
      // Then by memory (higher first)
      return b.memoryGiB - a.memoryGiB;
    });
  }, []);
  const defaults = ibmCloudConfig.defaults;

  // Default to first profile with NVMe (best for ROKS/ODF)
  const defaultProfileName = useMemo(() => {
    const profile = bareMetalProfiles.find(p => p.hasNvme && p.roksSupported) || bareMetalProfiles[0];
    return profile?.name || '';
  }, [bareMetalProfiles]);

  // Store only the profile NAME (string) to avoid object reference issues
  const [selectedProfileName, setSelectedProfileName] = useState<string>(() => defaultProfileName);

  // Derive the full profile object from the name
  const selectedProfile = useMemo(() => {
    return bareMetalProfiles.find(p => p.name === selectedProfileName) || bareMetalProfiles[0];
  }, [bareMetalProfiles, selectedProfileName]);
  const [cpuOvercommit, setCpuOvercommit] = useState(defaults.cpuOvercommitRatio);
  const [memoryOvercommit, setMemoryOvercommit] = useState(defaults.memoryOvercommitRatio);
  const [htMultiplier, setHtMultiplier] = useState(1.25); // Default HT efficiency
  const [useHyperthreading, setUseHyperthreading] = useState(true);
  const [replicaFactor, setReplicaFactor] = useState(defaults.odfReplicationFactor);
  const [operationalCapacity, setOperationalCapacity] = useState(defaults.odfOperationalCapacity * 100);
  const [cephOverhead, setCephOverhead] = useState(defaults.odfCephOverhead * 100);
  // System reserved resources (fixed values - not exposed in UI as they rarely change)
  const systemReservedMemory = 4; // GiB for kubelet, monitoring, etc. (not ODF)
  const systemReservedCpu = 1; // Cores for OpenShift system processes
  const [nodeRedundancy, setNodeRedundancy] = useState(defaults.nodeRedundancy);
  const [storageMetric, setStorageMetric] = useState<'provisioned' | 'inUse' | 'diskCapacity'>('inUse'); // Recommended: use actual data footprint
  const [annualGrowthRate, setAnnualGrowthRate] = useState(20); // 20% annual growth default
  const [planningHorizonYears, setPlanningHorizonYears] = useState(2); // 2-year planning horizon
  const [virtOverhead, setVirtOverhead] = useState(15); // 10-15% for OpenShift Virtualization

  // ODF resource reservations (auto-calculated based on NVMe devices)
  // Formula from Red Hat ODF docs: Base + (2 CPU / 5 GiB per device)
  const odfReservedCpu = useMemo(() => {
    const nvmeDevices = selectedProfile.nvmeDisks ?? 0;
    const baseCpu = 5; // ~16 CPU / 3 nodes base requirement
    const perDeviceCpu = 2;
    return baseCpu + (nvmeDevices * perDeviceCpu);
  }, [selectedProfile.nvmeDisks]);

  const odfReservedMemory = useMemo(() => {
    const nvmeDevices = selectedProfile.nvmeDisks ?? 0;
    const baseMemory = 21; // ~64 GiB / 3 nodes base requirement
    const perDeviceMemory = 5;
    return baseMemory + (nvmeDevices * perDeviceMemory);
  }, [selectedProfile.nvmeDisks]);

  // Total infrastructure reserved (system + ODF)
  const totalReservedCpu = systemReservedCpu + odfReservedCpu;
  const totalReservedMemory = systemReservedMemory + odfReservedMemory;

  // Calculate per-node capacities
  const nodeCapacity = useMemo(() => {
    // CPU capacity calculation
    // (Physical cores - reserved) × HT multiplier (if enabled) × CPU overcommit ratio
    const availableCores = Math.max(0, selectedProfile.physicalCores - totalReservedCpu);
    const effectiveCores = useHyperthreading
      ? availableCores * htMultiplier
      : availableCores;
    const vcpuCapacity = Math.floor(effectiveCores * cpuOvercommit);

    // Memory capacity calculation
    // (Total memory - total reserved) × memory overcommit
    const availableMemoryGiB = Math.max(0, selectedProfile.memoryGiB - totalReservedMemory);
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
      availableCores,
      availableMemoryGiB,
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
    totalReservedCpu,
    totalReservedMemory,
  ]);

  // Calculate required nodes based on uploaded data
  const nodeRequirements = useMemo(() => {
    if (!hasData || !rawData) return null;

    // Filter to only powered-on VMs (non-templates)
    const vms = rawData.vInfo.filter(vm => !vm.template && vm.powerState === 'poweredOn');
    const vmNames = new Set(vms.map(vm => vm.vmName));

    // Calculate totals directly from rawData
    const totalVCPUs = vms.reduce((sum, vm) => sum + vm.cpus, 0);
    const totalMemoryGiB = vms.reduce((sum, vm) => sum + vm.memory, 0) / 1024; // MiB to GiB
    const provisionedStorageGiB = vms.reduce((sum, vm) => sum + vm.provisionedMiB, 0) / 1024;
    const inUseStorageGiB = vms.reduce((sum, vm) => sum + vm.inUseMiB, 0) / 1024;

    // Calculate disk capacity from vDisk sheet (filter to powered-on VMs)
    const diskCapacityGiB = rawData.vDisk
      .filter(disk => vmNames.has(disk.vmName))
      .reduce((sum, disk) => sum + disk.capacityMiB, 0) / 1024;

    // Select base storage based on metric choice
    const baseStorageGiB = storageMetric === 'provisioned'
      ? provisionedStorageGiB
      : storageMetric === 'diskCapacity'
        ? diskCapacityGiB
        : inUseStorageGiB;

    // Apply growth factor: (1 + rate)^years
    const growthMultiplier = Math.pow(1 + annualGrowthRate / 100, planningHorizonYears);

    // Apply virtualization overhead (snapshots, clones, live migration scratch space)
    const virtOverheadMultiplier = 1 + virtOverhead / 100;

    // Total storage with all factors applied
    const totalStorageGiB = baseStorageGiB * growthMultiplier * virtOverheadMultiplier;

    // Nodes required for each dimension (guard against division by zero)
    const nodesForCPU = nodeCapacity.vcpuCapacity > 0
      ? Math.ceil(totalVCPUs / nodeCapacity.vcpuCapacity)
      : 0;
    const nodesForMemory = nodeCapacity.memoryCapacity > 0
      ? Math.ceil(totalMemoryGiB / nodeCapacity.memoryCapacity)
      : 0;
    const nodesForStorage = nodeCapacity.usableStorageGiB > 0
      ? Math.ceil(totalStorageGiB / nodeCapacity.usableStorageGiB)
      : 0; // No local storage = external storage needed

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
      diskCapacityGiB,
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

  // Calculate cluster efficiency metrics
  const clusterEfficiency = useMemo(() => {
    if (!nodeRequirements) return null;

    const totalNodes = nodeRequirements.totalNodes;
    const failedNodes = 2; // Standard 2-node failure scenario
    const healthyNodes = totalNodes;
    const degradedNodes = Math.max(3, totalNodes - failedNodes); // Minimum 3 for ODF quorum

    // Per-node allocation in healthy state
    const vmsPerNodeHealthy = Math.ceil(nodeRequirements.vmCount / healthyNodes);
    const vcpusPerNodeHealthy = Math.ceil(nodeRequirements.totalVCPUs / healthyNodes);
    const memoryPerNodeHealthy = Math.ceil(nodeRequirements.totalMemoryGiB / healthyNodes);

    // Utilization percentages in healthy state
    const vcpuUtilHealthy = (vcpusPerNodeHealthy / nodeCapacity.vcpuCapacity) * 100;
    const memoryUtilHealthy = (memoryPerNodeHealthy / nodeCapacity.memoryCapacity) * 100;

    // Per-node allocation during 2-node failure
    const vmsPerNodeDegraded = Math.ceil(nodeRequirements.vmCount / degradedNodes);
    const vcpusPerNodeDegraded = Math.ceil(nodeRequirements.totalVCPUs / degradedNodes);
    const memoryPerNodeDegraded = Math.ceil(nodeRequirements.totalMemoryGiB / degradedNodes);

    // Utilization percentages during failure
    const vcpuUtilDegraded = (vcpusPerNodeDegraded / nodeCapacity.vcpuCapacity) * 100;
    const memoryUtilDegraded = (memoryPerNodeDegraded / nodeCapacity.memoryCapacity) * 100;

    // Determine status based on thresholds
    const getUtilStatus = (util: number): 'good' | 'warning' | 'critical' => {
      if (util >= 85) return 'critical';
      if (util >= 75) return 'warning';
      return 'good';
    };

    return {
      healthyNodes,
      degradedNodes,
      failedNodes,
      // Healthy cluster metrics
      vmsPerNodeHealthy,
      vcpusPerNodeHealthy,
      memoryPerNodeHealthy,
      vcpuUtilHealthy,
      memoryUtilHealthy,
      vcpuStatusHealthy: getUtilStatus(vcpuUtilHealthy),
      memoryStatusHealthy: getUtilStatus(memoryUtilHealthy),
      // Degraded cluster metrics
      vmsPerNodeDegraded,
      vcpusPerNodeDegraded,
      memoryPerNodeDegraded,
      vcpuUtilDegraded,
      memoryUtilDegraded,
      vcpuStatusDegraded: getUtilStatus(vcpuUtilDegraded),
      memoryStatusDegraded: getUtilStatus(memoryUtilDegraded),
      // Ceph health during degraded state
      cephNodesRemaining: degradedNodes,
      cephHealthy: degradedNodes >= 3,
    };
  }, [nodeRequirements, nodeCapacity]);

  // Track previous sizing to avoid unnecessary parent updates
  const prevSizingRef = useRef<string>('');

  // Notify parent component of sizing changes - only when values actually change
  useEffect(() => {
    if (onSizingChange && nodeRequirements) {
      const newSizing = {
        computeNodes: nodeRequirements.totalNodes,
        computeProfile: selectedProfileName,
        storageTiB: Math.ceil(nodeRequirements.totalStorageGiB / 1024),
        useNvme: true,
      };
      // Only call parent if values actually changed
      const sizingKey = `${newSizing.computeNodes}-${newSizing.computeProfile}-${newSizing.storageTiB}`;
      if (sizingKey !== prevSizingRef.current) {
        prevSizingRef.current = sizingKey;
        onSizingChange(newSizing);
      }
    }
  }, [nodeRequirements, selectedProfileName, onSizingChange]);

  // Profile dropdown items - memoized to maintain stable references for Carbon Dropdown
  const profileItems = useMemo(() => bareMetalProfiles.map((p) => {
    const roksLabel = p.roksSupported ? '✓ ROKS' : '✗ VPC Only';
    const nvmeLabel = p.hasNvme ? `${p.nvmeDisks}×${p.nvmeSizeGiB} GiB NVMe` : 'No NVMe';
    return {
      id: p.name,
      text: `${p.name} (${p.physicalCores}c/${p.vcpus}t, ${p.memoryGiB} GiB, ${nvmeLabel}) [${roksLabel}]`,
    };
  }), [bareMetalProfiles]);


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
            <Select
              id="profile-selector"
              labelText="Select IBM Cloud Bare Metal Profile"
              value={selectedProfileName}
              onChange={(e) => setSelectedProfileName(e.target.value)}
            >
              {profileItems.map((item) => (
                <SelectItem key={item.id} value={item.id} text={item.text} />
              ))}
            </Select>
            <div className="sizing-calculator__profile-details">
              <Tag type={selectedProfile.roksSupported ? 'green' : 'gray'}>
                {selectedProfile.roksSupported ? 'ROKS Supported' : 'VPC Only'}
              </Tag>
              <Tag type="blue">{selectedProfile.physicalCores} Physical Cores</Tag>
              <Tag type="cyan">{selectedProfile.vcpus} Threads (HT)</Tag>
              <Tag type="teal">{selectedProfile.memoryGiB} GiB RAM</Tag>
              {selectedProfile.hasNvme ? (
                <Tag type="purple">{selectedProfile.nvmeDisks}× {selectedProfile.nvmeSizeGiB} GiB NVMe</Tag>
              ) : (
                <Tag type="gray">No Local NVMe</Tag>
              )}
            </div>
            {!selectedProfile.roksSupported && (
              <div className="sizing-calculator__warning" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-support-warning)', borderRadius: '4px', fontSize: '0.875rem' }}>
                <strong>Note:</strong> This profile is not supported in ROKS/Kubernetes. It can only be provisioned as a standalone VPC bare metal server.
              </div>
            )}
            {selectedProfile.roksSupported && !selectedProfile.hasNvme && (
              <div className="sizing-calculator__warning" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-support-info)', borderRadius: '4px', fontSize: '0.875rem' }}>
                <strong>Note:</strong> This profile has no local NVMe storage. ODF (OpenShift Data Foundation) cannot be deployed on nodes without local storage. You will need to use external file storage.
              </div>
            )}
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

            <div className="sizing-calculator__info-text">
              <span className="label">Recommended:</span> 1:1 (no overcommit) for VM workloads
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
                    ({selectedProfile.physicalCores} - {totalReservedCpu}) × {useHyperthreading ? `${htMultiplier}× HT × ` : ''}{cpuOvercommit}:1
                  </span>
                </div>
              </Column>

              <Column lg={4} md={4} sm={4}>
                <div className="sizing-calculator__result-card sizing-calculator__result-card--memory">
                  <span className="sizing-calculator__result-label">Memory Capacity</span>
                  <span className="sizing-calculator__result-value">{formatNumber(nodeCapacity.memoryCapacity)} GiB</span>
                  <span className="sizing-calculator__result-detail">
                    ({selectedProfile.memoryGiB} - {totalReservedMemory}) × {memoryOvercommit}:1
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
                      Base: {formatBytes(nodeRequirements.baseStorageGiB * 1024 * 1024 * 1024)} ({storageMetric === 'inUse' ? 'In Use' : storageMetric === 'diskCapacity' ? 'Disk Capacity' : 'Provisioned'})
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

        {/* Cluster Efficiency Analysis */}
        {clusterEfficiency && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="sizing-calculator__efficiency-results">
              <h3 className="sizing-calculator__section-title">Cluster Efficiency Analysis</h3>
              <p className="sizing-calculator__subtitle">
                Resource allocation and utilization across {clusterEfficiency.healthyNodes} nodes
              </p>

              <Grid narrow>
                {/* Healthy Cluster Scenario */}
                <Column lg={8} md={4} sm={4}>
                  <div className="sizing-calculator__efficiency-scenario sizing-calculator__efficiency-scenario--healthy">
                    <div className="sizing-calculator__efficiency-header">
                      <Tag type="green" size="sm">Healthy Cluster</Tag>
                      <span className="sizing-calculator__efficiency-subtitle">Per-Node Allocation ({clusterEfficiency.healthyNodes} nodes)</span>
                    </div>

                    <div className="sizing-calculator__efficiency-metrics">
                      <div className="sizing-calculator__efficiency-metric">
                        <span className="sizing-calculator__efficiency-metric-label">VMs per Node</span>
                        <span className="sizing-calculator__efficiency-metric-value">{clusterEfficiency.vmsPerNodeHealthy}</span>
                      </div>

                      <div className="sizing-calculator__efficiency-metric">
                        <span className="sizing-calculator__efficiency-metric-label">vCPUs Allocated</span>
                        <span className="sizing-calculator__efficiency-metric-value">
                          {clusterEfficiency.vcpusPerNodeHealthy}
                          <span className={`sizing-calculator__efficiency-util sizing-calculator__efficiency-util--${clusterEfficiency.vcpuStatusHealthy}`}>
                            ({clusterEfficiency.vcpuUtilHealthy.toFixed(0)}% of capacity)
                          </span>
                        </span>
                      </div>

                      <div className="sizing-calculator__efficiency-metric">
                        <span className="sizing-calculator__efficiency-metric-label">Memory Allocated</span>
                        <span className="sizing-calculator__efficiency-metric-value">
                          {clusterEfficiency.memoryPerNodeHealthy} GiB
                          <span className={`sizing-calculator__efficiency-util sizing-calculator__efficiency-util--${clusterEfficiency.memoryStatusHealthy}`}>
                            ({clusterEfficiency.memoryUtilHealthy.toFixed(0)}% of capacity)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Column>

                {/* 2-Node Failure Scenario */}
                <Column lg={8} md={4} sm={4}>
                  <div className="sizing-calculator__efficiency-scenario sizing-calculator__efficiency-scenario--degraded">
                    <div className="sizing-calculator__efficiency-header">
                      <Tag type="magenta" size="sm">2-Node Failure</Tag>
                      <span className="sizing-calculator__efficiency-subtitle">{clusterEfficiency.degradedNodes} nodes remaining</span>
                    </div>

                    <div className="sizing-calculator__efficiency-metrics">
                      <div className="sizing-calculator__efficiency-metric">
                        <span className="sizing-calculator__efficiency-metric-label">VMs per Node</span>
                        <span className="sizing-calculator__efficiency-metric-value">{clusterEfficiency.vmsPerNodeDegraded}</span>
                      </div>

                      <div className="sizing-calculator__efficiency-metric">
                        <span className="sizing-calculator__efficiency-metric-label">vCPUs per Node</span>
                        <span className="sizing-calculator__efficiency-metric-value">
                          {clusterEfficiency.vcpusPerNodeDegraded}
                          <span className={`sizing-calculator__efficiency-util sizing-calculator__efficiency-util--${clusterEfficiency.vcpuStatusDegraded}`}>
                            ({clusterEfficiency.vcpuUtilDegraded.toFixed(0)}% utilization{clusterEfficiency.vcpuUtilDegraded >= 75 ? ' - at threshold' : ''})
                          </span>
                        </span>
                      </div>

                      <div className="sizing-calculator__efficiency-metric">
                        <span className="sizing-calculator__efficiency-metric-label">Memory per Node</span>
                        <span className="sizing-calculator__efficiency-metric-value">
                          {clusterEfficiency.memoryPerNodeDegraded} GiB
                          <span className={`sizing-calculator__efficiency-util sizing-calculator__efficiency-util--${clusterEfficiency.memoryStatusDegraded}`}>
                            ({clusterEfficiency.memoryUtilDegraded.toFixed(0)}% utilization{clusterEfficiency.memoryUtilDegraded >= 75 ? ' - at threshold' : ''})
                          </span>
                        </span>
                      </div>

                      <div className="sizing-calculator__efficiency-metric">
                        <span className="sizing-calculator__efficiency-metric-label">Ceph/ODF Status</span>
                        <span className="sizing-calculator__efficiency-metric-value">
                          <Tag type={clusterEfficiency.cephHealthy ? 'green' : 'red'} size="sm">
                            {clusterEfficiency.cephHealthy
                              ? `${clusterEfficiency.cephNodesRemaining} nodes for replication (healthy)`
                              : 'Below quorum - data at risk'}
                          </Tag>
                        </span>
                      </div>
                    </div>
                  </div>
                </Column>
              </Grid>

              <div className="sizing-calculator__efficiency-legend">
                <span className="sizing-calculator__efficiency-legend-item">
                  <span className="sizing-calculator__efficiency-legend-dot sizing-calculator__efficiency-legend-dot--good"></span>
                  &lt;75% Good
                </span>
                <span className="sizing-calculator__efficiency-legend-item">
                  <span className="sizing-calculator__efficiency-legend-dot sizing-calculator__efficiency-legend-dot--warning"></span>
                  75-85% Warning
                </span>
                <span className="sizing-calculator__efficiency-legend-item">
                  <span className="sizing-calculator__efficiency-legend-dot sizing-calculator__efficiency-legend-dot--critical"></span>
                  &gt;85% Critical
                </span>
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
