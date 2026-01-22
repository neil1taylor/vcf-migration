// OS Compatibility Panel - shared component for OS compatibility analysis

import { useMemo } from 'react';
import { Grid, Column, Tile, Tag } from '@carbon/react';
import type { ColumnDef } from '@tanstack/react-table';
import { DoughnutChart } from '@/components/charts';
import { EnhancedDataTable } from '@/components/tables';
import type { MigrationMode } from '@/services/migration';
import { getOSCompatibilityResults, type OSCompatibilityResult, type VSIOSCompatibility, type ROKSOSCompatibility } from '@/services/migration/osCompatibility';
import { formatNumber } from '@/utils/formatters';

export interface OSCompatibilityPanelProps {
  mode: MigrationMode;
  osStatusCounts: Record<string, number>;
  vms?: Array<{ vmName: string; guestOS: string }>;
}

export function OSCompatibilityPanel({ mode, osStatusCounts, vms }: OSCompatibilityPanelProps) {
  // Calculate OS compatibility results for each VM
  const osCompatibilityResults = useMemo(() => {
    if (!vms || vms.length === 0) return [];
    return getOSCompatibilityResults(vms, mode);
  }, [vms, mode]);

  // Define table columns based on mode
  const tableColumns = useMemo((): ColumnDef<OSCompatibilityResult, unknown>[] => {
    const getStatusTag = (result: OSCompatibilityResult) => {
      if (mode === 'vsi') {
        const status = (result.compatibility as VSIOSCompatibility).status;
        const tagType = status === 'supported' ? 'green' : status === 'byol' ? 'teal' : 'red';
        const label = status === 'supported' ? 'Stock Image' : status === 'byol' ? 'BYOL' : 'Unsupported';
        return <Tag type={tagType} size="sm">{label}</Tag>;
      } else {
        const status = (result.compatibility as ROKSOSCompatibility).compatibilityStatus;
        const tagType = status === 'fully-supported' ? 'green' : status === 'supported-with-caveats' ? 'teal' : 'red';
        const label = status === 'fully-supported' ? 'Fully Supported' : status === 'supported-with-caveats' ? 'Supported (Caveats)' : 'Unsupported';
        return <Tag type={tagType} size="sm">{label}</Tag>;
      }
    };

    return [
      {
        id: 'vmName',
        accessorKey: 'vmName',
        header: 'VM Name',
        enableSorting: true,
      },
      {
        id: 'guestOS',
        accessorKey: 'guestOS',
        header: 'Operating System',
        enableSorting: true,
      },
      {
        id: 'status',
        accessorFn: (row) => {
          if (mode === 'vsi') {
            return (row.compatibility as VSIOSCompatibility).status;
          }
          return (row.compatibility as ROKSOSCompatibility).compatibilityStatus;
        },
        header: 'Compatibility Status',
        cell: ({ row }) => getStatusTag(row.original),
        enableSorting: true,
      },
      {
        id: 'notes',
        accessorFn: (row) => {
          if (mode === 'vsi') {
            return (row.compatibility as VSIOSCompatibility).notes;
          }
          return (row.compatibility as ROKSOSCompatibility).notes;
        },
        header: 'Notes',
        enableSorting: false,
      },
    ];
  }, [mode]);

  // Build chart data based on mode
  const chartData = mode === 'vsi'
    ? [
        { label: 'Stock Image', value: osStatusCounts['supported'] || 0 },
        { label: 'BYOL', value: osStatusCounts['byol'] || 0 },
        { label: 'Unsupported', value: osStatusCounts['unsupported'] || 0 },
      ].filter(d => d.value > 0)
    : [
        { label: 'Fully Supported', value: osStatusCounts['fully-supported'] || 0 },
        { label: 'Supported (Caveats)', value: osStatusCounts['supported-with-caveats'] || 0 },
        { label: 'Unsupported', value: osStatusCounts['unsupported'] || 0 },
      ].filter(d => d.value > 0);

  // Colors match the status types
  const chartColors = mode === 'vsi'
    ? ['#24a148', '#f1c21b', '#da1e28']  // green, yellow, red
    : ['#24a148', '#f1c21b', '#da1e28']; // green, yellow, red

  // Summary labels based on mode
  const summaryLabels = mode === 'vsi'
    ? [
        { label: 'Stock Image', key: 'supported', tagType: 'green' as const },
        { label: 'BYOL (Custom Image)', key: 'byol', tagType: 'magenta' as const },
        { label: 'Unsupported', key: 'unsupported', tagType: 'red' as const },
      ]
    : [
        { label: 'Fully Supported', key: 'fully-supported', tagType: 'green' as const },
        { label: 'Supported with Caveats', key: 'supported-with-caveats', tagType: 'magenta' as const },
        { label: 'Unsupported / EOL', key: 'unsupported', tagType: 'red' as const },
      ];

  const noteText = mode === 'vsi'
    ? 'Based on IBM Cloud VPC supported guest operating systems'
    : 'Based on Red Hat OpenShift Virtualization compatibility matrix';

  return (
    <Grid className="migration-page__tab-content">
      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__chart-tile">
          <DoughnutChart
            title="OS Compatibility Distribution"
            subtitle={mode === 'vsi' ? 'IBM Cloud VPC support status' : 'Red Hat validated compatibility status'}
            data={chartData}
            height={280}
            colors={chartColors}
            formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
          />
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__checks-tile">
          <h3>Compatibility Summary</h3>
          <div className="migration-page__check-items">
            {summaryLabels.map(({ label, key, tagType }) => (
              <div key={key} className="migration-page__check-item">
                <span>{label}</span>
                <span className={`cds--tag cds--tag--${tagType}`}>
                  {formatNumber(osStatusCounts[key] || 0)}
                </span>
              </div>
            ))}
          </div>
          <p className="migration-page__os-note">
            {noteText}
          </p>
        </Tile>
      </Column>

      {mode === 'vsi' && (
        <Column lg={16} md={8} sm={4}>
          <Tile className="migration-page__recommendation-tile">
            <h4>IBM Cloud VPC OS Support</h4>
            <div className="migration-page__recommendation-grid">
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Stock Image</span>
                <span className="migration-page__recommendation-value">IBM-provided stock images with full support (RHEL, Ubuntu, Windows Server, SLES, Debian, Rocky Linux, CentOS Stream)</span>
              </div>
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">BYOL (Custom Image)</span>
                <span className="migration-page__recommendation-value">Bring Your Own License - custom image supported but requires your own OS license (Windows 10/11, AlmaLinux, Oracle Linux)</span>
              </div>
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Unsupported</span>
                <span className="migration-page__recommendation-value">OS not supported on IBM Cloud VPC or end-of-life - upgrade required before migration</span>
              </div>
            </div>
          </Tile>
        </Column>
      )}

      {mode === 'roks' && (
        <Column lg={16} md={8} sm={4}>
          <Tile className="migration-page__recommendation-tile">
            <h4>OpenShift Virtualization OS Support</h4>
            <div className="migration-page__recommendation-grid">
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Fully Supported</span>
                <span className="migration-page__recommendation-value">RHEL 8/9, CentOS Stream, Windows Server 2019/2022 - optimal for migration</span>
              </div>
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Supported with Caveats</span>
                <span className="migration-page__recommendation-value">May require driver updates or configuration changes post-migration</span>
              </div>
              <div className="migration-page__recommendation-item">
                <span className="migration-page__recommendation-key">Unsupported / EOL</span>
                <span className="migration-page__recommendation-value">OS upgrade required before migration to OpenShift Virtualization</span>
              </div>
            </div>
          </Tile>
        </Column>
      )}

      {vms && vms.length > 0 && (
        <Column lg={16} md={8} sm={4}>
          <Tile className="migration-page__table-tile">
            <EnhancedDataTable
              data={osCompatibilityResults}
              columns={tableColumns}
              title="VM OS Compatibility Details"
              description={`Compatibility assessment for ${vms.length} virtual machines`}
              ariaLabel="VM OS Compatibility Table"
              enableSearch={true}
              enablePagination={true}
              enableSorting={true}
              enableExport={true}
              defaultPageSize={25}
              exportFilename={`os-compatibility-${mode}`}
            />
          </Tile>
        </Column>
      )}
    </Grid>
  );
}

export default OSCompatibilityPanel;
