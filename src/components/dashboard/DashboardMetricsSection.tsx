// Dashboard metrics section - Key Metrics, Storage, Average per VM, and Secondary metrics
import { Column, Tooltip } from '@carbon/react';
import { MetricCard } from '@/components/common';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { ROUTES } from '@/utils/constants';

export interface DashboardMetricsSectionProps {
  totalVMs: number;
  poweredOnVMs: number;
  totalVCPUs: number;
  totalMemoryGiB: number;
  totalMemoryTiB: number;
  totalProvisionedTiB: number;
  totalInUseTiB: number;
  totalInUseMiB: number;
  totalProvisionedMiB: number;
  templates: number;
  autoExcludedCount: number;
  autoExcludedBreakdown: {
    templates: number;
    poweredOff: number;
    vmwareInfrastructure: number;
    windowsInfrastructure: number;
  };
  uniqueClusters: number;
  uniqueDatacenters: number;
  hostCount: number;
  datastoreCount: number;
  navigate: (path: string) => void;
}

export function DashboardMetricsSection({
  totalVMs,
  poweredOnVMs,
  totalVCPUs,
  totalMemoryGiB,
  totalMemoryTiB,
  totalProvisionedTiB,
  totalInUseTiB,
  totalInUseMiB,
  totalProvisionedMiB,
  templates,
  autoExcludedCount,
  autoExcludedBreakdown,
  uniqueClusters,
  uniqueDatacenters,
  hostCount,
  datastoreCount,
  navigate,
}: DashboardMetricsSectionProps) {
  return (
    <>
      {/* Key Metrics Row */}
      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="Total VMs"
          value={formatNumber(totalVMs)}
          detail={`${formatNumber(poweredOnVMs)} powered on`}
          variant="primary"
          tooltip="Count of all virtual machines in the environment, excluding templates."
          docSection="dashboard"
          onClick={() => navigate(ROUTES.discovery)}
        />
      </Column>

      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="Total vCPUs"
          value={formatNumber(totalVCPUs)}
          detail={`Avg ${(totalVCPUs / totalVMs).toFixed(1)} per VM`}
          variant="info"
          tooltip="Sum of all virtual CPU cores allocated across all VMs."
          docSection="dashboard"
          onClick={() => navigate(ROUTES.compute)}
        />
      </Column>

      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="Total Memory"
          value={`${totalMemoryTiB.toFixed(1)} TiB`}
          detail={`Avg ${(totalMemoryGiB / totalVMs).toFixed(1)} GiB per VM`}
          variant="teal"
          tooltip="Total memory allocated to all VMs, displayed in TiB."
          docSection="dashboard"
          onClick={() => navigate(ROUTES.compute)}
        />
      </Column>

      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="Provisioned Storage"
          value={`${totalProvisionedTiB.toFixed(1)} TiB`}
          detail="Total allocated capacity"
          variant="purple"
          tooltip="Total storage capacity allocated (thin + thick provisioned) to VMs."
          docSection="dashboard"
          onClick={() => navigate(ROUTES.storage)}
        />
      </Column>

      {/* Storage metrics row - side by side */}
      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="In Use Storage"
          value={`${totalInUseTiB.toFixed(1)} TiB`}
          detail={`${((totalInUseMiB / totalProvisionedMiB) * 100).toFixed(0)}% of provisioned`}
          variant="purple"
          tooltip="Actual storage consumed by VMs on datastores."
          docSection="dashboard"
          onClick={() => navigate(ROUTES.storage)}
        />
      </Column>

      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="Storage Efficiency"
          value={`${((totalInUseMiB / totalProvisionedMiB) * 100).toFixed(0)}%`}
          detail={`${(totalProvisionedTiB - totalInUseTiB).toFixed(1)} TiB unallocated`}
          variant="success"
          tooltip="Percentage of provisioned storage that is actually in use. Higher values indicate less over-provisioning."
          docSection="dashboard"
          onClick={() => navigate(ROUTES.storage)}
        />
      </Column>

      {/* Average per VM metrics */}
      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="Avg vCPU per VM"
          value={(totalVCPUs / totalVMs).toFixed(1)}
          detail={`${formatNumber(totalVCPUs)} total vCPUs`}
          variant="info"
          tooltip="Average number of virtual CPUs allocated per VM."
          onClick={() => navigate(ROUTES.compute)}
        />
      </Column>

      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="Avg Memory per VM"
          value={`${(totalMemoryGiB / totalVMs).toFixed(1)} GiB`}
          detail={`${totalMemoryTiB.toFixed(1)} TiB total`}
          variant="teal"
          tooltip="Average memory allocated per VM in GiB."
          onClick={() => navigate(ROUTES.compute)}
        />
      </Column>

      <Column lg={4} md={4} sm={4}>
        <MetricCard
          label="Avg Storage per VM"
          value={`${(mibToGiB(totalInUseMiB) / totalVMs).toFixed(0)} GiB`}
          detail={`${totalInUseTiB.toFixed(1)} TiB total in use`}
          variant="purple"
          tooltip="Average in-use storage per VM in GiB (recommended metric for migration sizing)."
          onClick={() => navigate(ROUTES.storage)}
        />
      </Column>

      {/* Spacer between primary and secondary metrics */}
      <Column lg={16} md={8} sm={4}>
        <div className="dashboard-page__section-divider" />
      </Column>

      {/* Secondary Metrics */}
      <Column lg={3} md={4} sm={2}>
        <MetricCard
          label="ESXi Hosts"
          value={formatNumber(hostCount)}
          variant="default"
          tooltip="Total number of ESXi hypervisor hosts in the environment."
          onClick={() => navigate(ROUTES.hosts)}
        />
      </Column>

      <Column lg={3} md={4} sm={2}>
        <MetricCard
          label="Clusters"
          value={formatNumber(uniqueClusters)}
          variant="default"
          tooltip="Number of distinct VMware clusters containing VMs."
          docSection="cluster"
          onClick={() => navigate(ROUTES.cluster)}
        />
      </Column>

      <Column lg={3} md={4} sm={2}>
        <MetricCard
          label="Datacenters"
          value={formatNumber(uniqueDatacenters)}
          variant="default"
          tooltip="Number of distinct datacenters in the vCenter hierarchy."
          onClick={() => navigate(ROUTES.cluster)}
        />
      </Column>

      <Column lg={3} md={4} sm={2}>
        <MetricCard
          label="Datastores"
          value={formatNumber(datastoreCount)}
          variant="default"
          tooltip="Total number of storage datastores available to VMs."
          docSection="storage"
          onClick={() => navigate(ROUTES.storage)}
        />
      </Column>

      <Column lg={2} md={2} sm={2}>
        <MetricCard
          label="Templates"
          value={formatNumber(templates)}
          variant="default"
          tooltip="VM templates (not counted in Total VMs) used for cloning new VMs."
          onClick={() => navigate(ROUTES.discovery)}
        />
      </Column>

      <Column lg={2} md={2} sm={2}>
        <Tooltip label={`Templates: ${autoExcludedBreakdown.templates}, Powered Off: ${autoExcludedBreakdown.poweredOff}, VMware Infra: ${autoExcludedBreakdown.vmwareInfrastructure}, Windows AD/DNS: ${autoExcludedBreakdown.windowsInfrastructure}`} align="bottom">
          <MetricCard
            label="Auto-Excluded"
            value={formatNumber(autoExcludedCount)}
            variant="default"
            tooltip="VMs automatically excluded from migration scope (templates, powered-off, VMware infrastructure)."
            onClick={() => navigate(ROUTES.discovery)}
          />
        </Tooltip>
      </Column>
    </>
  );
}
