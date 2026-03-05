// Go/No-Go Decision Banner
import { InlineNotification } from '@carbon/react';
import type { GoNoGoDecision, RiskSeverity } from '@/types/riskAssessment';

interface GoNoGoBannerProps {
  decision: GoNoGoDecision;
  overallSeverity: RiskSeverity;
}

const DECISION_CONFIG: Record<GoNoGoDecision, { kind: 'success' | 'warning' | 'error'; title: string; subtitle: string }> = {
  go: {
    kind: 'success',
    title: 'GO — Migration Recommended',
    subtitle: 'All risk domains are within acceptable levels. Proceed with migration planning.',
  },
  conditional: {
    kind: 'warning',
    title: 'CONDITIONAL — Migration with Remediation',
    subtitle: 'One or more domains have high risk. Address identified issues before proceeding.',
  },
  'no-go': {
    kind: 'error',
    title: 'NO-GO — Migration Not Recommended',
    subtitle: 'Critical risks detected. Resolve blockers before migration can proceed.',
  },
};

export function GoNoGoBanner({ decision, overallSeverity }: GoNoGoBannerProps) {
  const config = DECISION_CONFIG[decision];

  return (
    <InlineNotification
      kind={config.kind}
      title={config.title}
      subtitle={`${config.subtitle} (Overall risk: ${overallSeverity})`}
      lowContrast
      hideCloseButton
      style={{ maxWidth: '100%', marginBottom: '1rem' }}
    />
  );
}
