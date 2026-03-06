// AI Anomaly Detection Panel — displays anomalies with severity-colored tiles

import {
  Tile,
  Tag,
  InlineLoading,
  InlineNotification,
  Button,
  Accordion,
  AccordionItem,
} from '@carbon/react';
import { Renew, WarningAlt, Warning } from '@carbon/icons-react';
import type { AnomalyResult, AnomalySeverity } from '@/services/ai/types';

interface AIAnomalyPanelProps {
  anomalies: AnomalyResult[];
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
  compact?: boolean;
}

const severityTagType: Record<AnomalySeverity, 'red' | 'magenta' | 'warm-gray' | 'cool-gray'> = {
  critical: 'red',
  high: 'magenta',
  medium: 'warm-gray',
  low: 'cool-gray',
};

const severityIcon: Record<AnomalySeverity, typeof Warning | typeof WarningAlt> = {
  critical: Warning,
  high: Warning,
  medium: WarningAlt,
  low: WarningAlt,
};

export function AIAnomalyPanel({
  anomalies,
  isLoading,
  error,
  onRefresh,
  compact = false,
}: AIAnomalyPanelProps) {
  if (isLoading) {
    return (
      <Tile>
        <InlineLoading status="active" description="Detecting anomalies..." />
      </Tile>
    );
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        title="Anomaly Detection"
        subtitle={error}
        lowContrast
        hideCloseButton
      />
    );
  }

  if (anomalies.length === 0) {
    return null;
  }

  const sorted = [...anomalies].sort((a, b) => {
    const order: Record<AnomalySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] || 4) - (order[b.severity] || 4);
  });

  if (compact) {
    const critical = anomalies.filter(a => a.severity === 'critical').length;
    const high = anomalies.filter(a => a.severity === 'high').length;
    const medium = anomalies.filter(a => a.severity === 'medium').length;

    return (
      <Tile className="ai-anomaly-panel--compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <WarningAlt size={20} />
          <strong>{anomalies.length} anomalies detected</strong>
          {critical > 0 && <Tag type="red" size="sm">{critical} critical</Tag>}
          {high > 0 && <Tag type="red" size="sm">{high} high</Tag>}
          {medium > 0 && <Tag type="warm-gray" size="sm">{medium} medium</Tag>}
        </div>
      </Tile>
    );
  }

  return (
    <div className="ai-anomaly-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4>Anomaly Detection</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag type="purple" size="sm">AI</Tag>
          {onRefresh && (
            <Button kind="ghost" size="sm" renderIcon={Renew} iconDescription="Refresh" hasIconOnly onClick={onRefresh} />
          )}
        </div>
      </div>
      <Accordion>
        {sorted.map((anomaly, i) => {
          const Icon = severityIcon[anomaly.severity];
          return (
            <AccordionItem
              key={`anomaly-${i}`}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon size={16} />
                  <Tag type={severityTagType[anomaly.severity]} size="sm">{anomaly.severity}</Tag>
                  <span>{anomaly.title}</span>
                  <Tag type="cool-gray" size="sm">{anomaly.affectedCount} VMs</Tag>
                </div>
              }
            >
              <p style={{ marginBottom: '0.5rem' }}>{anomaly.description}</p>
              <p><strong>Recommendation:</strong> {anomaly.recommendation}</p>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
