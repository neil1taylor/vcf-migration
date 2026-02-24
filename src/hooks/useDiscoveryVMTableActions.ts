/**
 * useDiscoveryVMTableActions Hook
 *
 * Extracts callback handlers and modal state management from DiscoveryVMTable.
 * Handles: bulk exclude/include, toggle exclusion, notes editing, workload editing,
 * export/import settings, and CSV export.
 */

import { useState, useCallback } from 'react';
import type { UseVMOverridesReturn } from '@/hooks/useVMOverrides';
import type { VMRow } from '@/components/discovery/DiscoveryVMTableTypes';

// ===== MODAL STATE TYPES =====

export interface EditingNotes {
  vmId: string;
  vmName: string;
  notes: string;
}

export interface EditingWorkload {
  vmId: string;
  vmName: string;
  current: string | undefined;
}

// ===== HOOK RETURN TYPE =====

export interface UseDiscoveryVMTableActionsReturn {
  // Modal state
  editingNotes: EditingNotes | null;
  setEditingNotes: React.Dispatch<React.SetStateAction<EditingNotes | null>>;
  editingWorkload: EditingWorkload | null;
  setEditingWorkload: React.Dispatch<React.SetStateAction<EditingWorkload | null>>;
  showImportModal: boolean;
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>;
  importJson: string;
  setImportJson: React.Dispatch<React.SetStateAction<string>>;
  importError: string | null;
  setImportError: React.Dispatch<React.SetStateAction<string | null>>;

  // Action handlers
  handleBulkExclude: (selectedRows: Array<{ id: string }>) => void;
  handleBulkInclude: (selectedRows: Array<{ id: string }>) => void;
  handleToggleExclusion: (row: VMRow) => void;
  handleEditNotes: (row: VMRow) => void;
  handleSaveNotes: () => void;
  handleEditWorkload: (row: VMRow) => void;
  handleSaveWorkload: (item: { id: string; text: string } | string | null | undefined) => void;
  handleExportSettings: () => void;
  handleImportSettings: () => void;
  handleExportCSV: (filteredRows: VMRow[]) => void;
}

// ===== HOOK =====

export function useDiscoveryVMTableActions(
  vmRows: VMRow[],
  vmOverrides: UseVMOverridesReturn,
): UseDiscoveryVMTableActionsReturn {
  const [editingNotes, setEditingNotes] = useState<EditingNotes | null>(null);
  const [editingWorkload, setEditingWorkload] = useState<EditingWorkload | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

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
    const autoExcludedVMs = toInclude.filter(vm => {
      const vmRow = vmRows.find(r => r.id === vm.vmId);
      return vmRow?.isAutoExcluded;
    });
    const manuallyExcludedVMs = toInclude.filter(vm => {
      const vmRow = vmRows.find(r => r.id === vm.vmId);
      return !vmRow?.isAutoExcluded;
    });
    if (autoExcludedVMs.length > 0) {
      vmOverrides.bulkSetForceIncluded(autoExcludedVMs, true);
    }
    if (manuallyExcludedVMs.length > 0) {
      vmOverrides.bulkSetExcluded(manuallyExcludedVMs, false);
    }
  }, [vmRows, vmOverrides]);

  const handleToggleExclusion = useCallback((row: VMRow) => {
    if (row.isAutoExcluded && !row.isForceIncluded) {
      vmOverrides.setForceIncluded(row.id, row.vmName, true);
    } else if (row.isForceIncluded) {
      vmOverrides.setForceIncluded(row.id, row.vmName, false);
    } else if (row.isManuallyExcluded) {
      vmOverrides.setExcluded(row.id, row.vmName, false);
    } else {
      vmOverrides.setExcluded(row.id, row.vmName, true);
    }
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
      current: vmOverrides.getWorkloadType(row.id) || (row.categorySource !== 'none' ? row.categoryName : undefined),
    });
  }, [vmOverrides]);

  const handleSaveWorkload = useCallback((item: { id: string; text: string } | string | null | undefined) => {
    if (editingWorkload) {
      const text = typeof item === 'string' ? item : item?.text;
      const id = typeof item === 'string' ? 'custom' : item?.id;

      if (text && id !== 'unclassified') {
        vmOverrides.setWorkloadType(editingWorkload.vmId, editingWorkload.vmName, text);
      } else {
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

  const handleExportCSV = useCallback((filteredRows: VMRow[]) => {
    const headers = ['VM Name', 'Cluster', 'Power State', 'vCPUs', 'Memory (GiB)', 'Storage (GiB)', 'Guest OS', 'Workload Type', 'Source', 'Status', 'Auto-Exclusion Reasons', 'Notes'];
    const rows = filteredRows.map(row => [
      row.vmName,
      row.cluster,
      row.powerState,
      row.cpus.toString(),
      row.memoryGiB.toString(),
      row.storageGiB.toString(),
      row.guestOS,
      row.categoryName,
      row.categorySource === 'user' ? 'User Override'
        : row.categorySource === 'maintainer' ? 'Maintainer'
        : row.categorySource === 'ai' ? 'AI'
        : row.categorySource === 'name' ? 'VM Name'
        : row.categorySource === 'annotation' ? 'Annotation'
        : '',
      row.isEffectivelyExcluded ? (row.exclusionSource === 'auto' ? 'Auto-Excluded' : 'Excluded') : (row.isForceIncluded ? 'Included (Override)' : 'Included'),
      row.autoExclusionLabels.join('; '),
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
    a.download = 'vm-discovery.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    editingNotes,
    setEditingNotes,
    editingWorkload,
    setEditingWorkload,
    showImportModal,
    setShowImportModal,
    importJson,
    setImportJson,
    importError,
    setImportError,
    handleBulkExclude,
    handleBulkInclude,
    handleToggleExclusion,
    handleEditNotes,
    handleSaveNotes,
    handleEditWorkload,
    handleSaveWorkload,
    handleExportSettings,
    handleImportSettings,
    handleExportCSV,
  };
}
