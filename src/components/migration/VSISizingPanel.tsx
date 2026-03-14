// VSI Sizing tab panel content - extracted from VSIMigrationPage

import { Tile, Tag, Button, InlineNotification, Tooltip, Toggletip, ToggletipButton, ToggletipContent } from '@carbon/react';
import { Grid, Column } from '@carbon/react';
import { Settings, Reset, ArrowUp, ArrowDown } from '@carbon/icons-react';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/utils/formatters';
import { DoughnutChart, HorizontalBarChart } from '@/components/charts';
import { EnhancedDataTable } from '@/components/tables';
import { MetricCard, RedHatDocLink } from '@/components/common';
import { ProfileSelector, StorageTierSelector } from '@/components/sizing';
import { isBurstableProfile, hasInstanceStorage, getProfileGeneration, isBIOSFirmware, isGpuProfile } from '@/services/migration';
import { ROUTES } from '@/utils/constants';
import type { ColumnDef } from '@tanstack/react-table';
import type { VMProfileMapping } from '@/services/migration';
import type { CustomProfile } from '@/hooks/useCustomProfiles';
import type { ProfileRecommendation as AIProfileRecommendation } from '@/services/ai/types';
import type { StorageTierType } from '@/utils/workloadClassification';

export interface VSISizingPanelProps {
  totalVSIs: number;
  uniqueProfiles: number;
  vsiTotalVCPUs: number;
  vsiTotalMemory: number;
  overriddenVMCount: number;
  familyChartData: Array<{ label: string; value: number }>;
  topProfiles: Array<{ label: string; value: number }>;
  vmProfileMappings: VMProfileMapping[];
  customProfiles: CustomProfile[];
  showCustomProfileEditor: boolean;
  setShowCustomProfileEditor: (show: boolean) => void;
  clearAllOverrides: () => void;
  setProfileOverride: (vmName: string, profileName: string, originalProfile: string) => void;
  removeProfileOverride: (vmName: string) => void;
  aiRecommendations: Record<string, AIProfileRecommendation>;
  setStorageTierOverride: (vmName: string, tier: StorageTierType) => void;
  removeStorageTierOverride: (vmName: string) => void;
}

