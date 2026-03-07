import { Grid, Column, Tile, Dropdown, Button } from '@carbon/react';
import { Reset } from '@carbon/icons-react';
import type { FactorAnswer, PlatformSelectionScore } from '@/hooks/usePlatformSelection';
import { formatCurrency } from '@/services/costEstimation';
import factorsData from '@/data/platformSelectionFactors.json';

interface PlatformSelectionPanelProps {
  answers: Record<string, FactorAnswer>;
  onAnswer: (factorId: string, answer: FactorAnswer | null) => void;
  onReset: () => void;
  score: PlatformSelectionScore;
  roksMonthlyCost?: number | null;
  rovMonthlyCost?: number | null;
  vsiMonthlyCost?: number | null;
  totalVMCount: number;
}

const ANSWER_ITEMS = [
  { id: 'yes', text: 'Yes' },
  { id: 'no', text: 'No' },
  { id: 'no-preference', text: 'No Preference' },
  { id: 'not-sure', text: 'Not Sure' },
];

const vsiFactors = factorsData.factors.filter(f => f.target === 'vsi');
const roksFactors = factorsData.factors.filter(f => f.target === 'roks');
const dynamicFactors = factorsData.factors.filter(f => f.target === 'dynamic');

export function PlatformSelectionPanel({ answers, onAnswer, onReset, score, roksMonthlyCost, rovMonthlyCost, vsiMonthlyCost, totalVMCount }: PlatformSelectionPanelProps) {
  const leaningText =
    score.leaning === 'vsi' ? 'VPC VSI' :
    score.leaning === 'roks' ? 'ROKS (OpenShift Virtualization)' :
    'Neutral';

  const hasAnswers = score.answeredCount > 0;
  const hasCosts = roksMonthlyCost != null || vsiMonthlyCost != null;

  const costLeaningLabel =
    score.costLeaning === 'vsi' ? 'VSI (cheaper)' :
    score.costLeaning === 'roks' ? 'ROKS (cheaper)' :
    null;

  return (
    <div style={{ paddingTop: '1rem' }}>
      {/* Cost tiles */}
      <Grid narrow>
        <Column lg={5} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile style={{ borderLeft: '4px solid #009d9a', height: '100%' }}>
            <h5>All ROKS</h5>
            <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {roksMonthlyCost != null ? `${formatCurrency(roksMonthlyCost)}/mo` : 'Not configured'}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#525252' }}>
              All {totalVMCount} VMs on OpenShift Virtualization
            </p>
          </Tile>
        </Column>
        <Column lg={5} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile style={{ borderLeft: `4px solid ${score.roksVariant === 'rov' ? '#24a148' : '#009d9a'}`, height: '100%', opacity: score.roksVariant === 'rov' ? 1 : 0.6 }}>
            <h5>All ROV</h5>
            <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {rovMonthlyCost != null ? `${formatCurrency(rovMonthlyCost)}/mo` : 'Not configured'}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#525252' }}>
              All {totalVMCount} VMs — reduced OCP licence
            </p>
          </Tile>
        </Column>
        <Column lg={6} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile style={{ borderLeft: '4px solid #0f62fe', height: '100%' }}>
            <h5>All VSI</h5>
            <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {vsiMonthlyCost != null ? `${formatCurrency(vsiMonthlyCost)}/mo` : 'Not configured'}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#525252' }}>
              All {totalVMCount} VMs on Virtual Servers
            </p>
          </Tile>
        </Column>
      </Grid>

      {/* ROV callout when applicable */}
      {score.roksVariant === 'rov' && score.leaning !== 'vsi' && (
        <Tile style={{ borderLeft: '4px solid #24a148', marginBottom: '1rem', background: '#defbe6' }}>
          <h5 style={{ margin: '0 0 0.25rem' }}>ROV Recommended</h5>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Based on your responses, you do not require containerisation. <strong>ROV (Red Hat OpenShift Virtualization)</strong> provides
            the same bare metal infrastructure and MTV migration tooling at a reduced OCP licence cost.
            If you later need containers, you can upgrade to full ROKS licensing.
          </p>
        </Tile>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ color: '#525252', margin: 0 }}>
          Answer each factor to help determine which platform best fits your organizational needs.
          This questionnaire provides advisory context and does not change per-VM auto-classification.
        </p>
        {hasAnswers && (
          <Button kind="tertiary" size="sm" renderIcon={Reset} onClick={onReset}>
            Reset All
          </Button>
        )}
      </div>

      <Grid narrow>
        {/* VSI Column */}
        <Column lg={8} md={4} sm={4}>
          <h5 style={{ marginBottom: '0.75rem', color: '#0f62fe' }}>Factors favouring VPC VSI</h5>
          {vsiFactors.map(factor => (
            <div key={factor.id} style={{ marginBottom: '1rem' }}>
              <Dropdown
                id={`factor-${factor.id}`}
                titleText={factor.label}
                helperText={factor.description}
                items={ANSWER_ITEMS}
                itemToString={(item: typeof ANSWER_ITEMS[number] | null) => item?.text ?? ''}
                selectedItem={ANSWER_ITEMS.find(i => i.id === answers[factor.id]) ?? null}
                onChange={({ selectedItem }: { selectedItem: typeof ANSWER_ITEMS[number] | null }) => {
                  onAnswer(factor.id, selectedItem ? selectedItem.id as FactorAnswer : null);
                }}
                label="Select..."
              />
            </div>
          ))}
        </Column>

        {/* ROKS Column */}
        <Column lg={8} md={4} sm={4}>
          <h5 style={{ marginBottom: '0.75rem', color: '#009d9a' }}>Factors favouring ROKS</h5>
          {roksFactors.map(factor => (
            <div key={factor.id} style={{ marginBottom: '1rem' }}>
              <Dropdown
                id={`factor-${factor.id}`}
                titleText={factor.label}
                helperText={factor.description}
                items={ANSWER_ITEMS}
                itemToString={(item: typeof ANSWER_ITEMS[number] | null) => item?.text ?? ''}
                selectedItem={ANSWER_ITEMS.find(i => i.id === answers[factor.id]) ?? null}
                onChange={({ selectedItem }: { selectedItem: typeof ANSWER_ITEMS[number] | null }) => {
                  onAnswer(factor.id, selectedItem ? selectedItem.id as FactorAnswer : null);
                }}
                label="Select..."
              />
            </div>
          ))}
        </Column>

        {/* Dynamic factors (cost) - full width */}
        {dynamicFactors.length > 0 && (
          <Column lg={16} md={8} sm={4} style={{ marginTop: '0.5rem' }}>
            <h5 style={{ marginBottom: '0.75rem', color: '#8a3ffc' }}>Dynamic factors</h5>
            {dynamicFactors.map(factor => (
              <div key={factor.id} style={{ marginBottom: '1rem' }}>
                <Dropdown
                  id={`factor-${factor.id}`}
                  titleText={factor.label}
                  helperText={
                    hasCosts && costLeaningLabel
                      ? `${factor.description} Currently favours: ${costLeaningLabel}.`
                      : hasCosts
                        ? `${factor.description} Costs are equal — no platform favoured.`
                        : factor.description
                  }
                  items={ANSWER_ITEMS}
                  itemToString={(item: typeof ANSWER_ITEMS[number] | null) => item?.text ?? ''}
                  selectedItem={ANSWER_ITEMS.find(i => i.id === answers[factor.id]) ?? null}
                  onChange={({ selectedItem }: { selectedItem: typeof ANSWER_ITEMS[number] | null }) => {
                    onAnswer(factor.id, selectedItem ? selectedItem.id as FactorAnswer : null);
                  }}
                  label="Select..."
                />
              </div>
            ))}
          </Column>
        )}

        {/* Score Summary */}
        <Column lg={8} md={4} sm={4} style={{ marginTop: '0.5rem' }}>
          <Tile style={{ borderLeft: '4px solid #0f62fe' }}>
            <h5 style={{ margin: 0 }}>VSI Factors</h5>
            <p style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0.25rem 0 0' }}>
              {score.vsiCount} of {vsiFactors.length + (score.costLeaning === 'vsi' ? 1 : 0)}
            </p>
          </Tile>
        </Column>
        <Column lg={8} md={4} sm={4} style={{ marginTop: '0.5rem' }}>
          <Tile style={{ borderLeft: '4px solid #009d9a' }}>
            <h5 style={{ margin: 0 }}>ROKS Factors</h5>
            <p style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0.25rem 0 0' }}>
              {score.roksCount} of {roksFactors.length + (score.costLeaning === 'roks' ? 1 : 0)}
            </p>
          </Tile>
        </Column>

        {/* Leaning */}
        {hasAnswers && (
          <Column lg={16} md={8} sm={4} style={{ marginTop: '0.5rem' }}>
            <Tile>
              <p style={{ margin: 0 }}>
                <strong>Questionnaire leans toward:</strong> {leaningText}
              </p>
            </Tile>
          </Column>
        )}

      </Grid>
    </div>
  );
}
