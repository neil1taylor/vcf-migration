// AI Risk Analysis Panel — displays AI-enhanced risk assessment

import {
  Tile,
  Tag,
  InlineLoading,
  InlineNotification,
  Button,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
} from '@carbon/react';
import { Renew } from '@carbon/icons-react';
import type { RiskAnalysisResult } from '@/services/ai/types';

interface AIRiskPanelProps {
  riskAnalysis: RiskAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
  onAcceptSecurityRisk?: (index: number) => void;
  onDismissSecurityRisk?: (index: number) => void;
}

export function AIRiskPanel({
  riskAnalysis,
  isLoading,
  error,
  onRefresh,
  onAcceptSecurityRisk,
  onDismissSecurityRisk,
}: AIRiskPanelProps) {
  if (isLoading) {
    return (
      <Tile>
        <InlineLoading status="active" description="Analyzing risks..." />
      </Tile>
    );
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        title="AI Risk Analysis"
        subtitle={error}
        lowContrast
        hideCloseButton
      />
    );
  }

  if (!riskAnalysis) {
    return null;
  }

  const goNoGo = riskAnalysis.goNoGoAnalysis;
  const goNoGoKind = goNoGo.recommendation === 'go' ? 'green' : goNoGo.recommendation === 'no-go' ? 'red' : 'warm-gray';

  return (
    <div className="ai-risk-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4>AI Risk Analysis</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag type="purple" size="sm">AI</Tag>
          {onRefresh && (
            <Button kind="ghost" size="sm" renderIcon={Renew} iconDescription="Refresh" hasIconOnly onClick={onRefresh} />
          )}
        </div>
      </div>

      {/* Go/No-Go */}
      <Tile style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <strong>AI Go/No-Go:</strong>
          <Tag type={goNoGoKind} size="sm">{goNoGo.recommendation.toUpperCase()}</Tag>
          <Tag type="cool-gray" size="sm">Confidence: {Math.round(goNoGo.confidence * 100)}%</Tag>
        </div>
        <p>{goNoGo.reasoning}</p>
        {goNoGo.keyConditions.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <strong>Key conditions:</strong>
            <ul>
              {goNoGo.keyConditions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
      </Tile>

      {/* Severity Adjustments */}
      {riskAnalysis.severityAdjustments.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h5 style={{ marginBottom: '0.5rem' }}>Suggested Severity Adjustments</h5>
          <StructuredListWrapper>
            <StructuredListHead>
              <StructuredListRow head>
                <StructuredListCell head>Domain</StructuredListCell>
                <StructuredListCell head>Current</StructuredListCell>
                <StructuredListCell head>Suggested</StructuredListCell>
                <StructuredListCell head>Reasoning</StructuredListCell>
              </StructuredListRow>
            </StructuredListHead>
            <StructuredListBody>
              {riskAnalysis.severityAdjustments.map((adj, i) => (
                <StructuredListRow key={i}>
                  <StructuredListCell>{adj.domain}</StructuredListCell>
                  <StructuredListCell>
                    <Tag type="cool-gray" size="sm">{adj.currentSeverity}</Tag>
                  </StructuredListCell>
                  <StructuredListCell>
                    <Tag type="warm-gray" size="sm">{adj.suggestedSeverity}</Tag>
                  </StructuredListCell>
                  <StructuredListCell>{adj.reasoning}</StructuredListCell>
                </StructuredListRow>
              ))}
            </StructuredListBody>
          </StructuredListWrapper>
        </div>
      )}

      {/* AI-Suggested Security Risks */}
      {riskAnalysis.securityRisks.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h5 style={{ marginBottom: '0.5rem' }}>AI-Suggested Security Risks</h5>
          {riskAnalysis.securityRisks.map((risk, i) => (
            <Tile key={i} style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Tag type="warm-gray" size="sm">{risk.severity}</Tag>
                    <strong>{risk.title}</strong>
                  </div>
                  <p style={{ marginBottom: '0.25rem' }}>{risk.description}</p>
                  <p><em>Recommendation: {risk.recommendation}</em></p>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {onAcceptSecurityRisk && (
                    <Button kind="ghost" size="sm" onClick={() => onAcceptSecurityRisk(i)}>Accept</Button>
                  )}
                  {onDismissSecurityRisk && (
                    <Button kind="ghost" size="sm" onClick={() => onDismissSecurityRisk(i)}>Dismiss</Button>
                  )}
                </div>
              </div>
            </Tile>
          ))}
        </div>
      )}

      {/* Missed Risks */}
      {riskAnalysis.missedRisks.length > 0 && (
        <div>
          <h5 style={{ marginBottom: '0.5rem' }}>Additional Risks Identified by AI</h5>
          {riskAnalysis.missedRisks.map((risk, i) => (
            <Tile key={i} style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Tag type="warm-gray" size="sm">{risk.severity}</Tag>
                <Tag type="cool-gray" size="sm">{risk.domain}</Tag>
                <strong>{risk.title}</strong>
              </div>
              <p>{risk.description}</p>
            </Tile>
          ))}
        </div>
      )}
    </div>
  );
}
