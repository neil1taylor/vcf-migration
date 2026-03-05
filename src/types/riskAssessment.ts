// Risk Assessment Types — v2

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskDomainId = 'cost' | 'readiness' | 'security' | 'operational' | 'compliance' | 'timeline';
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

export interface CostComparisonInput {
  currentMonthlyCost: number | null;
  calculatedROKSMonthlyCost: number | null;
  calculatedVSIMonthlyCost: number | null;
}

export interface RiskOverrides {
  version: number;
  environmentFingerprint: string;
  domainOverrides: Record<string, {
    severity?: RiskSeverity;
    notes?: string;
  }>;
  costInput?: {
    currentMonthlyCost: number | null;
  };
  createdAt: string;
  modifiedAt: string;
}

export const RISK_DOMAIN_LABELS: Record<RiskDomainId, string> = {
  cost: 'Cost Comparison',
  readiness: 'Migration Readiness',
  security: 'Security & Compliance',
  operational: 'Operational Risk',
  compliance: 'Data & Compliance Risk',
  timeline: 'Timeline & Resource Risk',
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
