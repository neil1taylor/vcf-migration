// Risk Domain Assessment Card
import { Tile, Tag, Dropdown, TextArea, NumberInput, UnorderedList, ListItem } from '@carbon/react';
import type { RiskDomainAssessment, RiskDomainId, RiskSeverity } from '@/types/riskAssessment';
import { RISK_SEVERITY_COLORS } from '@/types/riskAssessment';
import './RiskDomainCard.scss';

interface RiskDomainCardProps {
  domain: RiskDomainAssessment;
  onOverrideSeverity: (domainId: RiskDomainId, severity: RiskSeverity | null) => void;
  onNotesChange: (domainId: RiskDomainId, notes: string) => void;
  currentMonthlyCost?: number | null;
  onCurrentMonthlyCostChange?: (cost: number | null) => void;
}

const AUTO_SEVERITY_OPTIONS = [
  { id: 'auto', text: 'Auto-detect' },
  { id: 'low', text: 'Low' },
  { id: 'medium', text: 'Medium' },
  { id: 'high', text: 'High' },
  { id: 'critical', text: 'Critical' },
];

const MANUAL_SEVERITY_OPTIONS = [
  { id: 'not-assessed', text: 'Not assessed' },
  { id: 'low', text: 'Low' },
  { id: 'medium', text: 'Medium' },
  { id: 'high', text: 'High' },
  { id: 'critical', text: 'Critical' },
];

type DropdownItem = { id: string; text: string };

const TAG_TYPE_MAP: Record<RiskSeverity, 'green' | 'gray' | 'warm-gray' | 'red'> = {
  low: 'green',
  medium: 'warm-gray',
  high: 'warm-gray',
  critical: 'red',
};

export function RiskDomainCard({ domain, onOverrideSeverity, onNotesChange, currentMonthlyCost, onCurrentMonthlyCostChange }: RiskDomainCardProps) {
  const isManual = domain.mode === 'manual';
  const options = isManual ? MANUAL_SEVERITY_OPTIONS : AUTO_SEVERITY_OPTIONS;
  const defaultOptionId = isManual ? 'not-assessed' : 'auto';

  const selectedItem = domain.overrideSeverity
    ? options.find(o => o.id === domain.overrideSeverity)
    : options.find(o => o.id === defaultOptionId);

  return (
    <Tile className="risk-domain-card">
      <div className="risk-domain-card__header">
        <h4 className="risk-domain-card__title">{domain.label}</h4>
        <Tag
          type={TAG_TYPE_MAP[domain.effectiveSeverity]}
          size="md"
          style={{
            backgroundColor: RISK_SEVERITY_COLORS[domain.effectiveSeverity],
            color: domain.effectiveSeverity === 'medium' ? 'var(--cds-text-primary)' : 'var(--cds-text-on-color)',
          }}
        >
          {domain.effectiveSeverity.toUpperCase()}
        </Tag>
      </div>

      <div className="risk-domain-card__mode">
        {domain.mode === 'auto' && domain.autoSeverity && (
          <span className="risk-domain-card__auto-label">
            Auto-detected: {domain.autoSeverity}
          </span>
        )}
        {domain.mode === 'manual' && !domain.overrideSeverity && (
          <span className="risk-domain-card__manual-label">
            Manual assessment required
          </span>
        )}
      </div>

      {domain.domainId === 'cost' && onCurrentMonthlyCostChange && (
        <NumberInput
          id="risk-current-monthly-cost"
          label="Current monthly cost ($)"
          helperText="Enter your current VMware monthly spend for comparison"
          min={0}
          step={100}
          value={currentMonthlyCost ?? ''}
          onChange={(_e: unknown, { value }: { value: string | number }) => {
            const num = typeof value === 'string' ? parseFloat(value) : value;
            onCurrentMonthlyCostChange(isNaN(num) ? null : num);
          }}
          allowEmpty
          size="sm"
        />
      )}

      <Dropdown
        id={`risk-override-${domain.domainId}`}
        titleText="Override severity"
        label="Select severity"
        items={options}
        itemToString={(item: DropdownItem | null) => item?.text ?? ''}
        selectedItem={selectedItem}
        onChange={({ selectedItem: item }: { selectedItem: DropdownItem | null }) => {
          if (!item || item.id === 'auto' || item.id === 'not-assessed') {
            onOverrideSeverity(domain.domainId, null);
          } else {
            onOverrideSeverity(domain.domainId, item.id as RiskSeverity);
          }
        }}
        size="sm"
      />

      {domain.evidence.length > 0 && (
        <div className="risk-domain-card__evidence">
          <h5 className="risk-domain-card__evidence-title">Evidence</h5>
          <UnorderedList>
            {domain.evidence.map((e, i) => (
              <ListItem key={i}>
                <strong>{e.label}:</strong> {e.detail}
              </ListItem>
            ))}
          </UnorderedList>
        </div>
      )}

      <TextArea
        id={`risk-notes-${domain.domainId}`}
        labelText="Notes"
        placeholder="Add assessment notes..."
        value={domain.notes}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNotesChange(domain.domainId, e.target.value)}
        rows={3}
      />
    </Tile>
  );
}
