/**
 * DiscoveryVMModals Component
 *
 * Renders the three modals used in DiscoveryVMTable:
 * - Edit Notes modal
 * - Edit Workload Type modal (ComboBox with custom values)
 * - Import Settings modal (JSON paste)
 */

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
  showImportModal: boolean;
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>;
  importJson: string;
  setImportJson: React.Dispatch<React.SetStateAction<string>>;
  importError: string | null;
  setImportError: React.Dispatch<React.SetStateAction<string | null>>;
  handleImportSettings: () => void;
}

export function DiscoveryVMModals({
  editingNotes,
  setEditingNotes,
  handleSaveNotes,
  editingWorkload,
  setEditingWorkload,
  handleSaveWorkload,
  workloadCategories,
  showImportModal,
  setShowImportModal,
  importJson,
  setImportJson,
  importError,
  setImportError,
  handleImportSettings,
}: DiscoveryVMModalsProps) {
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
        modalHeading={`Workload Type for ${editingWorkload?.vmName || ''}`}
        passiveModal
        size="sm"
      >
        <p className="discovery-vm-table__modal-description">
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
            if (inputValue && !selectedItem) {
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
}

export default DiscoveryVMModals;
