// Risk Assessment Types — v3 (flat risk table)

export type RiskStatus = 'red' | 'amber' | 'green';
export type RiskSource = 'auto' | 'curated' | 'user';
export type RiskCategory =
  | 'Financial'
  | 'Business / Org'
  | 'Skills / Knowledge'
  | 'Ops & Tooling'
  | 'Backup & DR'
  | 'Technical';

export const RISK_CATEGORIES: RiskCategory[] = [
  'Financial',
  'Business / Org',
  'Skills / Knowledge',
  'Ops & Tooling',
  'Backup & DR',
  'Technical',
];

export interface RiskRow {
  id: string;
  source: RiskSource;
  category: RiskCategory;
  description: string;
  impactArea: string;
  status: RiskStatus;
  mitigationPlan: string;
  evidenceDetail: string;
}

export interface RiskTableData {
  rows: RiskRow[];
}

export interface RiskTableOverrides {
  version: 3;
  environmentFingerprint: string;
  rowOverrides: Record<string, {
    status?: RiskStatus;
    mitigationPlan?: string;
    category?: RiskCategory;
    description?: string;
    impactArea?: string;
    evidenceDetail?: string;
  }>;
  deletedRows: string[];
  userRows: RiskRow[];
  createdAt: string;
  modifiedAt: string;
}

export interface CostComparisonInput {
  currentMonthlyCost: number | null;
  calculatedROKSMonthlyCost: number | null;
  calculatedVSIMonthlyCost: number | null;
}

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  red: 'Red',
  amber: 'Amber',
  green: 'Green',
};

export const RISK_STATUS_COLORS: Record<RiskStatus, string> = {
  red: '#da1e28',
  amber: '#f1c21b',
  green: '#24a148',
};
