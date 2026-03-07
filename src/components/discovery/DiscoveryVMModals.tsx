/**
 * DiscoveryVMModals Component
 *
 * Renders the three modals used in DiscoveryVMTable:
 * - Edit Notes modal
 * - Edit Workload Type modal (ComboBox with custom values)
 * - Import Settings modal (JSON paste)
 */

import { useState, useRef, memo } from 'react';
import {
  Modal,
  TextArea,
  ComboBox,
} from '@carbon/react';

interface EditingNotes {
  vmId: string;
  vmName: string;
  notes: string;
}

interface EditingWorkload {
  vmId: string;
  vmName: string;
  current: string | undefined;
}

interface DiscoveryVMModalsProps {
  editingNotes: EditingNotes | null;
  setEditingNotes: React.Dispatch<React.SetStateAction<EditingNotes | null>>;
  handleSaveNotes: () => void;
  editingWorkload: EditingWorkload | null;
  setEditingWorkload: React.Dispatch<React.SetStateAction<EditingWorkload | null>>;
  handleSaveWorkload: (item: { id: string; text: string } | string | null | undefined) => void;
  workloadCategories: Array<{ id: string; text: string }>;
  bulkWorkloadVMs: Array<{ vmId: string; vmName: string }> | null;
  setBulkWorkloadVMs: React.Dispatch<React.SetStateAction<Array<{ vmId: string; vmName: string }> | null>>;
  handleBulkSaveWorkload: (item: { id: string; text: string } | string | null | undefined) => void;
  bulkNotesVMs: Array<{ vmId: string; vmName: string }> | null;
  setBulkNotesVMs: React.Dispatch<React.SetStateAction<Array<{ vmId: string; vmName: string }> | null>>;
  bulkNotesText: string;
  setBulkNotesText: React.Dispatch<React.SetStateAction<string>>;
  handleBulkSaveNotes: () => void;
  showImportModal: boolean;
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>;
  importJson: string;
  setImportJson: React.Dispatch<React.SetStateAction<string>>;
  importError: string | null;
  setImportError: React.Dispatch<React.SetStateAction<string | null>>;
  handleImportSettings: () => void;
}

