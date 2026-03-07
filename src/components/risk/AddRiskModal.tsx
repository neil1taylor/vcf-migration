import { useState } from 'react';
import {
  Modal,
  TextInput,
  TextArea,
  Dropdown,
} from '@carbon/react';
import type { RiskCategory, RiskStatus, RiskRow } from '@/types/riskAssessment';
import { RISK_CATEGORIES } from '@/types/riskAssessment';

interface AddRiskModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (row: Omit<RiskRow, 'id' | 'source'>) => void;
}

const STATUS_OPTIONS: { id: RiskStatus; text: string }[] = [
  { id: 'red', text: 'Red' },
  { id: 'amber', text: 'Amber' },
  { id: 'green', text: 'Green' },
];

const CATEGORY_OPTIONS = RISK_CATEGORIES.map(c => ({ id: c, text: c }));

export function AddRiskModal({ open, onClose, onAdd }: AddRiskModalProps) {
  const [category, setCategory] = useState<RiskCategory>('Technical');
  const [description, setDescription] = useState('');
  const [impactArea, setImpactArea] = useState('');
  const [status, setStatus] = useState<RiskStatus>('amber');
  const [mitigationPlan, setMitigationPlan] = useState('');

  const handleSubmit = () => {
    if (!description.trim()) return;
    onAdd({
      category,
      description: description.trim(),
      impactArea: impactArea.trim(),
      status,
      mitigationPlan: mitigationPlan.trim(),
      evidenceDetail: '',
    });
    // Reset form
    setCategory('Technical');
    setDescription('');
    setImpactArea('');
    setStatus('amber');
    setMitigationPlan('');
    onClose();
  };

  return (
    <Modal
      open={open}
      modalHeading="Add Custom Risk"
      primaryButtonText="Add Risk"
      secondaryButtonText="Cancel"
      onRequestSubmit={handleSubmit}
      onRequestClose={onClose}
      primaryButtonDisabled={!description.trim()}
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Dropdown
          id="risk-category"
          titleText="Category"
          label="Select category"
          items={CATEGORY_OPTIONS}
          selectedItem={CATEGORY_OPTIONS.find(o => o.id === category)}
          onChange={({ selectedItem }: { selectedItem: { id: RiskCategory; text: string } | null }) => {
            if (selectedItem) setCategory(selectedItem.id);
          }}
        />
        <TextArea
          id="risk-description"
          labelText="Risk Description"
          placeholder="Describe the risk..."
          value={description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          rows={3}
        />
        <TextInput
          id="risk-impact"
          labelText="Impact Area"
          placeholder="e.g., Budget, Schedule, Security"
          value={impactArea}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImpactArea(e.target.value)}
        />
        <Dropdown
          id="risk-status"
          titleText="Status"
          label="Select status"
          items={STATUS_OPTIONS}
          selectedItem={STATUS_OPTIONS.find(o => o.id === status)}
          onChange={({ selectedItem }: { selectedItem: { id: RiskStatus; text: string } | null }) => {
            if (selectedItem) setStatus(selectedItem.id);
          }}
        />
        <TextArea
          id="risk-mitigation"
          labelText="Mitigation Plan"
          placeholder="What steps will mitigate this risk?"
          value={mitigationPlan}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMitigationPlan(e.target.value)}
          rows={3}
        />
      </div>
    </Modal>
  );
}
