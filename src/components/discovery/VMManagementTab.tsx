/**
 * VMManagementTab Component
 *
 * Full VM listing with the ability to:
 * - Exclude/include VMs from migration scope
 * - Override auto-detected workload types
 * - Add user notes per VM
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
  Modal,
  TextArea,
  ComboBox,
  Pagination,
  Tile,
  Grid,
  Column,
  Tooltip,
} from '@carbon/react';
import {
  Download,
  Upload,
  ViewOff,
  View,
  DocumentExport,
  Reset,
} from '@carbon/icons-react';
import type { VirtualMachine } from '@/types/rvtools';
import type { UseVMOverridesReturn } from '@/hooks/useVMOverrides';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import workloadPatterns from '@/data/workloadPatterns.json';
import './VMManagementTab.scss';

// ===== TYPES =====

interface VMManagementTabProps {
  vms: VirtualMachine[];
  vmOverrides: UseVMOverridesReturn;
  poweredOnOnly?: boolean;
}

interface VMRow {
  id: string;
  vmName: string;
  cluster: string;
  datacenter: string;
  powerState: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  guestOS: string;
  detectedWorkload: string | null;
  effectiveWorkload: string;
  isExcluded: boolean;
  hasNotes: boolean;
  notes: string;
}

// ===== WORKLOAD DETECTION =====

function detectWorkload(vm: VirtualMachine): string | null {
  const vmNameLower = vm.vmName.toLowerCase();
  const annotationLower = (vm.annotation || '').toLowerCase();
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;

  for (const [, category] of Object.entries(categories)) {
    for (const pattern of category.patterns) {
      if (vmNameLower.includes(pattern) || annotationLower.includes(pattern)) {
        return category.name;
      }
    }
  }
  return null;
}

// Get all workload category names for dropdown
function getWorkloadCategories(): Array<{ id: string; text: string }> {
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;
  const items = Object.entries(categories).map(([key, cat]) => ({
    id: key,
    text: cat.name,
  }));
  // Add "Unclassified" option to clear auto-detection
  items.unshift({ id: 'unclassified', text: 'Unclassified' });
  return items;
}

// ===== COMPONENT =====

export function VMManagementTab({ vms, vmOverrides, poweredOnOnly = true }: VMManagementTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editingNotes, setEditingNotes] = useState<{ vmId: string; vmName: string; notes: string } | null>(null);
  const [editingWorkload, setEditingWorkload] = useState<{ vmId: string; vmName: string; current: string | undefined } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const workloadCategories = useMemo(() => getWorkloadCategories(), []);

  // Filter and transform VMs
  // Note: We depend on vmOverrides.overrides to ensure re-render when overrides change
  const vmRows = useMemo((): VMRow[] => {
    const filtered = poweredOnOnly ? vms.filter(vm => vm.powerState === 'poweredOn') : vms;

    return filtered.map(vm => {
      const vmId = getVMIdentifier(vm);
      const detected = detectWorkload(vm);
      const overrideWorkload = vmOverrides.getWorkloadType(vmId);
      const notes = vmOverrides.getNotes(vmId) || '';

      return {
        id: vmId,
        vmName: vm.vmName,
        cluster: vm.cluster,
        datacenter: vm.datacenter,
        powerState: vm.powerState,
        cpus: vm.cpus,
        memoryGiB: Math.round(mibToGiB(vm.memory)),
        storageGiB: Math.round(mibToGiB(vm.provisionedMiB)),
        guestOS: vm.guestOS || 'Unknown',
        detectedWorkload: detected,
        effectiveWorkload: overrideWorkload || detected || 'Unclassified',
        isExcluded: vmOverrides.isExcluded(vmId),
        hasNotes: notes.length > 0,
        notes,
      };
    });
  }, [vms, poweredOnOnly, vmOverrides.overrides, vmOverrides.getWorkloadType, vmOverrides.getNotes, vmOverrides.isExcluded]);

  // Filter by search term
  const filteredRows = useMemo(() => {
    if (!searchTerm) return vmRows;
    const term = searchTerm.toLowerCase();
    return vmRows.filter(row =>
      row.vmName.toLowerCase().includes(term) ||
      row.cluster.toLowerCase().includes(term) ||
      row.datacenter.toLowerCase().includes(term) ||
      row.guestOS.toLowerCase().includes(term) ||
      row.effectiveWorkload.toLowerCase().includes(term) ||
      row.notes.toLowerCase().includes(term)
    );
  }, [vmRows, searchTerm]);

  // Paginate
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Stats
  const includedCount = vmRows.filter(r => !r.isExcluded).length;
  const excludedCount = vmRows.filter(r => r.isExcluded).length;

  // ===== ACTIONS =====

  const handleBulkExclude = useCallback((selectedRows: Array<{ id: string }>) => {
    const toExclude = selectedRows.map(row => {
      const vmRow = vmRows.find(r => r.id === row.id);
      return { vmId: row.id, vmName: vmRow?.vmName || '' };
    });
    vmOverrides.bulkSetExcluded(toExclude, true);
  }, [vmRows, vmOverrides]);

  const handleBulkInclude = useCallback((selectedRows: Array<{ id: string }>) => {
    const toInclude = selectedRows.map(row => {
      const vmRow = vmRows.find(r => r.id === row.id);
      return { vmId: row.id, vmName: vmRow?.vmName || '' };
    });
    vmOverrides.bulkSetExcluded(toInclude, false);
  }, [vmRows, vmOverrides]);

  const handleToggleExclusion = useCallback((row: VMRow) => {
    vmOverrides.setExcluded(row.id, row.vmName, !row.isExcluded);
  }, [vmOverrides]);

  const handleEditNotes = useCallback((row: VMRow) => {
    setEditingNotes({ vmId: row.id, vmName: row.vmName, notes: row.notes });
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (editingNotes) {
      vmOverrides.setNotes(editingNotes.vmId, editingNotes.vmName, editingNotes.notes || undefined);
      setEditingNotes(null);
    }
  }, [editingNotes, vmOverrides]);

  const handleEditWorkload = useCallback((row: VMRow) => {
    setEditingWorkload({
      vmId: row.id,
      vmName: row.vmName,
      current: vmOverrides.getWorkloadType(row.id) || row.detectedWorkload || undefined,
    });
  }, [vmOverrides.getWorkloadType]);

  const handleSaveWorkload = useCallback((item: { id: string; text: string } | string | null | undefined) => {
    if (editingWorkload) {
      // Handle string (custom typed value) or object (selected from list)
      const text = typeof item === 'string' ? item : item?.text;
      const id = typeof item === 'string' ? 'custom' : item?.id;

      if (text && id !== 'unclassified') {
        vmOverrides.setWorkloadType(editingWorkload.vmId, editingWorkload.vmName, text);
      } else {
        // Clear override
        vmOverrides.setWorkloadType(editingWorkload.vmId, editingWorkload.vmName, undefined);
      }
      setEditingWorkload(null);
    }
  }, [editingWorkload, vmOverrides]);

  const handleExportSettings = useCallback(() => {
    const json = vmOverrides.exportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vm-overrides.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [vmOverrides]);

  const handleImportSettings = useCallback(() => {
    setImportError(null);
    if (!importJson.trim()) {
      setImportError('Please paste valid JSON');
      return;
    }
    const success = vmOverrides.importSettings(importJson);
    if (success) {
      setShowImportModal(false);
      setImportJson('');
    } else {
      setImportError('Invalid JSON format');
    }
  }, [importJson, vmOverrides]);

  const handleExportCSV = useCallback(() => {
    const headers = ['VM Name', 'Cluster', 'Datacenter', 'Power State', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Guest OS', 'Workload Type', 'Status', 'Notes'];
    const rows = filteredRows.map(row => [
      row.vmName,
      row.cluster,
      row.datacenter,
      row.powerState,
      row.cpus.toString(),
      row.memoryGiB.toString(),
      row.storageGiB.toString(),
      row.guestOS,
      row.effectiveWorkload,
      row.isExcluded ? 'Excluded' : 'Included',
      row.notes,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vm-inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  // ===== RENDER =====

  const headers = [
    { key: 'vmName', header: 'VM Name' },
    { key: 'cluster', header: 'Cluster' },
    { key: 'cpus', header: 'vCPUs' },
    { key: 'memoryGiB', header: 'Memory' },
    { key: 'storageGiB', header: 'Storage' },
    { key: 'effectiveWorkload', header: 'Workload Type' },
    { key: 'status', header: 'Status' },
    { key: 'notes', header: 'Notes' },
    { key: 'actions', header: '' },
  ];

  return (
    <div className="vm-management-tab">
      {/* Environment mismatch warning */}
      {vmOverrides.environmentMismatch && (
        <div className="vm-management-tab__mismatch-warning">
          <InlineNotification
            kind="warning"
            title="VM overrides from a different environment were found."
            subtitle="These overrides may not match the current RVTools data."
            lowContrast
            hideCloseButton
          />
          <div className="vm-management-tab__mismatch-actions">
            <Button size="sm" kind="tertiary" onClick={vmOverrides.applyMismatchedOverrides}>
              Apply Anyway
            </Button>
            <Button size="sm" kind="ghost" onClick={vmOverrides.clearAndReset}>
              Clear Overrides
            </Button>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <Grid className="vm-management-tab__summary" narrow>
        <Column lg={4} md={2} sm={2}>
          <Tile className="vm-management-tab__summary-tile">
            <span className="vm-management-tab__summary-label">Included VMs</span>
            <span className="vm-management-tab__summary-value vm-management-tab__summary-value--included">
              {formatNumber(includedCount)}
            </span>
          </Tile>
        </Column>
        <Column lg={4} md={2} sm={2}>
          <Tile className="vm-management-tab__summary-tile">
            <span className="vm-management-tab__summary-label">Excluded VMs</span>
            <span className="vm-management-tab__summary-value vm-management-tab__summary-value--excluded">
              {formatNumber(excludedCount)}
            </span>
          </Tile>
        </Column>
        <Column lg={4} md={2} sm={2}>
          <Tile className="vm-management-tab__summary-tile">
            <span className="vm-management-tab__summary-label">With Overrides</span>
            <span className="vm-management-tab__summary-value">
              {formatNumber(vmOverrides.overrideCount)}
            </span>
          </Tile>
        </Column>
        <Column lg={4} md={2} sm={2}>
          <Tile className="vm-management-tab__summary-tile vm-management-tab__summary-tile--actions">
            <Button size="sm" kind="ghost" renderIcon={Download} onClick={handleExportSettings}>
              Export Settings
            </Button>
            <Button size="sm" kind="ghost" renderIcon={Upload} onClick={() => setShowImportModal(true)}>
              Import Settings
            </Button>
          </Tile>
        </Column>
      </Grid>

      {/* Data Table */}
      <DataTable
        rows={paginatedRows}
        headers={headers}
        isSortable
      >
        {({
          rows,
          headers,
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
            <TableContainer {...getTableContainerProps()}>
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
                </TableBatchActions>
                <TableToolbarContent>
                  <TableToolbarSearch
                    placeholder="Search VMs..."
                    onChange={(e) => {
                      const value = typeof e === 'string' ? e : e.target.value;
                      setSearchTerm(value);
                      setPage(1);
                    }}
                    value={searchTerm}
                    persistent
                  />
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={DocumentExport}
                    onClick={handleExportCSV}
                    hasIconOnly
                    iconDescription="Export to CSV"
                  />
                  {vmOverrides.overrideCount > 0 && (
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={Reset}
                      onClick={vmOverrides.clearAllOverrides}
                      hasIconOnly
                      iconDescription="Clear all overrides"
                    />
                  )}
                </TableToolbarContent>
              </TableToolbar>

              <Table {...getTableProps()} size="md">
                <TableHead>
                  <TableRow>
                    <TableSelectAll {...getSelectionProps()} />
                    {headers.map((header) => (
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

                    return (
                      <TableRow
                        {...getRowProps({ row })}
                        key={row.id}
                        className={originalRow.isExcluded ? 'vm-management-tab__row--excluded' : ''}
                      >
                        <TableSelectRow {...getSelectionProps({ row })} />
                        <TableCell>{originalRow.vmName}</TableCell>
                        <TableCell>{originalRow.cluster}</TableCell>
                        <TableCell>{originalRow.cpus}</TableCell>
                        <TableCell>{originalRow.memoryGiB} GiB</TableCell>
                        <TableCell>{originalRow.storageGiB} GiB</TableCell>
                        <TableCell>
                          {vmOverrides.getWorkloadType(originalRow.id) ? (
                            <Tooltip label="Workload type override">
                              <Tag type="blue" size="sm">
                                {originalRow.effectiveWorkload}
                              </Tag>
                            </Tooltip>
                          ) : originalRow.detectedWorkload ? (
                            <Tag type="gray" size="sm">
                              {originalRow.effectiveWorkload}
                            </Tag>
                          ) : (
                            <span className="vm-management-tab__unclassified">
                              Unclassified
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {originalRow.isExcluded ? (
                            <Tag type="gray" size="sm">Excluded</Tag>
                          ) : (
                            <Tag type="green" size="sm">Included</Tag>
                          )}
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
                              itemText={originalRow.isExcluded ? 'Include in Migration' : 'Exclude from Migration'}
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
      <div className="vm-management-tab__pagination">
        <div className="vm-management-tab__pagination-info">
          <Tag type="gray" size="sm">
            {formatNumber(filteredRows.length)} VMs
          </Tag>
          {searchTerm && (
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

      {/* Edit Notes Modal */}
      <Modal
        open={!!editingNotes}
        onRequestClose={() => setEditingNotes(null)}
        onRequestSubmit={handleSaveNotes}
        modalHeading={`Notes for ${editingNotes?.vmName || ''}`}
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
        size="sm"
      >
        <TextArea
          id="vm-notes"
          labelText="Notes"
          placeholder="Add notes about this VM..."
          value={editingNotes?.notes || ''}
          onChange={(e) => setEditingNotes(prev => prev ? { ...prev, notes: e.target.value } : null)}
          rows={4}
        />
      </Modal>

      {/* Edit Workload Modal */}
      <Modal
        open={!!editingWorkload}
        onRequestClose={() => setEditingWorkload(null)}
        modalHeading={`Workload Type for ${editingWorkload?.vmName || ''}`}
        passiveModal
        size="sm"
      >
        <p className="vm-management-tab__modal-description">
          Select a predefined workload type, type a custom name, or choose "Unclassified" to clear.
        </p>
        <ComboBox
          id="workload-type"
          key={editingWorkload?.vmId || 'workload-combobox'}
          titleText="Workload Type"
          placeholder="Select or type custom workload..."
          items={workloadCategories}
          itemToString={(item) => (typeof item === 'string' ? item : item?.text) || ''}
          initialSelectedItem={
            editingWorkload?.current
              ? workloadCategories.find(c => c.text === editingWorkload.current) || { id: 'custom', text: editingWorkload.current }
              : null
          }
          allowCustomValue
          onChange={({ selectedItem, inputValue }) => {
            // Handle custom typed value or selected item
            if (inputValue && !selectedItem) {
              // User typed a custom value and pressed enter or blurred
              handleSaveWorkload({ id: 'custom', text: inputValue });
            } else {
              handleSaveWorkload(selectedItem);
            }
          }}
        />
      </Modal>

      {/* Import Settings Modal */}
      <Modal
        open={showImportModal}
        onRequestClose={() => {
          setShowImportModal(false);
          setImportJson('');
          setImportError(null);
        }}
        onRequestSubmit={handleImportSettings}
        modalHeading="Import VM Overrides"
        primaryButtonText="Import"
        secondaryButtonText="Cancel"
        size="md"
      >
        <p className="vm-management-tab__modal-description">
          Paste the JSON from a previously exported settings file.
        </p>
        <TextArea
          id="import-json"
          labelText="Settings JSON"
          placeholder='{"version":1,"overrides":{}...}'
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          rows={10}
          invalid={!!importError}
          invalidText={importError || ''}
        />
      </Modal>
    </div>
  );
}

export default VMManagementTab;
