// Pre-Flight Report page - Detailed VM-by-VM check results with expandable rows
import React, { useState, useMemo } from 'react';
import {
  Grid,
  Column,
  Tile,
  ContentSwitcher,
  Switch,
  Toggle,
  Button,
  Tag,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableExpandRow,
  TableExpandedRow,
  TableExpandHeader,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Pagination,
} from '@carbon/react';
import { Download } from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData, useAllVMs, useVMOverrides, useAutoExclusion } from '@/hooks';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { ROUTES } from '@/utils/constants';
import { MetricCard, CheckResultCell } from '@/components/common';
import {
  runPreFlightChecks,
  getChecksForMode,
  type CheckMode,
  type VMCheckResults,
  type CheckDefinition,
} from '@/services/preflightChecks';
import { exportPreFlightExcel } from '@/services/export/excelGenerator';
import './PreFlightReportPage.scss';

const CATEGORY_LABELS: Record<string, string> = {
  tools: 'Tools',
  storage: 'Storage',
  hardware: 'Hardware',
  config: 'Configuration',
  os: 'OS Compatibility',
};

const HEADERS = [
  { key: 'vmName', header: 'VM Name' },
  { key: 'cluster', header: 'Cluster' },
  { key: 'guestOS', header: 'Guest OS' },
  { key: 'status', header: 'Status' },
];

function groupChecksByCategory(checks: Record<string, { status: string; value?: string | number; threshold?: string | number; message?: string }>, checksForMode: CheckDefinition[]) {
  const grouped: Record<string, { checkDef: CheckDefinition; result: { status: string; value?: string | number; threshold?: string | number; message?: string } }[]> = {};
  for (const checkDef of checksForMode) {
    const result = checks[checkDef.id];
    if (!result) continue;
    if (!grouped[checkDef.category]) {
      grouped[checkDef.category] = [];
    }
    grouped[checkDef.category].push({ checkDef, result });
  }
  return grouped;
}

