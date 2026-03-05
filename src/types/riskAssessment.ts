// Risk Assessment Types

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskDomainId = 'cost' | 'infrastructure' | 'complexity' | 'security' | 'other';
export type GoNoGoDecision = 'go' | 'no-go' | 'conditional';

export interface RiskEvidence {
  label: string;
  detail: string;
  severity: RiskSeverity;
}

export interface RiskDomainAssessment {
  domainId: RiskDomainId;
  label: string;
  mode: 'auto' | 'manual';
  autoSeverity: RiskSeverity | null;
  overrideSeverity: RiskSeverity | null;
  effectiveSeverity: RiskSeverity; // override ?? auto ?? 'low'
  evidence: RiskEvidence[];
  notes: string;
}

export interface RiskAssessment {
  domains: Record<RiskDomainId, RiskDomainAssessment>;
  overallSeverity: RiskSeverity;
  goNoGo: GoNoGoDecision;
}

export interface RiskOverrides {
  version: number;
  environmentFingerprint: string;
  domainOverrides: Record<string, {
    severity?: RiskSeverity;
    notes?: string;
  }>;
  createdAt: string;
  modifiedAt: string;
}

export const RISK_DOMAIN_LABELS: Record<RiskDomainId, string> = {
  cost: 'Cost & Licensing',
  infrastructure: 'Infrastructure / NFRs',
  complexity: 'Complexity & Compatibility',
  security: 'Security & Compliance',
  other: 'Other Risks',
};

export const RISK_SEVERITY_ORDER: Record<RiskSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const RISK_SEVERITY_COLORS: Record<RiskSeverity, string> = {
  low: '#24a148',
  medium: '#f1c21b',
  high: '#ff832b',
  critical: '#da1e28',
};
