/**
 * DiscoveryVMTable Component
 *
 * Unified VM table that merges the functionality of VMManagementTab and WorkloadVMTable
 * into a single table. Shows ALL VMs with:
 * - Category filter bar (clickable tiles synced with chart)
 * - Status filter (Included / Auto-Excluded / Manually Excluded / Overridden)
 * - Category column with source indicator (User / AI / Rule)
 * - Migration status column (Included / Excluded / Auto-Excluded)
 * - Inline actions: toggle exclusion, edit workload type, edit notes
 * - Bulk exclude/include
 * - CSV export, JSON export/import of overrides
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableSelectAll,
  TableSelectRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableBatchActions,
  TableBatchAction,
  Tag,
  Button,
  InlineNotification,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  Tooltip,
  Toggletip,
  ToggletipButton,
  ToggletipContent,
  MultiSelect,
  Link,
} from '@carbon/react';
import {
  Download,
  Upload,
  ViewOff,
  View,
  DocumentExport,
  Reset,
  Category,
  NotebookReference,
  Flash,
  Subtract,
  Chip,
  DataVis_1,
  Settings,
} from '@carbon/icons-react';
import { NO_AUTO_EXCLUSION } from '@/utils/autoExclusion';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { getStorageTierForWorkload, getStorageTierLabel } from '@/utils/workloadClassification';
import type { StorageTierType } from '@/utils/workloadClassification';
import { useDiscoveryVMTableActions } from '@/hooks/useDiscoveryVMTableActions';
import {
  FILTER_OPTIONS,
  getWorkloadCategories,
  getActionText,
} from './DiscoveryVMTableTypes';
import type {
  DiscoveryVMTableProps,
  FilterOption,
  VMRow,
} from './DiscoveryVMTableTypes';
import { DiscoveryCategoryFilterBar } from './DiscoveryCategoryFilterBar';
import { DiscoveryVMModals } from './DiscoveryVMModals';
import { VMDetailModal } from './VMDetailModal';
import './DiscoveryVMTable.scss';

// ===== COMPONENT =====

export function DiscoveryVMTable({
  vms,
  workloadMatches,
  vmOverrides,
  autoExclusionMap,
  aiClassifications,
  selectedCategory,
  onCategorySelect,
  workloadsByCategory,
}: DiscoveryVMTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilters, setStatusFilters] = useState<FilterOption[]>([]);
  const [viewingVMName, setViewingVMName] = useState<string | null>(null);
  const handleCloseDetail = useCallback(() => setViewingVMName(null), []);

  const workloadCategories = useMemo(() => getWorkloadCategories(), []);

  // Build a lookup: vmName → WorkloadMatch
  const vmCategoryMap = useMemo(() => {
    const map = new Map<string, (typeof workloadMatches)[0]>();
    for (const match of workloadMatches) {
      if (!map.has(match.vmName)) {
        map.set(match.vmName, match);
      }
    }
    return map;
  }, [workloadMatches]);

  // Build VM rows with category + exclusion data
  const vmRows = useMemo((): VMRow[] => {
    return vms.map(vm => {
      const vmId = getVMIdentifier(vm);
      const notes = vmOverrides.getNotes(vmId) || '';
      const autoResult = autoExclusionMap.get(vmId) ?? NO_AUTO_EXCLUSION;
      const isForceIncluded = vmOverrides.isForceIncluded(vmId);
      const isManuallyExcluded = vmOverrides.isExcluded(vmId);
      const isEffectivelyExcluded = vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);

      let exclusionSource: 'auto' | 'manual' | 'none' = 'none';
      if (isManuallyExcluded && !isForceIncluded) {
        exclusionSource = 'manual';
      } else if (autoResult.isAutoExcluded && !isForceIncluded) {
        exclusionSource = 'auto';
      }

      // Category lookup
      const match = vmCategoryMap.get(vm.vmName);
      const category = match?.category ?? '_unclassified';
      const categoryName = match ? match.categoryName : 'Unclassified';
      const categorySource = match?.source ?? 'none';
      const matchedPattern = match?.matchedPattern ?? '';

      // Compute a sortable status string
      let status: string;
      if (isForceIncluded) {
        status = 'Overridden';
      } else if (isManuallyExcluded) {
        status = 'Manually Excluded';
      } else if (autoResult.isAutoExcluded) {
        status = 'Auto-Excluded';
      } else {
        status = 'Included';
      }

      return {
        id: vmId,
        vmName: vm.vmName,
        cluster: vm.cluster,
        powerState: vm.powerState,
        cpus: vm.cpus,
        memoryGiB: Math.round(mibToGiB(vm.memory)),
        storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
        guestOS: vm.guestOS || 'Unknown',
        category: categoryName,
        categoryKey: category,
        categoryName,
        categorySource,
        matchedPattern,
        isAutoExcluded: autoResult.isAutoExcluded,
        autoExclusionLabels: autoResult.labels,
        isForceIncluded,
        isManuallyExcluded,
        isEffectivelyExcluded,
        exclusionSource,
        hasNotes: notes.length > 0,
        notes,
        flex: vmOverrides.isFlexCandidate(vmId),
        instanceStorage: vmOverrides.isInstanceStoragePreferred(vmId),
        gpuRequired: vmOverrides.isGpuRequired(vmId),
        bandwidthSensitive: vmOverrides.isBandwidthSensitive(vmId),
        bootTier: vmOverrides.getBootStorageTier(vmId) || 'general-purpose',
        dataTier: vmOverrides.getDataStorageTier(vmId) || getStorageTierForWorkload(category === '_unclassified' ? null : category),
        options: [
          vmOverrides.isFlexCandidate(vmId) ? 'Flex' : '',
          vmOverrides.isInstanceStoragePreferred(vmId) ? 'NVMe' : '',
          vmOverrides.isGpuRequired(vmId) ? 'GPU' : '',
          vmOverrides.isBandwidthSensitive(vmId) ? 'BW' : '',
          (vmOverrides.getBootStorageTier(vmId) && vmOverrides.getBootStorageTier(vmId) !== 'general-purpose') ? 'Boot' : '',
          (vmOverrides.getDataStorageTier(vmId) || getStorageTierForWorkload(category === '_unclassified' ? null : category)) !== 'general-purpose' ? 'Data' : '',
        ].filter(Boolean).join(' ') || '—',
        status,
        actions: '',
      };
    });
  }, [vms, vmOverrides, autoExclusionMap, vmCategoryMap]);

  // Apply category filter
  const categoryFilteredRows = useMemo(() => {
    if (!selectedCategory) return vmRows;
    if (selectedCategory === '_unclassified') {
      return vmRows.filter(r => r.categoryKey === '_unclassified');
    }
    return vmRows.filter(r => r.categoryKey === selectedCategory);
  }, [vmRows, selectedCategory]);

  // Apply status filter (multi-select: empty = all)
  const statusFilteredRows = useMemo(() => {
    if (statusFilters.length === 0) return categoryFilteredRows;
    return categoryFilteredRows.filter(r => {
      return statusFilters.some(f => {
        switch (f) {
          case 'included': return !r.isEffectivelyExcluded;
          case 'auto-excluded': return r.isAutoExcluded && !r.isForceIncluded;
          case 'manually-excluded': return r.isManuallyExcluded && !r.isAutoExcluded;
          case 'overridden': return r.isForceIncluded;
          case 'unclassified': return r.categoryKey === '_unclassified';
          default: return false;
        }
      });
    });
  }, [categoryFilteredRows, statusFilters]);

  // Filter by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return statusFilteredRows;
    const term = searchTerm.toLowerCase();
    return statusFilteredRows.filter(row =>
      row.vmName.toLowerCase().includes(term) ||
      row.cluster.toLowerCase().includes(term) ||
      row.guestOS.toLowerCase().includes(term) ||
      row.categoryName.toLowerCase().includes(term) ||
      row.notes.toLowerCase().includes(term) ||
      row.autoExclusionLabels.some(l => l.toLowerCase().includes(term))
    );
  }, [statusFilteredRows, searchTerm]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Count unclassified for the filter bar
  const unclassifiedCount = useMemo(() => {
    return vmRows.filter(r => r.categoryKey === '_unclassified').length;
  }, [vmRows]);

  // Actions hook
  const {
    editingNotes,
    setEditingNotes,
    editingWorkload,
    setEditingWorkload,
    bulkWorkloadVMs,
    setBulkWorkloadVMs,
    bulkNotesVMs,
    setBulkNotesVMs,
    bulkNotesText,
    setBulkNotesText,
    showImportModal,
    setShowImportModal,
    importJson,
    setImportJson,
    importError,
    setImportError,
    handleBulkExclude,
    handleBulkInclude,
    handleBulkEditWorkload,
    handleBulkSaveWorkload,
    handleBulkEditNotes,
    handleBulkSaveNotes,
    handleToggleExclusion,
    handleEditNotes,
    handleSaveNotes,
    handleEditWorkload,
    handleSaveWorkload,
    handleExportSettings,
    handleImportSettings,
    handleExportCSV,
  } = useDiscoveryVMTableActions(vmRows, vmOverrides);

  // ===== RENDER HELPERS =====

  function renderStatusTags(row: VMRow) {
    if (row.isForceIncluded) {
      return (
        <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          <Tag type="green" size="sm" onClick={() => handleToggleExclusion(row)} style={{ cursor: 'pointer' }}>Included</Tag>
          <Tag type="outline" size="sm">Override</Tag>
        </span>
      );
    }
    if (row.isAutoExcluded) {
      return (
        <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          <Tag type="red" size="sm" onClick={() => handleToggleExclusion(row)} style={{ cursor: 'pointer' }}>Auto-Excluded</Tag>
          {row.autoExclusionLabels.map(label => (
            <Tag key={label} type="magenta" size="sm">{label}</Tag>
          ))}
        </span>
      );
    }
    if (row.isManuallyExcluded) {
      return <Tag type="gray" size="sm" onClick={() => handleToggleExclusion(row)} style={{ cursor: 'pointer' }}>Excluded</Tag>;
    }
    return <Tag type="green" size="sm" onClick={() => handleToggleExclusion(row)} style={{ cursor: 'pointer' }}>Included</Tag>;
  }

  function renderCategoryCell(row: VMRow) {
    if (row.categoryKey === '_unclassified') {
      return (
        <Tag type="gray" size="sm" onClick={() => handleEditWorkload(row)} style={{ cursor: 'pointer' }}>
          Unclassified
        </Tag>
      );
    }

    const aiResult = aiClassifications?.[row.vmName];
    const hasAI = aiResult?.source === 'ai';
    const isUserSource = row.categorySource === 'user';
    const isMaintainerSource = row.categorySource === 'maintainer';
    const isAISource = row.categorySource === 'ai';

    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
        <Tag type="blue" size="sm" onClick={() => handleEditWorkload(row)} style={{ cursor: 'pointer' }}>{row.categoryName}</Tag>
        {isAISource && hasAI && (
          <Tooltip label={aiResult.reasoning || 'AI-classified workload'} align="bottom">
            <button type="button" style={{ all: 'unset', cursor: 'help' }}>
              <Tag type="purple" size="sm">AI {Math.round(aiResult.confidence * 100)}%</Tag>
            </button>
          </Tooltip>
        )}
        {!isUserSource && !isMaintainerSource && !isAISource && hasAI && aiResult.workloadType &&
          aiResult.workloadType.toLowerCase() !== row.categoryName.toLowerCase() && (
          <Tooltip label={`AI suggests: ${aiResult.workloadType}. ${aiResult.reasoning || ''}`} align="bottom">
            <button type="button" style={{ all: 'unset', cursor: 'help' }}>
              <Tag type="purple" size="sm">AI: {aiResult.workloadType}</Tag>
            </button>
          </Tooltip>
        )}
      </span>
    );
  }

  // Sort categories by count for filter bar
  const sortedCategories = useMemo(() => {
    return Object.entries(workloadsByCategory)
      .sort((a, b) => b[1].vms.size - a[1].vms.size);
  }, [workloadsByCategory]);

  const headers = [
    { key: 'vmName', header: 'VM Name' },
    { key: 'cluster', header: 'Cluster' },
    { key: 'cpus', header: 'vCPUs' },
    { key: 'memoryGiB', header: 'Memory' },
    { key: 'storageGiB', header: 'Storage' },
    { key: 'category', header: 'Workload Type' },
    { key: 'options', header: 'Options' },
    { key: 'status', header: 'Status' },
    { key: 'notes', header: 'Notes' },
    { key: 'actions', header: '' },
  ];

  return (
    <div className="discovery-vm-table">
      {/* Environment mismatch warning */}
      {vmOverrides.environmentMismatch && (
        <div className="discovery-vm-table__mismatch-warning">
          <InlineNotification
            kind="warning"
            title="VM overrides from a different environment were found."
            subtitle="These overrides may not match the current RVTools data."
            lowContrast
            hideCloseButton
          />
          <div className="discovery-vm-table__mismatch-actions">
            <Button size="sm" kind="tertiary" onClick={vmOverrides.applyMismatchedOverrides}>
              Apply Anyway
            </Button>
            <Button size="sm" kind="ghost" onClick={vmOverrides.clearAndReset}>
              Clear Overrides
            </Button>
          </div>
        </div>
      )}

      {/* Category filter bar */}
      <DiscoveryCategoryFilterBar
        sortedCategories={sortedCategories}
        selectedCategory={selectedCategory}
        onCategorySelect={onCategorySelect}
        unclassifiedCount={unclassifiedCount}
        setPage={setPage}
      />

      {/* Export/Import toolbar */}
      <div className="discovery-vm-table__toolbar-row">
        <Button size="sm" kind="ghost" renderIcon={Download} onClick={handleExportSettings}>
          Export Overrides
        </Button>
        <Button size="sm" kind="ghost" renderIcon={Upload} onClick={() => setShowImportModal(true)}>
          Import Overrides
        </Button>
        {vmOverrides.overrideCount > 0 && (
          <Button size="sm" kind="ghost" renderIcon={Reset} onClick={vmOverrides.clearAllOverrides} iconDescription="Clear all overrides">
            Clear All ({vmOverrides.overrideCount})
          </Button>
        )}
      </div>

      {/* Storage tier legend */}
      <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginBottom: '0.5rem', padding: '0.5rem 1rem', backgroundColor: 'var(--cds-layer-01)', borderRadius: '4px' }}>
        <strong>Storage IOPS Tiers</strong> — used for non-ODF solutions (ROKS/ROVE BM + Block, BM + NFS) and VPC VSI. ODF solutions ignore these settings.<br />
        VPC VSI boot volumes are always Standard (IBM Cloud requirement); boot tier overrides apply to ROKS/ROVE only.<br />
        <span style={{ display: 'inline-flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
          <span><Tag type="outline" size="sm">Standard</Tag> 3 IOPS/GB · 500 IOPS</span>
          <span><Tag type="teal" size="sm">Performance</Tag> 5 IOPS/GB · 1,000 IOPS</span>
          <span><Tag type="purple" size="sm">High Performance</Tag> 10 IOPS/GB · 3,000 IOPS</span>
        </span>
      </div>

      {/* Data Table */}
      <DataTable
        rows={paginatedRows}
        headers={headers}
        isSortable
      >
        {({
          rows,
          headers: tableHeaders,
          getHeaderProps,
          getRowProps,
          getSelectionProps,
          getTableProps,
          getTableContainerProps,
          getBatchActionProps,
          selectedRows,
        }) => {
          const batchActionProps = getBatchActionProps();

          return (
            <TableContainer
              {...getTableContainerProps()}
              title="Virtual Machines"
              description={
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    <li>Click VM Name for details. Ensure Workload Type is correct.</li>
                    <li><strong>Flex</strong> — set for workloads suitable for shared-CPU VSIs.</li>
                    <li><strong>Instance Storage</strong> — set to NVMe for fast local I/O (e.g. DB scratch, Kafka).</li>
                    <li><strong>GPU</strong> — set for workloads requiring GPU acceleration (ML/AI, CUDA).</li>
                    <li><strong>Bandwidth</strong> — set to High BW for network-throughput-bound workloads.</li>
                    <li><strong>Status</strong> — exclude VMs not in scope for migration.</li>
                  </ul>
                }
            >
              <TableToolbar>
                <TableBatchActions {...batchActionProps}>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={ViewOff}
                    onClick={() => handleBulkExclude(selectedRows)}
                  >
                    Exclude from Migration
                  </TableBatchAction>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={View}
                    onClick={() => handleBulkInclude(selectedRows)}
                  >
                    Include in Migration
                  </TableBatchAction>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={Category}
                    onClick={() => handleBulkEditWorkload(selectedRows)}
                  >
                    Change Workload Type
                  </TableBatchAction>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={Flash}
                    onClick={() => {
                      const selected = selectedRows.map(r => {
                        const orig = paginatedRows.find(pr => pr.id === r.id);
                        return orig ? { vmId: orig.id, vmName: orig.vmName } : null;
                      }).filter(Boolean) as Array<{ vmId: string; vmName: string }>;
                      vmOverrides.bulkSetFlexCandidate(selected, true);
                    }}
                  >
                    Mark as Flex
                  </TableBatchAction>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={Subtract}
                    onClick={() => {
                      const selected = selectedRows.map(r => {
                        const orig = paginatedRows.find(pr => pr.id === r.id);
                        return orig ? { vmId: orig.id, vmName: orig.vmName } : null;
                      }).filter(Boolean) as Array<{ vmId: string; vmName: string }>;
                      vmOverrides.bulkSetFlexCandidate(selected, false);
                    }}
                  >
                    Mark as Standard
                  </TableBatchAction>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={Chip}
                    onClick={() => {
                      const selected = selectedRows.map(r => {
                        const orig = paginatedRows.find(pr => pr.id === r.id);
                        return orig ? { vmId: orig.id, vmName: orig.vmName } : null;
                      }).filter(Boolean) as Array<{ vmId: string; vmName: string }>;
                      vmOverrides.bulkSetGpuRequired(selected, true);
                    }}
                  >
                    Mark as GPU Required
                  </TableBatchAction>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={DataVis_1}
                    onClick={() => {
                      const selected = selectedRows.map(r => {
                        const orig = paginatedRows.find(pr => pr.id === r.id);
                        return orig ? { vmId: orig.id, vmName: orig.vmName } : null;
                      }).filter(Boolean) as Array<{ vmId: string; vmName: string }>;
                      vmOverrides.bulkSetBandwidthSensitive(selected, true);
                    }}
                  >
                    Mark as Bandwidth Sensitive
                  </TableBatchAction>
                  <TableBatchAction
                    tabIndex={batchActionProps.shouldShowBatchActions ? 0 : -1}
                    renderIcon={NotebookReference}
                    onClick={() => handleBulkEditNotes(selectedRows)}
                  >
                    Add Notes
                  </TableBatchAction>
                </TableBatchActions>
                <TableToolbarContent>
                  <TableToolbarSearch
                    labelText="Search virtual machines"
                    placeholder="Search VMs..."
                    onChange={(e) => {
                      const value = typeof e === 'string' ? e : e.target.value;
                      setSearchTerm(value);
                      setPage(1);
                    }}
                    value={searchTerm}
                    persistent
                  />
                  <MultiSelect
                    id="discovery-status-filter"
                    titleText=""
                    label="Status filter"
                    items={FILTER_OPTIONS}
                    itemToString={(item) => item?.text || ''}
                    selectedItems={FILTER_OPTIONS.filter(o => statusFilters.includes(o.id))}
                    onChange={({ selectedItems }) => {
                      setStatusFilters((selectedItems ?? []).map(i => i.id));
                      setPage(1);
                    }}
                    size="sm"
                    className="discovery-vm-table__status-filter"
                  />
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={DocumentExport}
                    onClick={() => handleExportCSV(filteredRows)}
                    hasIconOnly
                    iconDescription="Export to CSV"
                  />
                </TableToolbarContent>
              </TableToolbar>

              <Table {...getTableProps()} size="md">
                <TableHead>
                  <TableRow>
                    <TableSelectAll {...getSelectionProps()} />
                    {tableHeaders.map((header) => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const originalRow = paginatedRows.find(r => r.id === row.id);
                    if (!originalRow) return null;

                    const rowClassName = originalRow.isEffectivelyExcluded
                      ? 'discovery-vm-table__row--excluded'
                      : originalRow.isForceIncluded
                        ? 'discovery-vm-table__row--overridden'
                        : '';

                    return (
                      <TableRow
                        {...getRowProps({ row })}
                        key={row.id}
                        className={rowClassName}
                      >
                        <TableSelectRow {...getSelectionProps({ row })} />
                        <TableCell>
                          <Link href="#" onClick={(e: React.MouseEvent) => { e.preventDefault(); setViewingVMName(originalRow.vmName); }}>
                            {originalRow.vmName}
                          </Link>
                        </TableCell>
                        <TableCell>{originalRow.cluster}</TableCell>
                        <TableCell>{originalRow.cpus}</TableCell>
                        <TableCell>{originalRow.memoryGiB} GiB</TableCell>
                        <TableCell>{originalRow.storageGiB} GiB</TableCell>
                        <TableCell>
                          {renderCategoryCell(originalRow)}
                        </TableCell>
                        <TableCell>
                          <Toggletip align="bottom" autoAlign>
                            <ToggletipButton label="VM options">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {originalRow.options === '—'
                                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--cds-text-secondary)' }}><Settings size={14} /> Defaults</span>
                                  : <>
                                      <Settings size={14} />
                                      {originalRow.flex && <Tag type="cyan" size="sm">Flex</Tag>}
                                      {originalRow.instanceStorage && <Tag type="teal" size="sm">NVMe</Tag>}
                                      {originalRow.gpuRequired && <Tag type="purple" size="sm">GPU</Tag>}
                                      {originalRow.bandwidthSensitive && <Tag type="cyan" size="sm">BW</Tag>}
                                      {originalRow.bootTier !== 'general-purpose' && <Tag type={originalRow.bootTier === '10iops' ? 'purple' : 'teal'} size="sm">Boot: {getStorageTierLabel(originalRow.bootTier as StorageTierType)}</Tag>}
                                      {originalRow.dataTier !== 'general-purpose' && <Tag type={originalRow.dataTier === '10iops' ? 'purple' : 'teal'} size="sm">Data: {getStorageTierLabel(originalRow.dataTier as StorageTierType)}</Tag>}
                                    </>
                                }
                              </span>
                            </ToggletipButton>
                            <ToggletipContent>
                              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', alignItems: 'center', padding: '0.25rem 0' }}>
                                <span style={{ fontSize: '0.75rem' }}>Profile</span>
                                <Tag type={originalRow.flex ? 'cyan' : 'outline'} size="sm" onClick={() => vmOverrides.setFlexCandidate(originalRow.id, originalRow.vmName, !originalRow.flex)} style={{ cursor: 'pointer' }}>
                                  {originalRow.flex ? 'Flex' : 'Standard'}
                                </Tag>
                                <span style={{ fontSize: '0.75rem' }}>Storage</span>
                                <Tag type={originalRow.instanceStorage ? 'teal' : 'outline'} size="sm" onClick={() => vmOverrides.setInstanceStorage(originalRow.id, originalRow.vmName, !originalRow.instanceStorage)} style={{ cursor: 'pointer' }}>
                                  {originalRow.instanceStorage ? 'NVMe' : 'Block'}
                                </Tag>
                                <span style={{ fontSize: '0.75rem' }}>GPU</span>
                                <Tag type={originalRow.gpuRequired ? 'purple' : 'outline'} size="sm" onClick={() => vmOverrides.setGpuRequired(originalRow.id, originalRow.vmName, !originalRow.gpuRequired)} style={{ cursor: 'pointer' }}>
                                  {originalRow.gpuRequired ? 'GPU' : 'Standard'}
                                </Tag>
                                <span style={{ fontSize: '0.75rem' }}>Bandwidth</span>
                                <Tag type={originalRow.bandwidthSensitive ? 'cyan' : 'outline'} size="sm" onClick={() => vmOverrides.setBandwidthSensitive(originalRow.id, originalRow.vmName, !originalRow.bandwidthSensitive)} style={{ cursor: 'pointer' }}>
                                  {originalRow.bandwidthSensitive ? 'High BW' : 'Standard'}
                                </Tag>
                                <span style={{ fontSize: '0.75rem' }}>Boot IOPS</span>
                                <Tag
                                  type={originalRow.bootTier === '10iops' ? 'purple' : originalRow.bootTier === '5iops' ? 'teal' : 'outline'} size="sm"
                                  onClick={() => {
                                    const tiers: StorageTierType[] = ['general-purpose', '5iops', '10iops'];
                                    const idx = tiers.indexOf(originalRow.bootTier as StorageTierType);
                                    const next = tiers[(idx + 1) % tiers.length];
                                    vmOverrides.setBootStorageTier(originalRow.id, originalRow.vmName, next === 'general-purpose' ? undefined : next);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {getStorageTierLabel(originalRow.bootTier as StorageTierType)}
                                </Tag>
                                <span style={{ fontSize: '0.75rem' }}>Data IOPS</span>
                                <Tag
                                  type={originalRow.dataTier === '10iops' ? 'purple' : originalRow.dataTier === '5iops' ? 'teal' : 'outline'} size="sm"
                                  onClick={() => {
                                    const tiers: StorageTierType[] = ['general-purpose', '5iops', '10iops'];
                                    const idx = tiers.indexOf(originalRow.dataTier as StorageTierType);
                                    const next = tiers[(idx + 1) % tiers.length];
                                    vmOverrides.setDataStorageTier(originalRow.id, originalRow.vmName, next === getStorageTierForWorkload(originalRow.categoryKey === '_unclassified' ? null : originalRow.categoryKey) ? undefined : next);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {getStorageTierLabel(originalRow.dataTier as StorageTierType)}
                                </Tag>
                              </div>
                            </ToggletipContent>
                          </Toggletip>
                        </TableCell>
                        <TableCell>
                          {renderStatusTags(originalRow)}
                        </TableCell>
                        <TableCell>
                          {originalRow.hasNotes && (
                            <Tooltip label={originalRow.notes}>
                              <Tag type="outline" size="sm">Has Notes</Tag>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          <OverflowMenu size="sm" flipped iconDescription="Actions">
                            <OverflowMenuItem
                              itemText="View Details"
                              onClick={() => setViewingVMName(originalRow.vmName)}
                            />
                            <OverflowMenuItem
                              itemText={getActionText(originalRow)}
                              onClick={() => handleToggleExclusion(originalRow)}
                            />
                            <OverflowMenuItem
                              itemText="Edit Workload Type"
                              onClick={() => handleEditWorkload(originalRow)}
                            />
                            <OverflowMenuItem
                              itemText={originalRow.hasNotes ? 'Edit Notes' : 'Add Notes'}
                              onClick={() => handleEditNotes(originalRow)}
                            />
                            {vmOverrides.hasOverride(originalRow.id) && (
                              <OverflowMenuItem
                                itemText="Clear All Overrides"
                                isDelete
                                onClick={() => vmOverrides.removeOverride(originalRow.id)}
                              />
                            )}
                          </OverflowMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          );
        }}
      </DataTable>

      {/* Pagination */}
      <div className="discovery-vm-table__pagination">
        <div className="discovery-vm-table__pagination-info">
          <Tag type="gray" size="sm">
            {formatNumber(filteredRows.length)} VMs
          </Tag>
          {(searchTerm || selectedCategory || statusFilters.length > 0) && (
            <Tag type="blue" size="sm">
              Filtered from {formatNumber(vmRows.length)}
            </Tag>
          )}
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          pageSizes={[10, 25, 50, 100]}
          totalItems={filteredRows.length}
          onChange={({ page: newPage, pageSize: newPageSize }) => {
            setPage(newPage);
            setPageSize(newPageSize);
          }}
          itemsPerPageText="VMs per page:"
        />
      </div>

      {/* VM Detail Modal */}
      <VMDetailModal vmName={viewingVMName} onClose={handleCloseDetail} />

      {/* Modals */}
      <DiscoveryVMModals
        editingNotes={editingNotes}
        setEditingNotes={setEditingNotes}
        handleSaveNotes={handleSaveNotes}
        editingWorkload={editingWorkload}
        setEditingWorkload={setEditingWorkload}
        handleSaveWorkload={handleSaveWorkload}
        workloadCategories={workloadCategories}
        bulkWorkloadVMs={bulkWorkloadVMs}
        setBulkWorkloadVMs={setBulkWorkloadVMs}
        handleBulkSaveWorkload={handleBulkSaveWorkload}
        bulkNotesVMs={bulkNotesVMs}
        setBulkNotesVMs={setBulkNotesVMs}
        bulkNotesText={bulkNotesText}
        setBulkNotesText={setBulkNotesText}
        handleBulkSaveNotes={handleBulkSaveNotes}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        importJson={importJson}
        setImportJson={setImportJson}
        importError={importError}
        setImportError={setImportError}
        handleImportSettings={handleImportSettings}
      />
    </div>
  );
}

export default DiscoveryVMTable;
