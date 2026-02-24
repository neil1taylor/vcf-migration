// VSI Sizing tab panel content - extracted from VSIMigrationPage

import { Tile, Tag, Button, InlineNotification, Tooltip } from '@carbon/react';
import { Grid, Column } from '@carbon/react';
import { Settings, Reset, ArrowUp, ArrowDown } from '@carbon/icons-react';
import { formatNumber } from '@/utils/formatters';
import { DoughnutChart, HorizontalBarChart } from '@/components/charts';
import { EnhancedDataTable } from '@/components/tables';
import { MetricCard, RedHatDocLink } from '@/components/common';
import { ProfileSelector } from '@/components/sizing';
import { isBurstableProfile } from '@/services/migration';
import type { ColumnDef } from '@tanstack/react-table';
import type { VMProfileMapping } from '@/services/migration';
import type { CustomProfile } from '@/hooks/useCustomProfiles';
import type { ProfileRecommendation as AIProfileRecommendation } from '@/services/ai/types';

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
      accessorFn: (row) => row.classification.recommendation,
      cell: ({ row }) => {
        const { recommendation, reasons } = row.original.classification;
        const isBurstable = recommendation === 'burstable';
        const currentIsBurstable = isBurstableProfile(row.original.profile.name);
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
            <Tag
              type={isBurstable ? 'cyan' : 'purple'}
              size="sm"
              title={row.original.classification.note}
            >
              {isBurstable ? 'Burstable' : 'Standard'}
            </Tag>
            {!isBurstable && reasons.length > 0 && (
              <Tag type="gray" size="sm" title={reasons.join(', ')}>
                {reasons[0]}
              </Tag>
            )}
            {currentIsBurstable !== isBurstable && row.original.isOverridden && (
              <Tag type="teal" size="sm">Override</Tag>
            )}
            {aiRecommendations[row.original.vmName]?.source === 'ai' && (() => {
              const aiRec = aiRecommendations[row.original.vmName];
              const tooltipText = aiRec.reasoning + (aiRec.isOverprovisioned ? ' (Overprovisioned)' : '');
              return (
                <>
                  <Tooltip label={tooltipText} align="bottom">
                    <button type="button" style={{ all: 'unset', cursor: 'help' }}>
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
      cell: ({ row }) => (
        <ProfileSelector
          vmName={row.original.vmName}
          autoMappedProfile={row.original.autoProfile.name}
          currentProfile={row.original.profile.name}
          isOverridden={row.original.isOverridden}
          customProfiles={customProfiles}
          onProfileChange={(vmName, newProfile, originalProfile) => setProfileOverride(vmName, newProfile, originalProfile)}
          onResetToAuto={removeProfileOverride}
          compact
        />
      ),
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
            {diff > 0 && <ArrowUp size={16} style={{ color: '#24a148' }} />}
            {diff < 0 && <ArrowDown size={16} style={{ color: '#da1e28' }} />}
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
            {diff > 0 && <ArrowUp size={16} style={{ color: '#24a148' }} />}
            {diff < 0 && <ArrowDown size={16} style={{ color: '#da1e28' }} />}
          </span>
        );
      },
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
              <span className="migration-page__recommendation-key">Balanced (bx2)</span>
              <span className="migration-page__recommendation-value">1:4 vCPU:Memory ratio - General purpose workloads</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Compute (cx2)</span>
              <span className="migration-page__recommendation-value">1:2 vCPU:Memory ratio - CPU-intensive workloads</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Memory (mx2)</span>
              <span className="migration-page__recommendation-value">1:8 vCPU:Memory ratio - Memory-intensive workloads</span>
            </div>
            <div className="migration-page__recommendation-item">
              <span className="migration-page__recommendation-key">Burstable (bxf, cxf, mxf)</span>
              <span className="migration-page__recommendation-value">Flex profiles with burstable CPU - Cost-effective for variable workloads that don't require sustained high CPU performance. Not recommended for enterprise apps, network appliances, or VMs with multiple NICs.</span>
            </div>
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
