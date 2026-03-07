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
  bulkWorkloadVMs: Array<{ vmId: string; vmName: string }> | null;
  setBulkWorkloadVMs: React.Dispatch<React.SetStateAction<Array<{ vmId: string; vmName: string }> | null>>;
  bulkNotesVMs: Array<{ vmId: string; vmName: string }> | null;
  setBulkNotesVMs: React.Dispatch<React.SetStateAction<Array<{ vmId: string; vmName: string }> | null>>;
  bulkNotesText: string;
  setBulkNotesText: React.Dispatch<React.SetStateAction<string>>;
  showImportModal: boolean;
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>;
  importJson: string;
  setImportJson: React.Dispatch<React.SetStateAction<string>>;
  importError: string | null;
  setImportError: React.Dispatch<React.SetStateAction<string | null>>;

  // Action handlers
  handleBulkExclude: (selectedRows: Array<{ id: string }>) => void;
  handleBulkInclude: (selectedRows: Array<{ id: string }>) => void;
  handleBulkEditWorkload: (selectedRows: Array<{ id: string }>) => void;
  handleBulkSaveWorkload: (item: { id: string; text: string } | string | null | undefined) => void;
  handleBulkEditNotes: (selectedRows: Array<{ id: string }>) => void;
  handleBulkSaveNotes: () => void;
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
  // Destructure for stable deps — each handler only depends on the methods it uses
  const {
    bulkSetExcluded, bulkSetForceIncluded, bulkSetWorkloadType, bulkSetNotes,
    setForceIncluded, setExcluded, setNotes, setWorkloadType,
    getWorkloadType, exportSettings: doExportSettings, importSettings: doImportSettings,
  } = vmOverrides;

  const [editingNotes, setEditingNotes] = useState<EditingNotes | null>(null);
  const [editingWorkload, setEditingWorkload] = useState<EditingWorkload | null>(null);
  const [bulkWorkloadVMs, setBulkWorkloadVMs] = useState<Array<{ vmId: string; vmName: string }> | null>(null);
  const [bulkNotesVMs, setBulkNotesVMs] = useState<Array<{ vmId: string; vmName: string }> | null>(null);
  const [bulkNotesText, setBulkNotesText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const handleBulkExclude = useCallback((selectedRows: Array<{ id: string }>) => {
    const toExclude = selectedRows.map(row => {
      const vmRow = vmRows.find(r => r.id === row.id);
      return { vmId: row.id, vmName: vmRow?.vmName || '' };
    });
    bulkSetExcluded(toExclude, true);
  }, [vmRows, bulkSetExcluded]);

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
      bulkSetForceIncluded(autoExcludedVMs, true);
    }
    if (manuallyExcludedVMs.length > 0) {
      bulkSetExcluded(manuallyExcludedVMs, false);
    }
  }, [vmRows, bulkSetForceIncluded, bulkSetExcluded]);

  const handleBulkEditWorkload = useCallback((selectedRows: Array<{ id: string }>) => {
    const vms = selectedRows.map(row => {
      const vmRow = vmRows.find(r => r.id === row.id);
      return { vmId: row.id, vmName: vmRow?.vmName || '' };
    });
    setBulkWorkloadVMs(vms);
  }, [vmRows]);

  const handleBulkSaveWorkload = useCallback((item: { id: string; text: string } | string | null | undefined) => {
    if (bulkWorkloadVMs) {
      const text = typeof item === 'string' ? item : item?.text;
      const id = typeof item === 'string' ? 'custom' : item?.id;

      if (text && id !== 'unclassified') {
        bulkSetWorkloadType(bulkWorkloadVMs, text);
      } else {
        bulkSetWorkloadType(bulkWorkloadVMs, undefined);
      }
      setBulkWorkloadVMs(null);
    }
  }, [bulkWorkloadVMs, bulkSetWorkloadType]);

  const handleBulkEditNotes = useCallback((selectedRows: Array<{ id: string }>) => {
    const vms = selectedRows.map(row => {
      const vmRow = vmRows.find(r => r.id === row.id);
      return { vmId: row.id, vmName: vmRow?.vmName || '' };
    });
    setBulkNotesVMs(vms);
    setBulkNotesText('');
  }, [vmRows]);

  const handleBulkSaveNotes = useCallback(() => {
    if (bulkNotesVMs) {
      bulkSetNotes(bulkNotesVMs, bulkNotesText || undefined);
      setBulkNotesVMs(null);
    }
  }, [bulkNotesVMs, bulkNotesText, bulkSetNotes]);

  const handleToggleExclusion = useCallback((row: VMRow) => {
    if (row.isAutoExcluded && !row.isForceIncluded) {
      setForceIncluded(row.id, row.vmName, true);
    } else if (row.isForceIncluded) {
      setForceIncluded(row.id, row.vmName, false);
    } else if (row.isManuallyExcluded) {
      setExcluded(row.id, row.vmName, false);
    } else {
      setExcluded(row.id, row.vmName, true);
    }
  }, [setForceIncluded, setExcluded]);

  const handleEditNotes = useCallback((row: VMRow) => {
    setEditingNotes({ vmId: row.id, vmName: row.vmName, notes: row.notes });
  }, []);

  const handleSaveNotes = useCallback(() => {
    if (editingNotes) {
      setNotes(editingNotes.vmId, editingNotes.vmName, editingNotes.notes || undefined);
      setEditingNotes(null);
    }
  }, [editingNotes, setNotes]);

  const handleEditWorkload = useCallback((row: VMRow) => {
    setEditingWorkload({
      vmId: row.id,
      vmName: row.vmName,
      current: getWorkloadType(row.id) || (row.categorySource !== 'none' ? row.categoryName : undefined),
    });
  }, [getWorkloadType]);

  const handleSaveWorkload = useCallback((item: { id: string; text: string } | string | null | undefined) => {
    if (editingWorkload) {
      const text = typeof item === 'string' ? item : item?.text;
      const id = typeof item === 'string' ? 'custom' : item?.id;

      if (text && id !== 'unclassified') {
        setWorkloadType(editingWorkload.vmId, editingWorkload.vmName, text);
      } else {
        setWorkloadType(editingWorkload.vmId, editingWorkload.vmName, undefined);
      }
      setEditingWorkload(null);
    }
  }, [editingWorkload, setWorkloadType]);

  const handleExportSettings = useCallback(() => {
    const json = doExportSettings();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vm-overrides.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [doExportSettings]);

  const handleImportSettings = useCallback(() => {
    setImportError(null);
    if (!importJson.trim()) {
      setImportError('Please paste valid JSON');
      return;
    }
    const success = doImportSettings(importJson);
    if (success) {
      setShowImportModal(false);
      setImportJson('');
    } else {
      setImportError('Invalid JSON format');
    }
  }, [importJson, doImportSettings]);

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
  };
}
