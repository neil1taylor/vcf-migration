// Risk Assessment Page — Red-Flag Risk Assessment + Pre-Assessment Summary
import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Grid, Column, Button, UnorderedList, ListItem } from '@carbon/react';
import { Reset } from '@carbon/icons-react';
import { useData, useHasData } from '@/hooks';
import { useRiskAssessment } from '@/hooks/useRiskAssessment';
import { ROUTES } from '@/utils/constants';
import { GoNoGoBanner } from '@/components/risk/GoNoGoBanner';
import { RiskDomainCard } from '@/components/risk/RiskDomainCard';
import { RiskHeatMap } from '@/components/risk/RiskHeatMap';
import { EnvironmentSnapshotTile } from '@/components/risk/EnvironmentSnapshotTile';
import type { RiskDomainId } from '@/types/riskAssessment';
import './RiskAssessmentPage.scss';

const DOMAIN_ORDER: RiskDomainId[] = ['cost', 'readiness', 'security', 'operational', 'compliance', 'timeline'];

export function RiskAssessmentPage() {
  const hasData = useHasData();
  const { rawData, calculatedCosts } = useData();
  const { assessment, setDomainOverride, setDomainNotes, currentMonthlyCost, setCurrentMonthlyCost, clearAll } = useRiskAssessment(calculatedCosts);

  const keyBlockers = useMemo(() => {
    return Object.values(assessment.domains)
      .flatMap(d => d.evidence.filter(e => e.severity === 'critical' || e.severity === 'high'))
      .slice(0, 10);
  }, [assessment]);

  if (!hasData || !rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <div className="risk-page__header">
          <h1>Risk Assessment</h1>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={Reset}
            onClick={clearAll}
          >
            Reset Overrides
          </Button>
        </div>
      </Column>

      <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
        <GoNoGoBanner decision={assessment.goNoGo} overallSeverity={assessment.overallSeverity} />
      </Column>

      <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
        <EnvironmentSnapshotTile rawData={rawData} />
      </Column>

      <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Risk Heat Map</h3>
        <RiskHeatMap assessment={assessment} />
      </Column>

      <Column sm={4} md={8} lg={16}>
        <Grid condensed>
          {DOMAIN_ORDER.map(domainId => (
            <Column key={domainId} sm={4} md={4} lg={8} style={{ marginBottom: '1rem' }}>
              <RiskDomainCard
                domain={assessment.domains[domainId]}
                onOverrideSeverity={setDomainOverride}
                onNotesChange={setDomainNotes}
                currentMonthlyCost={domainId === 'cost' ? currentMonthlyCost : undefined}
                onCurrentMonthlyCostChange={domainId === 'cost' ? setCurrentMonthlyCost : undefined}
              />
            </Column>
          ))}
        </Grid>
      </Column>

      {keyBlockers.length > 0 && (
        <Column sm={4} md={8} lg={16} style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Key Blockers</h3>
          <UnorderedList>
            {keyBlockers.map((b, i) => (
              <ListItem key={i}>
                <strong>{b.label}:</strong> {b.detail}
              </ListItem>
            ))}
          </UnorderedList>
        </Column>
      )}
    </Grid>
  );
}
