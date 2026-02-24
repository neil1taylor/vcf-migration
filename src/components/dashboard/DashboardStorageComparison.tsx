// Dashboard storage calculation methods comparison tile
import { Column, Tile, Tag, Tooltip } from '@carbon/react';
import { Information } from '@carbon/icons-react';
import { mibToGiB } from '@/utils/formatters';

export interface DashboardStorageComparisonProps {
  totalDiskCapacityTiB: number;
  totalDiskCapacityMiB: number;
  totalInUseTiB: number;
  totalInUseMiB: number;
  totalProvisionedTiB: number;
  totalProvisionedMiB: number;
  totalVMs: number;
}

export function DashboardStorageComparison({
  totalDiskCapacityTiB,
  totalDiskCapacityMiB,
  totalInUseTiB,
  totalInUseMiB,
  totalProvisionedTiB,
  totalProvisionedMiB,
  totalVMs,
}: DashboardStorageComparisonProps) {
  return (
    <Column lg={16} md={8} sm={4}>
      <Tile className="dashboard-page__storage-comparison-tile">
        <div className="dashboard-page__storage-comparison-header">
          <h3 className="dashboard-page__storage-comparison-title">Storage Calculation Methods</h3>
          <Tooltip label="Different methods for calculating storage requirements. Use these values when planning migration capacity." align="top">
            <button type="button" className="dashboard-page__info-button" aria-label="More information about storage calculation methods"><Information size={14} aria-hidden="true" /></button>
          </Tooltip>
        </div>
        <p className="dashboard-page__storage-comparison-subtitle">
          Compare storage metrics for migration planning (powered-on VMs only)
        </p>
        <div className="dashboard-page__storage-comparison-grid">
          <div className="dashboard-page__storage-comparison-item">
            <div className="dashboard-page__storage-comparison-label">
              <span>Disk Capacity</span>
              <Tag type="blue" size="sm">vDisk</Tag>
            </div>
            <span className="dashboard-page__storage-comparison-value">{totalDiskCapacityTiB.toFixed(2)} TiB</span>
            <span className="dashboard-page__storage-comparison-detail">
              Full disk sizes from vDisk inventory
            </span>
            <span className="dashboard-page__storage-comparison-per-vm">
              {(mibToGiB(totalDiskCapacityMiB) / totalVMs).toFixed(1)} GiB/VM avg
            </span>
          </div>
          <div className="dashboard-page__storage-comparison-item dashboard-page__storage-comparison-item--recommended">
            <div className="dashboard-page__storage-comparison-label">
              <span>In Use</span>
              <Tag type="green" size="sm">Recommended</Tag>
            </div>
            <span className="dashboard-page__storage-comparison-value">{totalInUseTiB.toFixed(2)} TiB</span>
            <span className="dashboard-page__storage-comparison-detail">
              Actual consumed storage incl. snapshots
            </span>
            <span className="dashboard-page__storage-comparison-per-vm">
              {(mibToGiB(totalInUseMiB) / totalVMs).toFixed(1)} GiB/VM avg
            </span>
          </div>
          <div className="dashboard-page__storage-comparison-item">
            <div className="dashboard-page__storage-comparison-label">
              <span>Provisioned</span>
              <Tag type="purple" size="sm">Conservative</Tag>
            </div>
            <span className="dashboard-page__storage-comparison-value">{totalProvisionedTiB.toFixed(2)} TiB</span>
            <span className="dashboard-page__storage-comparison-detail">
              Allocated capacity incl. thin-provisioned
            </span>
            <span className="dashboard-page__storage-comparison-per-vm">
              {(mibToGiB(totalProvisionedMiB) / totalVMs).toFixed(1)} GiB/VM avg
            </span>
          </div>
        </div>
      </Tile>
    </Column>
  );
}
