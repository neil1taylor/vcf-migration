// Dashboard configuration analysis cards
import { Column, ClickableTile, Tag, Tooltip } from '@carbon/react';
import { Information, ArrowRight } from '@carbon/icons-react';
import { formatNumber } from '@/utils/formatters';
import { ROUTES, HW_VERSION_MINIMUM, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';

export interface DashboardConfigAnalysisProps {
  configIssuesCount: number;
  toolsNotInstalled: number;
  snapshotsBlockers: number;
  outdatedHWCount: number;
  vmsWithCdConnected: number;
  vmsNeedConsolidation: number;
  toolsCurrent: number;
  vmsWithSnapshots: number;
  snapshotsTotalCount: number;
  toolsTotalCount: number;
  navigate: (path: string) => void;
}

export function DashboardConfigAnalysis({
  configIssuesCount,
  toolsNotInstalled,
  snapshotsBlockers,
  outdatedHWCount,
  vmsWithCdConnected,
  vmsNeedConsolidation,
  toolsCurrent,
  vmsWithSnapshots,
  snapshotsTotalCount,
  toolsTotalCount,
  navigate,
}: DashboardConfigAnalysisProps) {
  return (
    <>
      {/* Configuration Summary Card */}
      <Column lg={4} md={4} sm={4}>
        <ClickableTile className={`dashboard-page__config-tile dashboard-page__config-tile--clickable ${configIssuesCount > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`} onClick={() => navigate(`${ROUTES.tables}?tab=vms`)}>
          <div className="dashboard-page__config-header">
            <span className="dashboard-page__config-label">
              Configuration Issues
              <span onClick={e => e.stopPropagation()}>
                <Tooltip label="Sum of blocking and warning configuration issues that need attention before migration." align="top">
                  <button type="button" className="dashboard-page__info-button" aria-label="More information about configuration issues"><Information size={14} aria-hidden="true" /></button>
                </Tooltip>
              </span>
            </span>
            <Tag type={configIssuesCount > 0 ? 'red' : 'green'} size="sm">
              {configIssuesCount > 0 ? 'Action Needed' : 'OK'}
            </Tag>
          </div>
          <span className="dashboard-page__config-value">{formatNumber(configIssuesCount)}</span>
          <span className="dashboard-page__config-detail">
            Items requiring attention
          </span>
          <span className="dashboard-page__config-nav-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </ClickableTile>
      </Column>

      <Column lg={4} md={4} sm={4}>
        <ClickableTile className={`dashboard-page__config-tile dashboard-page__config-tile--clickable ${toolsNotInstalled > 0 ? 'dashboard-page__config-tile--error' : 'dashboard-page__config-tile--success'}`} onClick={() => navigate(`${ROUTES.tables}?tab=vmware-tools`)}>
          <div className="dashboard-page__config-header">
            <span className="dashboard-page__config-label">
              Tools Not Installed
              <span onClick={e => e.stopPropagation()}>
                <Tooltip label="VMs without VMware Tools installed. Tools are required for proper guest OS interaction during migration." align="top">
                  <button type="button" className="dashboard-page__info-button" aria-label="More information about tools not installed"><Information size={14} aria-hidden="true" /></button>
                </Tooltip>
              </span>
            </span>
            <Tag type={toolsNotInstalled > 0 ? 'red' : 'green'} size="sm">
              {toolsNotInstalled > 0 ? 'Blocker' : 'OK'}
            </Tag>
          </div>
          <span className="dashboard-page__config-value">{formatNumber(toolsNotInstalled)}</span>
          <span className="dashboard-page__config-detail">
            Required for migration
          </span>
          <span className="dashboard-page__config-nav-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </ClickableTile>
      </Column>

      <Column lg={4} md={4} sm={4}>
        <ClickableTile className={`dashboard-page__config-tile dashboard-page__config-tile--clickable ${snapshotsBlockers > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`} onClick={() => navigate(`${ROUTES.tables}?tab=snapshots`)}>
          <div className="dashboard-page__config-header">
            <span className="dashboard-page__config-label">
              Old Snapshots
              <span onClick={e => e.stopPropagation()}>
                <Tooltip label="Snapshots older than the threshold can cause disk chain issues. Delete or consolidate before migration." align="top">
                  <button type="button" className="dashboard-page__info-button" aria-label="More information about old snapshots"><Information size={14} aria-hidden="true" /></button>
                </Tooltip>
              </span>
            </span>
            <Tag type={snapshotsBlockers > 0 ? 'red' : 'green'} size="sm">
              {snapshotsBlockers > 0 ? 'Blocker' : 'OK'}
            </Tag>
          </div>
          <span className="dashboard-page__config-value">{formatNumber(snapshotsBlockers)}</span>
          <span className="dashboard-page__config-detail">
            Over {SNAPSHOT_BLOCKER_AGE_DAYS} days old
          </span>
          <span className="dashboard-page__config-nav-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </ClickableTile>
      </Column>

      <Column lg={4} md={4} sm={4}>
        <ClickableTile className={`dashboard-page__config-tile dashboard-page__config-tile--clickable ${outdatedHWCount > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`} onClick={() => navigate(`${ROUTES.tables}?tab=vms`)}>
          <div className="dashboard-page__config-header">
            <span className="dashboard-page__config-label">
              Outdated HW Version
              <span onClick={e => e.stopPropagation()}>
                <Tooltip label="VMs with hardware version below minimum. Upgrade to ensure compatibility with target platform." align="top">
                  <button type="button" className="dashboard-page__info-button" aria-label="More information about outdated hardware versions"><Information size={14} aria-hidden="true" /></button>
                </Tooltip>
              </span>
            </span>
            <Tag type={outdatedHWCount > 0 ? 'magenta' : 'green'} size="sm">
              {outdatedHWCount > 0 ? 'Upgrade' : 'OK'}
            </Tag>
          </div>
          <span className="dashboard-page__config-value">{formatNumber(outdatedHWCount)}</span>
          <span className="dashboard-page__config-detail">
            Below HW v{HW_VERSION_MINIMUM}
          </span>
          <span className="dashboard-page__config-nav-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </ClickableTile>
      </Column>

      <Column lg={4} md={4} sm={4}>
        <ClickableTile className={`dashboard-page__config-tile dashboard-page__config-tile--clickable ${vmsWithCdConnected > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`} onClick={() => navigate(`${ROUTES.tables}?tab=cd-roms`)}>
          <div className="dashboard-page__config-header">
            <span className="dashboard-page__config-label">
              CD-ROM Connected
              <span onClick={e => e.stopPropagation()}>
                <Tooltip label="VMs with CD/DVD drives connected. Disconnect virtual media before migration to avoid issues." align="top">
                  <button type="button" className="dashboard-page__info-button" aria-label="More information about CD-ROM connected VMs"><Information size={14} aria-hidden="true" /></button>
                </Tooltip>
              </span>
            </span>
            <Tag type={vmsWithCdConnected > 0 ? 'magenta' : 'green'} size="sm">
              {vmsWithCdConnected > 0 ? 'Disconnect' : 'OK'}
            </Tag>
          </div>
          <span className="dashboard-page__config-value">{formatNumber(vmsWithCdConnected)}</span>
          <span className="dashboard-page__config-detail">
            Disconnect before migration
          </span>
          <span className="dashboard-page__config-nav-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </ClickableTile>
      </Column>

      <Column lg={4} md={4} sm={4}>
        <ClickableTile className={`dashboard-page__config-tile dashboard-page__config-tile--clickable ${vmsNeedConsolidation > 0 ? 'dashboard-page__config-tile--warning' : 'dashboard-page__config-tile--success'}`} onClick={() => navigate(`${ROUTES.tables}?tab=snapshots`)}>
          <div className="dashboard-page__config-header">
            <span className="dashboard-page__config-label">
              Need Consolidation
              <span onClick={e => e.stopPropagation()}>
                <Tooltip label="VMs with disk chains needing consolidation. Run disk consolidation in vSphere before migration." align="top">
                  <button type="button" className="dashboard-page__info-button" aria-label="More information about disk consolidation"><Information size={14} aria-hidden="true" /></button>
                </Tooltip>
              </span>
            </span>
            <Tag type={vmsNeedConsolidation > 0 ? 'magenta' : 'green'} size="sm">
              {vmsNeedConsolidation > 0 ? 'Warning' : 'OK'}
            </Tag>
          </div>
          <span className="dashboard-page__config-value">{formatNumber(vmsNeedConsolidation)}</span>
          <span className="dashboard-page__config-detail">
            Disk consolidation needed
          </span>
          <span className="dashboard-page__config-nav-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </ClickableTile>
      </Column>

      <Column lg={4} md={4} sm={4}>
        <ClickableTile className="dashboard-page__config-tile dashboard-page__config-tile--clickable dashboard-page__config-tile--info" onClick={() => navigate(`${ROUTES.tables}?tab=vmware-tools`)}>
          <div className="dashboard-page__config-header">
            <span className="dashboard-page__config-label">
              VMware Tools Current
              <span onClick={e => e.stopPropagation()}>
                <Tooltip label="VMs with up-to-date VMware Tools installed. Current tools ensure best compatibility." align="top">
                  <button type="button" className="dashboard-page__info-button" aria-label="More information about VMware Tools status"><Information size={14} aria-hidden="true" /></button>
                </Tooltip>
              </span>
            </span>
            <Tag type="blue" size="sm">Info</Tag>
          </div>
          <span className="dashboard-page__config-value">{formatNumber(toolsCurrent)}</span>
          <span className="dashboard-page__config-detail">
            {toolsTotalCount > 0 ? `${Math.round((toolsCurrent / toolsTotalCount) * 100)}% of VMs` : 'N/A'}
          </span>
          <span className="dashboard-page__config-nav-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </ClickableTile>
      </Column>

      <Column lg={4} md={4} sm={4}>
        <ClickableTile className="dashboard-page__config-tile dashboard-page__config-tile--clickable dashboard-page__config-tile--info" onClick={() => navigate(`${ROUTES.tables}?tab=snapshots`)}>
          <div className="dashboard-page__config-header">
            <span className="dashboard-page__config-label">
              VMs with Snapshots
              <span onClick={e => e.stopPropagation()}>
                <Tooltip label="Total VMs that have one or more snapshots. Review and clean up unnecessary snapshots." align="top">
                  <button type="button" className="dashboard-page__info-button" aria-label="More information about VMs with snapshots"><Information size={14} aria-hidden="true" /></button>
                </Tooltip>
              </span>
            </span>
            <Tag type={vmsWithSnapshots > 0 ? 'high-contrast' : 'green'} size="sm">
              {vmsWithSnapshots > 0 ? 'Review' : 'None'}
            </Tag>
          </div>
          <span className="dashboard-page__config-value">{formatNumber(vmsWithSnapshots)}</span>
          <span className="dashboard-page__config-detail">
            {formatNumber(snapshotsTotalCount)} total snapshots
          </span>
          <span className="dashboard-page__config-nav-arrow" aria-hidden="true"><ArrowRight size={16} /></span>
        </ClickableTile>
      </Column>
    </>
  );
}
