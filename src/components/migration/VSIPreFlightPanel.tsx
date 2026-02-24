// VSI Pre-Flight Checks panel content - extracted from VSIMigrationPage

import { Grid, Column, Tile, Tag } from '@carbon/react';
import { formatNumber } from '@/utils/formatters';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { RemediationPanel } from '@/components/common';
import { AIRemediationPanel } from '@/components/ai/AIRemediationPanel';
import type { RemediationItem } from '@/components/common';
import type { PreflightCheckCounts } from '@/services/migration';
import type { RemediationInput } from '@/services/ai/types';

export interface VSIPreFlightPanelProps {
  preflightCounts: PreflightCheckCounts;
  vmsWithSnapshots: number;
  vmsWithWarningSnapshots: number;
  vmsWithToolsNotRunning: number;
  hwVersionCounts: { recommended: number; supported: number; outdated: number };
  remediationItems: RemediationItem[];
  remediationAIData: RemediationInput | null;
}

export function VSIPreFlightPanel({
  preflightCounts,
  vmsWithSnapshots,
  vmsWithWarningSnapshots,
  vmsWithToolsNotRunning,
  hwVersionCounts,
  remediationItems,
  remediationAIData,
}: VSIPreFlightPanelProps) {
  return (
    <Grid className="migration-page__tab-content">
      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__checks-tile">
          <h3>VMware Tools Status</h3>
          <div className="migration-page__check-items">
            <div className="migration-page__check-item">
              <span>Tools Not Installed</span>
              <Tag type={preflightCounts.vmsWithoutTools === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithoutTools)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>Tools Not Running</span>
              <Tag type={vmsWithToolsNotRunning === 0 ? 'green' : 'teal'}>{formatNumber(vmsWithToolsNotRunning)}</Tag>
            </div>
          </div>
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__checks-tile">
          <h3>Snapshot Status</h3>
          <div className="migration-page__check-items">
            <div className="migration-page__check-item">
              <span>VMs with Any Snapshots</span>
              <Tag type={vmsWithSnapshots === 0 ? 'green' : 'teal'}>{formatNumber(vmsWithSnapshots)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>Old Snapshots (&gt;{SNAPSHOT_BLOCKER_AGE_DAYS} days)</span>
              <Tag type={preflightCounts.vmsWithOldSnapshots === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithOldSnapshots)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>Warning Snapshots ({SNAPSHOT_WARNING_AGE_DAYS}-{SNAPSHOT_BLOCKER_AGE_DAYS} days)</span>
              <Tag type={vmsWithWarningSnapshots === 0 ? 'green' : 'teal'}>{formatNumber(vmsWithWarningSnapshots)}</Tag>
            </div>
          </div>
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__checks-tile">
          <h3>Storage Configuration</h3>
          <div className="migration-page__check-items">
            <div className="migration-page__check-item">
              <span>VMs with RDM Disks</span>
              <Tag type={preflightCounts.vmsWithRDM === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithRDM)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>VMs with Shared Disks</span>
              <Tag type={preflightCounts.vmsWithSharedDisks === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithSharedDisks)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>Disks &gt;2TB</span>
              <Tag type={preflightCounts.vmsWithLargeDisks === 0 ? 'green' : 'magenta'}>{formatNumber(preflightCounts.vmsWithLargeDisks)}</Tag>
            </div>
          </div>
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__checks-tile">
          <h3>VPC Profile Limits</h3>
          <div className="migration-page__check-items">
            <div className="migration-page__check-item">
              <span>Memory &gt;512GB (High-Mem)</span>
              <Tag type={(preflightCounts.vmsWithLargeMemory || 0) === 0 ? 'green' : 'magenta'}>{formatNumber((preflightCounts.vmsWithLargeMemory || 0) - (preflightCounts.vmsWithVeryLargeMemory || 0))}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>Memory &gt;1TB (Blocker)</span>
              <Tag type={(preflightCounts.vmsWithVeryLargeMemory || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithVeryLargeMemory || 0)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>Boot Disk &lt;10GB</span>
              <Tag type={(preflightCounts.vmsWithSmallBootDisk || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithSmallBootDisk || 0)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>Boot Disk &gt;250GB</span>
              <Tag type={(preflightCounts.vmsWithLargeBootDisk || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithLargeBootDisk || 0)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>&gt;12 Disks per VM</span>
              <Tag type={(preflightCounts.vmsWithTooManyDisks || 0) === 0 ? 'green' : 'red'}>{formatNumber(preflightCounts.vmsWithTooManyDisks || 0)}</Tag>
            </div>
          </div>
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="migration-page__checks-tile">
          <h3>Hardware Compatibility</h3>
          <div className="migration-page__check-items">
            <div className="migration-page__check-item">
              <span>HW v{HW_VERSION_RECOMMENDED}+ (Optimal)</span>
              <Tag type="green">{formatNumber(hwVersionCounts.recommended)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>HW v{HW_VERSION_MINIMUM}-{HW_VERSION_RECOMMENDED - 1}</span>
              <Tag type="teal">{formatNumber(hwVersionCounts.supported)}</Tag>
            </div>
            <div className="migration-page__check-item">
              <span>&lt;HW v{HW_VERSION_MINIMUM}</span>
              <Tag type={hwVersionCounts.outdated === 0 ? 'green' : 'magenta'}>{formatNumber(hwVersionCounts.outdated)}</Tag>
            </div>
          </div>
        </Tile>
      </Column>

      <Column lg={16} md={8} sm={4}>
        <RemediationPanel items={remediationItems} title="Remediation" showAffectedVMs={true} />
      </Column>

      <Column lg={16} md={8} sm={4}>
        <AIRemediationPanel data={remediationAIData} title="AI Remediation Guidance (VSI)" />
      </Column>
    </Grid>
  );
}