export function VSISizingPanel({
  totalVSIs,
  uniqueProfiles,
  vsiTotalVCPUs,
  vsiTotalMemory,
  overriddenVMCount,
  familyChartData,
  topProfiles,
  vmProfileMappings,
  customProfiles,
  setShowCustomProfileEditor,
  clearAllOverrides,
  setProfileOverride,
  removeProfileOverride,
  aiRecommendations,
  setStorageTierOverride,
  removeStorageTierOverride,
}: VSISizingPanelProps) {
  // Table columns
  type ProfileMappingRow = VMProfileMapping;
  const profileMappingColumns: ColumnDef<ProfileMappingRow, unknown>[] = [
    { accessorKey: 'vmName', header: 'VM Name', enableSorting: true },
    { accessorKey: 'vcpus', header: 'Source vCPUs', enableSorting: true },
    { accessorKey: 'memoryGiB', header: 'Source Memory (GiB)', enableSorting: true },
    { accessorKey: 'nics', header: 'NICs', enableSorting: true },
    {
      id: 'recommendation',
      header: 'Recommendation',
      enableSorting: true,
      accessorFn: (row) => isBurstableProfile(row.profile.name) ? 'burstable' : 'standard',
      cell: ({ row }) => {
        const { recommendation: heuristicRecommendation, reasons } = row.original.classification;
        // User's burstable selection (from Discovery) is the primary indicator
        const currentIsBurstable = isBurstableProfile(row.original.profile.name);
        const isBurstable = currentIsBurstable;

        const reasonExplanations: Record<string, string> = {
          'Network appliance': 'VM name indicates a network device (firewall, load balancer, etc.) requiring consistent CPU',
          'Enterprise app': 'VM name indicates an enterprise application (SAP, Oracle, SQL Server, etc.) needing guaranteed CPU',
        };

        const getReasonExplanation = (reason: string): string => {
          if (reason.startsWith('Multiple NICs')) {
            const nicCount = reason.match(/\((\d+)\)/)?.[1] || '?';
            return `Has ${nicCount} network interfaces, suggesting a complex networking role requiring steady CPU`;
          }
          return reasonExplanations[reason] || reason;
        };

        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
            <Toggletip align="bottom" autoAlign>
              <ToggletipButton label={isBurstable ? 'Burstable' : 'Standard'}>
                <Tag
                  type={isBurstable ? 'cyan' : 'purple'}
                  size="sm"
                >
                  {isBurstable ? 'Burstable' : 'Standard'}
                </Tag>
              </ToggletipButton>
              <ToggletipContent>
                <div>
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    <strong>{isBurstable ? 'Burstable' : 'Standard'}</strong>
                    {' — '}
                    {isBurstable
                      ? 'Shared CPU, lower cost for variable workloads'
                      : 'Dedicated CPU for sustained workloads'}
                  </p>
                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
                    Heuristic: {heuristicRecommendation === 'burstable' ? 'Burstable' : 'Standard'}
                    {reasons.length > 0 && ` (${reasons.join(', ')})`}
                  </p>
                  {!isBurstable && reasons.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                      {reasons.map((reason, i) => (
                        <li key={i} style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                          <strong>{reason}</strong>: {getReasonExplanation(reason)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </ToggletipContent>
            </Toggletip>
            {isBurstable && (
              <Tag type="cyan" size="sm">User</Tag>
            )}
            {!isBurstable && reasons.length > 0 && (
              <Tag type="gray" size="sm">
                {reasons[0]}
              </Tag>
            )}
            {aiRecommendations[row.original.vmName]?.source === 'ai' && (() => {
              const aiRec = aiRecommendations[row.original.vmName];
              const tooltipText = aiRec.reasoning + (aiRec.isOverprovisioned ? ' (Overprovisioned)' : '');
              return (
                <>
                  <Tooltip label={tooltipText} align="bottom">
                    <button type="button" className="tooltip-trigger">
                      <Tag type="purple" size="sm">AI: {aiRec.recommendedProfile}</Tag>
                    </button>
                  </Tooltip>
                  {aiRec.isOverprovisioned && (
                    <Tag type="warm-gray" size="sm">Overprovisioned</Tag>
                  )}
                </>
              );
            })()}
          </span>
        );
      },
    },
    {
      id: 'profile', header: 'Target Profile', enableSorting: true,
      accessorFn: (row) => row.profile.name,
      cell: ({ row }) => {
        const profileName = row.original.profile.name;
        const gen = getProfileGeneration(profileName);
        const nvme = hasInstanceStorage(profileName);
        const firmwareBIOS = isBIOSFirmware(row.original.firmwareType);
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
            <ProfileSelector
              vmName={row.original.vmName}
              autoMappedProfile={row.original.autoProfile.name}
              currentProfile={profileName}
              isOverridden={row.original.isOverridden}
              customProfiles={customProfiles}
              onProfileChange={(vmName, newProfile, originalProfile) => setProfileOverride(vmName, newProfile, originalProfile)}
              onResetToAuto={removeProfileOverride}
              compact
            />
            <Tag type={gen === 3 ? 'green' : 'gray'} size="sm">Gen{gen}</Tag>
            {nvme && <Tag type="teal" size="sm">NVMe</Tag>}
            {row.original.gpuRequired && (
              isGpuProfile(profileName)
                ? <Tag type="purple" size="sm">GPU</Tag>
                : <Tooltip label="GPU requested but no gx profile fits these requirements. Select a profile manually." align="bottom">
                    <button type="button" className="tooltip-trigger">
                      <Tag type="red" size="sm">GPU — no fit</Tag>
                    </button>
                  </Tooltip>
            )}
            {row.original.bandwidthSensitive && (
              <Tag type="cyan" size="sm">High BW</Tag>
            )}
            {firmwareBIOS && (
              <Tooltip label="This VM uses BIOS firmware. Gen 3 profiles require UEFI boot mode. Convert to UEFI before migrating to Gen 3." align="bottom">
                <button type="button" className="tooltip-trigger">
                  <Tag type="warm-gray" size="sm">BIOS</Tag>
                </button>
              </Tooltip>
            )}
          </span>
        );
      },
    },
    {
      id: 'profileVcpus',
      header: 'Target vCPUs',
      enableSorting: true,
      accessorFn: (row) => row.profile.vcpus,
      cell: ({ row }) => {
        const source = row.original.vcpus;
        const target = row.original.profile.vcpus;
        const diff = target - source;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {target}
            {diff > 0 && <ArrowUp size={16} style={{ color: 'var(--cds-support-success)' }} />}
            {diff < 0 && <ArrowDown size={16} style={{ color: 'var(--cds-support-error)' }} />}
          </span>
        );
      },
    },
    {
      id: 'profileMemory',
      header: 'Target Memory (GiB)',
      enableSorting: true,
      accessorFn: (row) => row.profile.memoryGiB,
      cell: ({ row }) => {
        const source = row.original.memoryGiB;
        const target = row.original.profile.memoryGiB;
        const diff = target - source;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {target}
            {diff > 0 && <ArrowUp size={16} style={{ color: 'var(--cds-support-success)' }} />}
            {diff < 0 && <ArrowDown size={16} style={{ color: 'var(--cds-support-error)' }} />}
          </span>
        );
      },
    },
    {
      id: 'storage',
      header: 'Storage (GiB)',
      enableSorting: true,
      accessorFn: (row) => row.provisionedStorageGiB,
      cell: ({ row }) => {
        const provisioned = row.original.provisionedStorageGiB;
        const inUse = row.original.inUseStorageGiB;
        return (
          <span>
            {formatNumber(provisioned)}
            {inUse > 0 && (
              <span style={{ color: 'var(--cds-text-helper)', fontSize: '0.75rem' }}> ({formatNumber(inUse)} used)</span>
            )}
          </span>
        );
      },
    },
    {
      id: 'storageTier',
      header: 'Storage Tier',
      enableSorting: true,
      accessorFn: (row) => row.storageTier,
      cell: ({ row }) => (
        <StorageTierSelector
          vmName={row.original.vmName}
          currentTier={row.original.storageTier}
          autoTier={row.original.autoStorageTier}
          isOverridden={row.original.isStorageTierOverridden}
          workloadCategory={row.original.workloadCategory}
          onTierChange={setStorageTierOverride}
          onResetToAuto={removeStorageTierOverride}
        />
      ),
    },
  ];

  return (
    <Grid className="migration-page__tab-content">
      <Column lg={16} md={8} sm={4}>
        <Tile className="migration-page__sizing-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3>VPC Virtual Server Instance Mapping</h3>
              <p>Best-fit IBM Cloud VPC VSI profiles for {formatNumber(totalVSIs)} VMs</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button kind="tertiary" size="sm" renderIcon={Settings} onClick={() => setShowCustomProfileEditor(true)}>
                Custom Profiles {customProfiles.length > 0 && `(${customProfiles.length})`}
              </Button>
              {overriddenVMCount > 0 && (
                <Button kind="ghost" size="sm" renderIcon={Reset} onClick={clearAllOverrides}>Clear All Overrides</Button>
              )}
            </div>
          </div>
        </Tile>
      </Column>

      {overriddenVMCount > 0 && (
        <Column lg={16} md={8} sm={4}>
          <InlineNotification kind="info" title="Profile Overrides Active" subtitle={`${overriddenVMCount} VM${overriddenVMCount !== 1 ? 's have' : ' has'} custom profile assignments.`} lowContrast hideCloseButton />
        </Column>
      )}

      <Column lg={4} md={4} sm={2}>
        <MetricCard label="Total VSIs" value={formatNumber(totalVSIs)} variant="primary" tooltip="Number of VPC Virtual Server Instances needed." />
      </Column>
      <Column lg={4} md={4} sm={2}>
        <MetricCard label="Unique Profiles" value={formatNumber(uniqueProfiles)} variant="info" tooltip="Number of distinct VSI profile types." />
      </Column>
      <Column lg={4} md={4} sm={2}>
        <MetricCard label="Total vCPUs" value={formatNumber(vsiTotalVCPUs)} variant="teal" tooltip="Sum of vCPUs across all recommended VSI profiles." />
      </Column>
      <Column lg={4} md={4} sm={2}>
        <MetricCard label="Total Memory" value={`${formatNumber(vsiTotalMemory)} GiB`} variant="purple" tooltip="Sum of memory across all recommended VSI profiles." />
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__chart-tile">
          <DoughnutChart title="Profile Family Distribution" subtitle="VMs by instance family type" data={familyChartData} height={280} colors={['#0f62fe', '#8a3ffc', '#009d9a']} formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`} />
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__chart-tile">
          <HorizontalBarChart title="Top 10 Recommended Profiles" subtitle="Most frequently mapped VSI profiles" data={topProfiles} height={280} valueLabel="VMs" formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`} />
        </Tile>
      </Column>

      <Column lg={16} md={8} sm={4}>
        <Tile className="migration-page__recommendation-tile">
          <h4>Profile Family Descriptions</h4>
          <div className="migration-page__recommendation-grid">
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Balanced (bx2, bx3d)</span>
              <span className="migration-page__recommendation-value">1:4 to 1:5 vCPU:Memory ratio — General purpose: web servers, middleware, app tiers</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Compute (cx2, cx3d)</span>
              <span className="migration-page__recommendation-value">1:2 to 1:2.5 vCPU:Memory ratio — CPU-bound: batch processing, analytics, CI/CD workers</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Memory (mx2, mx3d)</span>
              <span className="migration-page__recommendation-value">1:8 to 1:10 vCPU:Memory ratio — Databases, in-memory caches, JVM-heavy apps</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Very High Memory (vx2d)</span>
              <span className="migration-page__recommendation-value">1:14 vCPU:Memory ratio — SAP HANA, large in-memory analytics</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Ultra High Memory (ux2d)</span>
              <span className="migration-page__recommendation-value">1:28 vCPU:Memory ratio — Largest SAP configurations</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">GPU (gx2, gx3)</span>
              <span className="migration-page__recommendation-value">GPU-accelerated — ML/AI inference, CUDA workloads, video transcoding</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Burstable (bxf, cxf, mxf)</span>
              <span className="migration-page__recommendation-value">Flex profiles with burstable CPU — Cost-effective for variable workloads without sustained high CPU demand</span>
            </div>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
            <p style={{ marginBottom: '0.25rem' }}><strong>Generation preference:</strong> Gen3 (bx3d/cx3d/mx3d) preferred — better price-performance, NVMe included. Gen3 requires UEFI boot; BIOS VMs default to Gen2.</p>
            <p style={{ marginBottom: '0.25rem' }}><strong>NVMe d-suffix:</strong> Local NVMe for high IOPS (DB scratch, Kafka), but ephemeral on stop/start.</p>
            <p style={{ marginBottom: '0.25rem' }}><strong>Network bandwidth:</strong> Scales with vCPU count — size up for network-throughput-bound workloads.</p>
            <p style={{ marginTop: '0.5rem' }}>
              <RouterLink to={ROUTES.vsiProfileGuide} style={{ color: 'var(--cds-link-primary)' }}>
                View the full VSI Profile Selection Guide →
              </RouterLink>
            </p>
          </div>
        </Tile>
      </Column>

      <Column lg={16} md={8} sm={4}>
        <Tile className="migration-page__cost-tile">
          <h4>Cost Estimation</h4>
          <p className="migration-page__cost-description">Estimate costs for {formatNumber(totalVSIs)} VPC Virtual Server Instances.</p>
          <RedHatDocLink href="https://cloud.ibm.com/vpc-ext/provision/vs" label="Open IBM Cloud VPC Catalog" description="Configure and estimate costs for VPC virtual servers" />
        </Tile>
      </Column>

      <Column lg={16} md={8} sm={4}>
        <Tile className="migration-page__table-tile">
          <EnhancedDataTable data={vmProfileMappings} columns={profileMappingColumns} title="VM to VSI Profile Mapping" description="Click the edit icon to override the auto-mapped profile." enableSearch enablePagination enableSorting enableExport enableColumnVisibility defaultPageSize={25} exportFilename="vm-profile-mapping" />
        </Tile>
      </Column>
    </Grid>
  );
}
