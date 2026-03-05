// Risk Domain Assessment Card
import { Tile, Tag, Dropdown, TextArea, UnorderedList, ListItem } from '@carbon/react';
import type { RiskDomainAssessment, RiskDomainId, RiskSeverity } from '@/types/riskAssessment';
import { RISK_SEVERITY_COLORS } from '@/types/riskAssessment';
import './RiskDomainCard.scss';

interface RiskDomainCardProps {
  domain: RiskDomainAssessment;
  onOverrideSeverity: (domainId: RiskDomainId, severity: RiskSeverity | null) => void;
  onNotesChange: (domainId: RiskDomainId, notes: string) => void;
}

const SEVERITY_OPTIONS = [
  { id: 'auto', text: 'Auto-detect' },
  { id: 'low', text: 'Low' },
  { id: 'medium', text: 'Medium' },
  { id: 'high', text: 'High' },
  { id: 'critical', text: 'Critical' },
];

const TAG_TYPE_MAP: Record<RiskSeverity, 'green' | 'gray' | 'warm-gray' | 'red'> = {
  low: 'green',
  medium: 'warm-gray',
  high: 'warm-gray',
  critical: 'red',
};

export function RiskDomainCard({ domain, onOverrideSeverity, onNotesChange }: RiskDomainCardProps) {
  const selectedItem = domain.overrideSeverity
    ? SEVERITY_OPTIONS.find(o => o.id === domain.overrideSeverity)
    : SEVERITY_OPTIONS[0];

  return (
    <Tile className="risk-domain-card">
      <div className="risk-domain-card__header">
        <h4 className="risk-domain-card__title">{domain.label}</h4>
        <Tag
          type={TAG_TYPE_MAP[domain.effectiveSeverity]}
          size="md"
          style={{
            backgroundColor: RISK_SEVERITY_COLORS[domain.effectiveSeverity],
            color: domain.effectiveSeverity === 'medium' ? '#161616' : '#fff',
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

      <Dropdown
        id={`risk-override-${domain.domainId}`}
        titleText="Override severity"
        label="Select severity"
        items={SEVERITY_OPTIONS}
        itemToString={(item: (typeof SEVERITY_OPTIONS)[number] | null) => item?.text ?? ''}
        selectedItem={selectedItem}
        onChange={({ selectedItem: item }: { selectedItem: (typeof SEVERITY_OPTIONS)[number] | null }) => {
          if (!item || item.id === 'auto') {
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