export const DiscoveryVMModals = memo(function DiscoveryVMModals({
  editingNotes,
  setEditingNotes,
  handleSaveNotes,
  editingWorkload,
  setEditingWorkload,
  handleSaveWorkload,
  workloadCategories,
  bulkWorkloadVMs,
  setBulkWorkloadVMs,
  handleBulkSaveWorkload,
  bulkNotesVMs,
  setBulkNotesVMs,
  bulkNotesText,
  setBulkNotesText,
  handleBulkSaveNotes,
  showImportModal,
  setShowImportModal,
  importJson,
  setImportJson,
  importError,
  setImportError,
  handleImportSettings,
}: DiscoveryVMModalsProps) {
  // Local state for workload selection (single VM)
  const [pendingWorkload, setPendingWorkload] = useState<{ id: string; text: string } | null>(null);

  // Local state for bulk workload selection
  const [pendingBulkWorkload, setPendingBulkWorkload] = useState<{ id: string; text: string } | null>(null);

  // Ref-based initialization: only reset state when modal opens for a different VM
  const prevWorkloadVmId = useRef<string | null>(null);
  if (editingWorkload && editingWorkload.vmId !== prevWorkloadVmId.current) {
    prevWorkloadVmId.current = editingWorkload.vmId;
    setPendingWorkload(
      editingWorkload.current
        ? workloadCategories.find(c => c.text === editingWorkload.current) || { id: 'custom', text: editingWorkload.current }
        : null
    );
  } else if (!editingWorkload) {
    prevWorkloadVmId.current = null;
  }

  const prevBulkWorkloadRef = useRef<boolean>(false);
  const bulkOpen = !!bulkWorkloadVMs;
  if (bulkOpen && !prevBulkWorkloadRef.current) {
    prevBulkWorkloadRef.current = true;
    setPendingBulkWorkload(null);
  } else if (!bulkOpen) {
    prevBulkWorkloadRef.current = false;
  }

  return (
    <>
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
        onRequestSubmit={() => {
          handleSaveWorkload(pendingWorkload);
          setEditingWorkload(null);
        }}
        modalHeading={`Workload Type for ${editingWorkload?.vmName || ''}`}
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
        size="md"
        className="discovery-vm-table__workload-modal"
      >
        <div>
          <p className="discovery-vm-table__modal-description">
            Select a predefined workload type, type a custom name, or choose &quot;Unclassified&quot; to clear.
          </p>
          <ComboBox
            id="workload-type"
            titleText="Workload Type"
            placeholder="Select or type custom workload..."
            items={workloadCategories}
            itemToString={(item: { id: string; text: string } | string | null) => (typeof item === 'string' ? item : item?.text) || ''}
            selectedItem={pendingWorkload}
            allowCustomValue
            onChange={({ selectedItem, inputValue }: { selectedItem: { id: string; text: string } | null; inputValue?: string }) => {
              if (inputValue && !selectedItem) {
                setPendingWorkload({ id: 'custom', text: inputValue });
              } else if (selectedItem) {
                setPendingWorkload(selectedItem);
              } else {
                setPendingWorkload(null);
              }
            }}
          />
        </div>
      </Modal>

      {/* Bulk Edit Workload Modal */}
      <Modal
        open={!!bulkWorkloadVMs}
        onRequestClose={() => setBulkWorkloadVMs(null)}
        onRequestSubmit={() => {
          handleBulkSaveWorkload(pendingBulkWorkload);
        }}
        modalHeading={`Change Workload Type for ${bulkWorkloadVMs?.length || 0} VMs`}
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
        size="md"
        className="discovery-vm-table__workload-modal"
      >
        <div>
          <p className="discovery-vm-table__modal-description">
            Select a workload type to apply to all {bulkWorkloadVMs?.length || 0} selected VMs,
            or choose &quot;Unclassified&quot; to clear.
          </p>
          <ComboBox
            id="bulk-workload-type"
            titleText="Workload Type"
            placeholder="Select or type custom workload..."
            items={workloadCategories}
            itemToString={(item: { id: string; text: string } | string | null) => (typeof item === 'string' ? item : item?.text) || ''}
            selectedItem={pendingBulkWorkload}
            allowCustomValue
            onChange={({ selectedItem, inputValue }: { selectedItem: { id: string; text: string } | null; inputValue?: string }) => {
              if (inputValue && !selectedItem) {
                setPendingBulkWorkload({ id: 'custom', text: inputValue });
              } else if (selectedItem) {
                setPendingBulkWorkload(selectedItem);
              } else {
                setPendingBulkWorkload(null);
              }
            }}
          />
        </div>
      </Modal>

      {/* Bulk Edit Notes Modal */}
      <Modal
        open={!!bulkNotesVMs}
        onRequestClose={() => setBulkNotesVMs(null)}
        onRequestSubmit={handleBulkSaveNotes}
        modalHeading={`Add Notes for ${bulkNotesVMs?.length || 0} VMs`}
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
        size="sm"
      >
        <p className="discovery-vm-table__modal-description">
          This note will be applied to all {bulkNotesVMs?.length || 0} selected VMs.
          Leave empty to clear existing notes.
        </p>
        <TextArea
          id="bulk-vm-notes"
          labelText="Notes"
          placeholder="Add notes for selected VMs..."
          value={bulkNotesText}
          onChange={(e) => setBulkNotesText(e.target.value)}
          rows={4}
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
        <p className="discovery-vm-table__modal-description">
          Paste the JSON from a previously exported settings file.
        </p>
        <TextArea
          id="import-json"
          labelText="Settings JSON"
          placeholder='{"version":2,"overrides":{}...}'
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          rows={10}
          invalid={!!importError}
          invalidText={importError || ''}
        />
      </Modal>
    </>
  );
});

export default DiscoveryVMModals;