export function PreFlightReportPage() {
  const { rawData } = useData();
  const allVmsRaw = useAllVMs();
  const vmOverrides = useVMOverrides();
  const { getAutoExclusionById } = useAutoExclusion();
  const [mode, setMode] = useState<CheckMode>('roks');
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Apply three-tier exclusion model (same as migration pages)
  const includedVMs = useMemo(() => {
    return allVmsRaw.filter(vm => {
      const vmId = getVMIdentifier(vm);
      const autoResult = getAutoExclusionById(vmId);
      return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
    });
  }, [allVmsRaw, vmOverrides, getAutoExclusionById]);

  // Create filtered rawData with excluded VMs removed
  const filteredRawData = useMemo(() => {
    if (!rawData) return null;
    const includedNames = new Set(includedVMs.map(vm => vm.vmName));
    return {
      ...rawData,
      vInfo: includedVMs,
      vDisk: rawData.vDisk.filter(d => includedNames.has(d.vmName)),
      vSnapshot: rawData.vSnapshot.filter(s => includedNames.has(s.vmName)),
      vTools: rawData.vTools.filter(t => includedNames.has(t.vmName)),
      vNetwork: rawData.vNetwork.filter(n => includedNames.has(n.vmName)),
      vCD: rawData.vCD.filter(c => includedNames.has(c.vmName)),
      vCPU: rawData.vCPU.filter(c => includedNames.has(c.vmName)),
      vMemory: rawData.vMemory.filter(m => includedNames.has(m.vmName)),
    };
  }, [rawData, includedVMs]);

  // Run pre-flight checks on filtered data
  const checkResults = useMemo(
    () => filteredRawData ? runPreFlightChecks(filteredRawData, mode) : [],
    [filteredRawData, mode]
  );

  // Get check definitions for current mode
  const checksForMode = useMemo(() => getChecksForMode(mode), [mode]);

  // Filter by failures, search text, and sort
  const processedResults = useMemo(() => {
    let results = checkResults;

    // Filter failures
    if (showFailuresOnly) {
      results = results.filter((r) => r.blockerCount > 0 || r.warningCount > 0);
    }

    // Filter by search
    if (searchText) {
      const lower = searchText.toLowerCase();
      results = results.filter(
        (r) =>
          r.vmName.toLowerCase().includes(lower) ||
          (r.cluster || '').toLowerCase().includes(lower) ||
          (r.guestOS || '').toLowerCase().includes(lower)
      );
    }

    return results;
  }, [checkResults, showFailuresOnly, searchText]);

  // Paginate
  const paginatedResults = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedResults.slice(start, start + pageSize);
  }, [processedResults, page, pageSize]);

  // Calculate summary metrics
  const totalVMs = checkResults.length;
  const vmsWithBlockers = checkResults.filter((r) => r.blockerCount > 0).length;
  const vmsWithWarningsOnly = checkResults.filter(
    (r) => r.warningCount > 0 && r.blockerCount === 0
  ).length;
  const vmsReady = checkResults.filter(
    (r) => r.blockerCount === 0
  ).length;

  // Redirect to landing if no data
  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const handleModeChange = (evt: { name?: string | number }) => {
    if (evt.name === 'roks' || evt.name === 'vsi') {
      setMode(evt.name);
      setPage(1);
    }
  };

  const handleExport = () => {
    exportPreFlightExcel(checkResults, mode);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    setPage(1);
  };

  const handlePaginationChange = ({ page: newPage, pageSize: newPageSize }: { page: number; pageSize: number }) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };


  // Build rows for Carbon DataTable
  const rows = paginatedResults.map((r) => ({
    id: r.id,
    vmName: r.vmName,
    cluster: r.cluster || '-',
    guestOS: r.guestOS ? (r.guestOS.length > 40 ? r.guestOS.substring(0, 40) + '...' : r.guestOS) : '-',
    status: r.blockerCount > 0 ? 'blockers' : r.warningCount > 0 ? 'warnings' : 'ready',
  }));

  const renderStatusCell = (status: string, row: VMCheckResults) => {
    if (row.blockerCount > 0) {
      return <Tag type="red" size="sm">{row.blockerCount} Blockers</Tag>;
    }
    if (row.warningCount > 0) {
      return <Tag type="magenta" size="sm">{row.warningCount} Warnings</Tag>;
    }
    return <Tag type="green" size="sm">Ready</Tag>;
  };

  const renderExpandedContent = (vmResult: VMCheckResults) => {
    const grouped = groupChecksByCategory(vmResult.checks, checksForMode);
    const categoryOrder = ['tools', 'storage', 'hardware', 'config', 'os'];

    return (
      <div className="preflight-report-page__expanded-content">
        <div className="preflight-report-page__check-categories">
          {categoryOrder.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat} className="preflight-report-page__check-category">
                <div className="preflight-report-page__category-label">
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="preflight-report-page__check-items">
                  {items.map(({ checkDef, result }) => (
                    <CheckResultCell
                      key={checkDef.id}
                      result={result}
                      checkDef={checkDef}
                      showLabel
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Create a lookup map for fast access to VMCheckResults by id
  const resultMap = useMemo(() => {
    const map = new Map<string, VMCheckResults>();
    for (const r of paginatedResults) {
      map.set(r.id, r);
    }
    return map;
  }, [paginatedResults]);

  return (
    <div className="preflight-report-page">
      <Grid>
        {/* Header */}
        <Column lg={16} md={8} sm={4}>
          <h1 className="preflight-report-page__title">VM Pre-Flight Report</h1>
          <p className="preflight-report-page__subtitle">
            Detailed migration readiness check results for each virtual machine
          </p>
        </Column>

        {/* Controls */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="preflight-report-page__controls">
            <div className="preflight-report-page__controls-row">
              <div className="preflight-report-page__mode-switcher">
                <span className="preflight-report-page__label">Target Platform:</span>
                <ContentSwitcher
                  onChange={handleModeChange}
                  selectedIndex={mode === 'roks' ? 0 : 1}
                  size="md"
                >
                  <Switch name="roks" text="ROKS (OpenShift)" />
                  <Switch name="vsi" text="VSI (VPC)" />
                </ContentSwitcher>
              </div>

              <div className="preflight-report-page__filters">
                <Toggle
                  id="show-failures-toggle"
                  labelText="Show failures only"
                  labelA="Off"
                  labelB="On"
                  toggled={showFailuresOnly}
                  onToggle={() => { setShowFailuresOnly(!showFailuresOnly); setPage(1); }}
                  size="sm"
                />
              </div>

              <div className="preflight-report-page__actions">
                <Button
                  kind="tertiary"
                  size="md"
                  renderIcon={Download}
                  onClick={handleExport}
                >
                  Export Excel
                </Button>
              </div>
            </div>
          </Tile>
        </Column>

        {/* Summary Cards */}
        <Column lg={4} md={2} sm={2}>
          <MetricCard
            label="Total VMs"
            value={totalVMs}
            variant="info"
            tooltip="Total powered-on VMs analyzed for migration readiness."
          />
        </Column>
        <Column lg={4} md={2} sm={2}>
          <MetricCard
            label="With Blockers"
            value={vmsWithBlockers}
            variant="error"
            detail={`${((vmsWithBlockers / totalVMs) * 100).toFixed(1)}%`}
            tooltip="VMs with critical issues that must be resolved before migration."
          />
        </Column>
        <Column lg={4} md={2} sm={2}>
          <MetricCard
            label="Warnings Only"
            value={vmsWithWarningsOnly}
            variant="warning"
            detail={`${((vmsWithWarningsOnly / totalVMs) * 100).toFixed(1)}%`}
            tooltip="VMs with non-blocking issues that should be reviewed."
          />
        </Column>
        <Column lg={4} md={2} sm={2}>
          <MetricCard
            label="Ready to Migrate"
            value={vmsReady}
            variant="success"
            detail={`${((vmsReady / totalVMs) * 100).toFixed(1)}%`}
            tooltip="VMs with no blockers that are ready to migrate (may have warnings)."
          />
        </Column>

        {/* Check Legend */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="preflight-report-page__legend">
            <span className="preflight-report-page__label">Check Results Legend:</span>
            <div className="preflight-report-page__legend-items">
              <div className="preflight-report-page__legend-item">
                <span className="preflight-report-page__legend-icon preflight-report-page__legend-icon--pass" />
                <span>Pass</span>
              </div>
              <div className="preflight-report-page__legend-item">
                <span className="preflight-report-page__legend-icon preflight-report-page__legend-icon--fail" />
                <span>Fail (Blocker)</span>
              </div>
              <div className="preflight-report-page__legend-item">
                <span className="preflight-report-page__legend-icon preflight-report-page__legend-icon--warn" />
                <span>Warning</span>
              </div>
              <div className="preflight-report-page__legend-item">
                <span className="preflight-report-page__legend-icon preflight-report-page__legend-icon--na" />
                <span>Not Applicable</span>
              </div>
            </div>
            <span className="preflight-report-page__legend-hint">
              Click a row to expand and see check details by category
            </span>
          </Tile>
        </Column>

        {/* Data Table with Expandable Rows */}
        <Column lg={16} md={8} sm={4}>
          <div className="preflight-report-page__table">
            <DataTable
                key={mode}
                rows={rows}
                headers={HEADERS}
                isSortable
                sortRow={(cellA, cellB, { sortDirection, sortStates, key }) => {
                  if (key === 'status') {
                    const order: Record<string, number> = { blockers: 0, warnings: 1, ready: 2 };
                    const a = order[cellA] ?? 2;
                    const b = order[cellB] ?? 2;
                    return sortDirection === sortStates.ASC ? a - b : b - a;
                  }
                  if (typeof cellA === 'string') {
                    return sortDirection === sortStates.ASC
                      ? cellA.localeCompare(cellB)
                      : cellB.localeCompare(cellA);
                  }
                  return 0;
                }}
              >
              {({
                rows: carbonRows,
                headers,
                getHeaderProps,
                getRowProps,
                getTableProps,
                getTableContainerProps,
              }) => (
                <TableContainer
                  {...getTableContainerProps()}
                  title={`${mode.toUpperCase()} Pre-Flight Checks`}
                  description={`${processedResults.length} VMs · ${checksForMode.length} checks per VM`}
                >
                  <TableToolbar>
                    <TableToolbarContent>
                      <TableToolbarSearch
                        onChange={handleSearchChange}
                        placeholder="Search by VM name, cluster, or OS..."
                        persistent
                      />
                    </TableToolbarContent>
                  </TableToolbar>
                  <Table {...getTableProps()} className="preflight-report-page__fixed-table">
                    <TableHead>
                      <TableRow>
                        <TableExpandHeader />
                        {headers.map((header) => (
                          <TableHeader key={header.key} {...getHeaderProps({ header })}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {carbonRows.map((row) => {
                        const vmResult = resultMap.get(row.id);
                        return (
                          <React.Fragment key={row.id}>
                            <TableExpandRow {...getRowProps({ row })}>
                              {row.cells.map((cell) => (
                                <TableCell key={cell.id}>
                                  {cell.info.header === 'status' && vmResult
                                    ? renderStatusCell(cell.value, vmResult)
                                    : cell.value}
                                </TableCell>
                              ))}
                            </TableExpandRow>
                            <TableExpandedRow colSpan={headers.length + 1}>
                              {vmResult && renderExpandedContent(vmResult)}
                            </TableExpandedRow>
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
            <Pagination
              totalItems={processedResults.length}
              page={page}
              pageSize={pageSize}
              pageSizes={[25, 50, 100, 250]}
              onChange={handlePaginationChange}
            />
          </div>
        </Column>
      </Grid>
    </div>
  );
}
