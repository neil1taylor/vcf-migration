// RackWare RMM Export Modal - Configuration and download for RackWare wave CSV
import { useState, useMemo } from 'react';
import {
  Modal,
  TextInput,
  Toggle,
  Dropdown,
  InlineNotification,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Tag,
} from '@carbon/react';
import type { WaveGroup, NetworkGroupBy } from '@/services/migration';
import type { WavePlanningMode } from '@/components/migration/WavePlanningPanel';
import type { VMDetail, RackwareRmmConfig } from '@/services/export';
import { downloadRackwareRmmCSV, downloadRackwareRmmPerWaveZip } from '@/services/export';

export interface RackwareExportModalProps {
  open: boolean;
  onClose: () => void;
  waves: WaveGroup[];
  vmDetails?: VMDetail[];
  mode?: 'vsi' | 'roks';
  wavePlanningMode?: WavePlanningMode;
  networkGroupBy?: NetworkGroupBy;
}

interface ExportMode {
  id: 'combined' | 'per-wave' | 'per-network';
  label: string;
  description: string;
}

export function RackwareExportModal({
  open,
  onClose,
  waves,
  vmDetails,
  mode = 'vsi',
  wavePlanningMode = 'complexity',
  networkGroupBy = 'portGroup',
}: RackwareExportModalProps) {
  // Configuration state
  const [config, setConfig] = useState<RackwareRmmConfig>({
    vpc: '',
    subnet: '',
    zone: '',
    sshKeyName: '',
    securityGroup: '',
    targetNamePattern: '{vmName}',
    linuxUsername: 'root',
    includeProfile: true,
    includeWave: true,
  });

  const [exportMode, setExportMode] = useState<'combined' | 'per-wave' | 'per-network'>('combined');
  const [isExporting, setIsExporting] = useState(false);

  // Determine if we're in network mode (per DPG/cluster)
  const isNetworkMode = wavePlanningMode === 'network';
  const groupingLabel = networkGroupBy === 'portGroup' ? 'Port Group' : 'Cluster';

  // Build export mode options based on wave planning mode
  const exportModes = useMemo<ExportMode[]>(() => {
    const modes: ExportMode[] = [
      {
        id: 'combined',
        label: 'Single file (all VMs)',
        description: 'Export all VMs to a single CSV file'
      },
    ];

    if (isNetworkMode) {
      modes.push({
        id: 'per-network',
        label: `Separate files per ${groupingLabel} (ZIP)`,
        description: `Each ${groupingLabel.toLowerCase()} exported as a separate CSV for network-based cutover`
      });
    } else {
      modes.push({
        id: 'per-wave',
        label: 'Separate files per wave (ZIP)',
        description: 'Each complexity wave exported as a separate CSV'
      });
    }

    return modes;
  }, [isNetworkMode, groupingLabel]);

  // Count total VMs across all waves
  const totalVMs = waves.reduce((sum, w) => sum + w.vmCount, 0);

  // Get unique networks/clusters for summary
  const networkSummary = useMemo(() => {
    if (!isNetworkMode) return null;

    return waves.map(wave => ({
      name: wave.name,
      vmCount: wave.vmCount,
      hasBlockers: wave.hasBlockers,
    }));
  }, [waves, isNetworkMode]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportMode === 'per-wave' || exportMode === 'per-network') {
        // Generate descriptive filename based on mode
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = isNetworkMode
          ? `rackware-rmm-per-${networkGroupBy}-${dateStr}.zip`
          : `rackware-rmm-waves-${dateStr}.zip`;
        await downloadRackwareRmmPerWaveZip(waves, vmDetails, config, filename);
      } else {
        downloadRackwareRmmCSV(waves, vmDetails, config);
      }
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const updateConfig = (key: keyof RackwareRmmConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      modalHeading="Export to RackWare RMM"
      modalLabel="Wave Export"
      primaryButtonText={isExporting ? 'Exporting...' : 'Export CSV'}
      primaryButtonDisabled={isExporting || totalVMs === 0}
      secondaryButtonText="Cancel"
      onRequestSubmit={handleExport}
      size="md"
    >
      <div style={{ marginBottom: '1.5rem' }}>
        <InlineNotification
          kind="info"
          title="RackWare RMM Wave Import"
          subtitle={
            isNetworkMode
              ? `Export ${totalVMs} VMs across ${waves.length} ${groupingLabel.toLowerCase()}s for network-based migration cutover.`
              : `Export ${totalVMs} VMs across ${waves.length} waves in CSV format compatible with RackWare RMM wave import.`
          }
          lowContrast
          hideCloseButton
        />
        {isNetworkMode && (
          <div style={{ marginTop: '0.5rem' }}>
            <Tag type="blue" size="sm">
              {wavePlanningMode === 'network' ? 'Network-Based Grouping' : 'Complexity-Based Grouping'}
            </Tag>
            <Tag type="teal" size="sm" style={{ marginLeft: '0.5rem' }}>
              Grouped by {groupingLabel}
            </Tag>
          </div>
        )}
      </div>

      <Tabs>
        <TabList aria-label="Export configuration tabs">
          <Tab>Basic Settings</Tab>
          <Tab>IBM Cloud VPC</Tab>
          <Tab>Advanced</Tab>
        </TabList>
        <TabPanels>
          {/* Basic Settings Tab */}
          <TabPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
              <Dropdown
                id="export-mode"
                titleText="Export Format"
                label="Select export format"
                items={exportModes}
                itemToString={(item) => item?.label || ''}
                selectedItem={exportModes.find(m => m.id === exportMode) || exportModes[0]}
                onChange={({ selectedItem }) => {
                  if (selectedItem) {
                    setExportMode(selectedItem.id);
                  }
                }}
              />
              {exportModes.find(m => m.id === exportMode)?.description && (
                <p style={{ fontSize: '0.75rem', color: '#525252', marginTop: '-0.5rem' }}>
                  {exportModes.find(m => m.id === exportMode)?.description}
                </p>
              )}

              <TextInput
                id="target-name-pattern"
                labelText="Target Name Pattern"
                helperText="Use {vmName} as placeholder for original VM name"
                value={config.targetNamePattern || '{vmName}'}
                onChange={(e) => updateConfig('targetNamePattern', e.target.value)}
              />

              <TextInput
                id="linux-username"
                labelText="Linux Username"
                helperText="Username for SSH access to Linux VMs (Windows uses SYSTEM)"
                value={config.linuxUsername || 'root'}
                onChange={(e) => updateConfig('linuxUsername', e.target.value)}
              />

              <div style={{ display: 'flex', gap: '2rem' }}>
                <Toggle
                  id="include-wave"
                  labelText={isNetworkMode ? `Include ${groupingLabel} Column` : 'Include Wave Column'}
                  labelA="No"
                  labelB="Yes"
                  toggled={config.includeWave}
                  onToggle={(checked) => updateConfig('includeWave', checked)}
                />

                {mode === 'vsi' && (
                  <Toggle
                    id="include-profile"
                    labelText="Include VSI Profile"
                    labelA="No"
                    labelB="Yes"
                    toggled={config.includeProfile}
                    onToggle={(checked) => updateConfig('includeProfile', checked)}
                  />
                )}
              </div>
            </div>
          </TabPanel>

          {/* IBM Cloud VPC Tab */}
          <TabPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
              <InlineNotification
                kind="info"
                title="Auto-Provisioning"
                subtitle="These settings are used when RackWare RMM auto-provisions VSIs in IBM Cloud VPC. Leave blank if provisioning manually."
                lowContrast
                hideCloseButton
              />

              <TextInput
                id="vpc-name"
                labelText="VPC Name"
                helperText="Name of the target VPC in IBM Cloud"
                value={config.vpc || ''}
                onChange={(e) => updateConfig('vpc', e.target.value)}
                placeholder="e.g., my-migration-vpc"
              />

              <TextInput
                id="subnet-name"
                labelText="Subnet Name"
                helperText="Name of the target subnet"
                value={config.subnet || ''}
                onChange={(e) => updateConfig('subnet', e.target.value)}
                placeholder="e.g., my-subnet-zone-1"
              />

              <TextInput
                id="zone"
                labelText="Availability Zone"
                helperText="Target availability zone"
                value={config.zone || ''}
                onChange={(e) => updateConfig('zone', e.target.value)}
                placeholder="e.g., us-south-1"
              />

              <TextInput
                id="ssh-key"
                labelText="SSH Key Name"
                helperText="SSH key for Linux VMs (required for auto-provisioning)"
                value={config.sshKeyName || ''}
                onChange={(e) => updateConfig('sshKeyName', e.target.value)}
                placeholder="e.g., my-ssh-key"
              />

              <TextInput
                id="security-group"
                labelText="Security Group"
                helperText="Security group to attach to provisioned VSIs"
                value={config.securityGroup || ''}
                onChange={(e) => updateConfig('securityGroup', e.target.value)}
                placeholder="e.g., my-security-group"
              />
            </div>
          </TabPanel>

          {/* Advanced Tab */}
          <TabPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
              <InlineNotification
                kind="info"
                title="CSV Format Notes"
                subtitle="The generated CSV includes: Origin Name, Origin IP, Target Name, Origin Username, OS, and optional columns for Wave, Profile, and VPC settings."
                lowContrast
                hideCloseButton
              />

              <div style={{ marginTop: '1rem' }}>
                <h5 style={{ marginBottom: '0.5rem' }}>Export Summary</h5>
                <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                  <li>Grouping: {isNetworkMode ? `By ${groupingLabel}` : 'By Complexity Wave'}</li>
                  <li>Total {isNetworkMode ? `${groupingLabel}s` : 'Waves'}: {waves.length}</li>
                  <li>Total VMs: {totalVMs}</li>
                  <li>Windows VMs will use SYSTEM as origin username</li>
                  <li>Linux VMs will use "{config.linuxUsername || 'root'}" as origin username</li>
                  {config.includeProfile && <li>VSI profiles will be included for auto-provisioning</li>}
                  {config.vpc && <li>VPC: {config.vpc}</li>}
                </ul>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h5 style={{ marginBottom: '0.5rem' }}>
                  {isNetworkMode ? `${groupingLabel} Breakdown` : 'Wave Breakdown'}
                </h5>
                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem' }}>
                  {(networkSummary || waves).map((wave, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.25rem 0',
                        borderBottom: '1px solid #e0e0e0'
                      }}
                    >
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '250px'
                      }}>
                        {wave.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{wave.vmCount} VMs</span>
                        {wave.hasBlockers && <Tag type="red" size="sm">Blockers</Tag>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isNetworkMode && (exportMode === 'per-network') && (
                <InlineNotification
                  kind="warning"
                  title="Network-Based Export"
                  subtitle={`Each ${groupingLabel.toLowerCase()} will be exported as a separate CSV file. This allows you to perform migration cutovers one network at a time.`}
                  lowContrast
                  hideCloseButton
                  style={{ marginTop: '1rem' }}
                />
              )}
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Modal>
  );
}

export default RackwareExportModal;
