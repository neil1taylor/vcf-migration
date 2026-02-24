// Dashboard page - Executive summary
import { Grid, Column, Tile } from '@carbon/react';
import { Search } from '@carbon/icons-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/utils/constants';
import { DoughnutChart, HorizontalBarChart, VerticalBarChart } from '@/components/charts';
import { FilterBadge, NextStepBanner, SectionErrorBoundary } from '@/components/common';
import { AIInsightsPanel } from '@/components/ai/AIInsightsPanel';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardMetricsSection } from '@/components/dashboard/DashboardMetricsSection';
import { DashboardStorageComparison } from '@/components/dashboard/DashboardStorageComparison';
import { DashboardConfigAnalysis } from '@/components/dashboard/DashboardConfigAnalysis';
import './DashboardPage.scss';

export function DashboardPage() {
  const navigate = useNavigate();
  const data = useDashboardData();

  const {
    rawData,
    chartFilter,
    clearFilter,
    autoExcludedCount,
    autoExcludedBreakdown,
    totalVMs,
    poweredOnVMs,
    totalVCPUs,
    totalMemoryGiB,
    totalMemoryTiB,
    totalProvisionedMiB,
    totalProvisionedTiB,
    totalInUseMiB,
    totalInUseTiB,
    totalDiskCapacityMiB,
    totalDiskCapacityTiB,
    uniqueClusters,
    uniqueDatacenters,
    templates,
    powerStateData,
    powerStateColors,
    filteredVMs,
    osChartData,
    vmsByClusterData,
    cpuOvercommitData,
    memOvercommitData,
    configAnalysis,
    hwVersionChartData,
    toolsChartData,
    firmwareChartData,
    insightsData,
    tools,
    snapshots,
    vSources,
    handlePowerStateClick,
  } = data;

  // Redirect to landing if no data (after all hooks)
  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <div className="dashboard-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="dashboard-page__title">Executive Dashboard</h1>
          <p className="dashboard-page__subtitle">
            Overview of {rawData.metadata.fileName}
            {rawData.metadata.collectionDate && (
              <> collected on {rawData.metadata.collectionDate.toLocaleDateString()}</>
            )}
          </p>
          {chartFilter && chartFilter.dimension === 'powerState' && (
            <FilterBadge
              dimension="Power State"
              value={chartFilter.value}
              onClear={clearFilter}
            />
          )}
        </Column>

        {/* vCenter Source Info */}
        {vSources.length > 0 && (
          <Column lg={16} md={8} sm={4}>
            <Tile className="dashboard-page__source-tile">
              <h3 className="dashboard-page__source-title">Source Environment</h3>
              <div className="dashboard-page__source-grid">
                {vSources.map((source) => (
                  <div key={source.server} className="dashboard-page__source-item">
                    <div className="dashboard-page__source-row">
                      <span className="dashboard-page__source-label">vCenter Server:</span>
                      <span className="dashboard-page__source-value">{source.server}</span>
                    </div>
                    {source.version && (
                      <div className="dashboard-page__source-row">
                        <span className="dashboard-page__source-label">Version:</span>
                        <span className="dashboard-page__source-value">{source.version}{source.build ? ` (Build ${source.build})` : ''}</span>
                      </div>
                    )}
                    {source.fullName && (
                      <div className="dashboard-page__source-row">
                        <span className="dashboard-page__source-label">Product:</span>
                        <span className="dashboard-page__source-value">{source.fullName}</span>
                      </div>
                    )}
                    {source.ipAddress && (
                      <div className="dashboard-page__source-row">
                        <span className="dashboard-page__source-label">IP Address:</span>
                        <span className="dashboard-page__source-value">{source.ipAddress}</span>
                      </div>
                    )}
                    {source.apiVersion && (
                      <div className="dashboard-page__source-row">
                        <span className="dashboard-page__source-label">API Version:</span>
                        <span className="dashboard-page__source-value">{source.apiVersion}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Tile>
          </Column>
        )}

        {/* AI Migration Insights */}
        <Column lg={16} md={8} sm={4}>
          <SectionErrorBoundary sectionName="AI Migration Insights">
            <AIInsightsPanel data={insightsData} />
          </SectionErrorBoundary>
        </Column>

        {/* Key Metrics, Storage, Average per VM, Secondary Metrics */}
        <DashboardMetricsSection
          totalVMs={totalVMs}
          poweredOnVMs={poweredOnVMs}
          totalVCPUs={totalVCPUs}
          totalMemoryGiB={totalMemoryGiB}
          totalMemoryTiB={totalMemoryTiB}
          totalProvisionedTiB={totalProvisionedTiB}
          totalInUseTiB={totalInUseTiB}
          totalInUseMiB={totalInUseMiB}
          totalProvisionedMiB={totalProvisionedMiB}
          templates={templates}
          autoExcludedCount={autoExcludedCount}
          autoExcludedBreakdown={autoExcludedBreakdown}
          uniqueClusters={uniqueClusters}
          uniqueDatacenters={uniqueDatacenters}
          hostCount={rawData.vHost.length}
          datastoreCount={rawData.vDatastore.length}
          navigate={navigate}
        />

        {/* Storage Metrics Comparison Tile */}
        <DashboardStorageComparison
          totalDiskCapacityTiB={totalDiskCapacityTiB}
          totalDiskCapacityMiB={totalDiskCapacityMiB}
          totalInUseTiB={totalInUseTiB}
          totalInUseMiB={totalInUseMiB}
          totalProvisionedTiB={totalProvisionedTiB}
          totalProvisionedMiB={totalProvisionedMiB}
          totalVMs={totalVMs}
        />

        {/* Charts */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="Power State Distribution"
              subtitle="Click a segment to filter OS distribution"
              data={powerStateData}
              colors={powerStateColors}
              height={280}
              formatValue={(v) => `${v} VMs`}
              onSegmentClick={handlePowerStateClick}
            />
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <HorizontalBarChart
              title={chartFilter?.dimension === 'powerState'
                ? `Top Operating Systems (${filteredVMs.length} ${chartFilter.value} VMs)`
                : 'Top 10 Operating Systems'}
              data={osChartData}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VMs`}
            />
          </Tile>
        </Column>

        {/* Cluster Section */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="dashboard-page__section-title">Cluster Overview</h2>
        </Column>

        {/* VMs by Cluster */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <HorizontalBarChart
              title="VMs by Cluster"
              subtitle="Distribution of VMs across clusters"
              data={vmsByClusterData}
              height={280}
              valueLabel="VMs"
              formatValue={(v) => `${v} VMs`}
            />
          </Tile>
        </Column>

        {/* CPU Overcommitment by Cluster */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <VerticalBarChart
              title="CPU Overcommitment by Cluster"
              subtitle="vCPU to physical core ratio"
              data={cpuOvercommitData}
              height={280}
              valueLabel="Ratio"
              formatValue={(v) => `${v}:1`}
            />
          </Tile>
        </Column>

        {/* Memory Overcommitment by Cluster */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <VerticalBarChart
              title="Memory Overcommitment by Cluster"
              subtitle="VM memory to host memory ratio"
              data={memOvercommitData}
              height={280}
              valueLabel="Ratio"
              formatValue={(v) => `${v}:1`}
            />
          </Tile>
        </Column>

        {/* Configuration Analysis Section */}
        <Column lg={16} md={8} sm={4}>
          <h2 className="dashboard-page__section-title">Configuration Analysis</h2>
        </Column>

        {/* Configuration Analysis Cards */}
        <DashboardConfigAnalysis
          configIssuesCount={configAnalysis.configIssuesCount}
          toolsNotInstalled={configAnalysis.toolsNotInstalled}
          snapshotsBlockers={configAnalysis.snapshotsBlockers}
          outdatedHWCount={configAnalysis.outdatedHWCount}
          vmsWithCdConnected={configAnalysis.vmsWithCdConnected}
          vmsNeedConsolidation={configAnalysis.vmsNeedConsolidation}
          toolsCurrent={configAnalysis.toolsCurrent}
          vmsWithSnapshots={configAnalysis.vmsWithSnapshots}
          snapshotsTotalCount={snapshots.length}
          toolsTotalCount={tools.length}
          navigate={navigate}
        />

        {/* Configuration Charts */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="Hardware Version Distribution"
              subtitle="VM hardware compatibility versions"
              data={hwVersionChartData}
              height={280}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="VMware Tools Status"
              subtitle="Tools installation and running status"
              data={toolsChartData}
              height={280}
              colors={['#24a148', '#f1c21b', '#ff832b', '#da1e28', '#6f6f6f']}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="dashboard-page__chart-tile">
            <DoughnutChart
              title="Firmware Type"
              subtitle="BIOS vs UEFI boot firmware"
              data={firmwareChartData}
              height={280}
              colors={['#0f62fe', '#8a3ffc']}
              formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
            />
          </Tile>
        </Column>

        {/* Next Step Banner */}
        <Column lg={16} md={8} sm={4}>
          <NextStepBanner
            title="Next: Classify workloads and prepare migration scope"
            description="Review VM classifications, exclude non-migratable workloads, and map network subnets in the Discovery page."
            route={ROUTES.discovery}
            icon={Search}
          />
        </Column>
      </Grid>
    </div>
  );
}
