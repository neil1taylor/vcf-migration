// Risk Assessment Service
// Pure functions to auto-calculate risk severity across 5 domains

import type { RVToolsData } from '@/types/rvtools';
import type {
  RiskAssessment,
  RiskDomainAssessment,
  RiskDomainId,
  RiskSeverity,
  RiskEvidence,
  RiskOverrides,
} from '@/types/riskAssessment';
import { RISK_DOMAIN_LABELS, RISK_SEVERITY_ORDER } from '@/types/riskAssessment';
import { runPreFlightChecks } from '@/services/preflightChecks';
import {
  calculateComplexityScores,
  getAssessmentSummary,
} from '@/services/migration/migrationAssessment';

// ===== DOMAIN AUTO-CALCULATORS =====

function assessCostRisk(rawData: RVToolsData | null): { severity: RiskSeverity | null; evidence: RiskEvidence[] } {
  if (!rawData) return { severity: null, evidence: [] };

  const evidence: RiskEvidence[] = [];
  const vmCount = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template).length;

  // Large environments are inherently more expensive to migrate
  if (vmCount > 500) {
    evidence.push({ label: 'Large environment', detail: `${vmCount} active VMs — expect significant cloud costs`, severity: 'high' });
  } else if (vmCount > 100) {
    evidence.push({ label: 'Medium environment', detail: `${vmCount} active VMs`, severity: 'medium' });
  } else {
    evidence.push({ label: 'Small environment', detail: `${vmCount} active VMs`, severity: 'low' });
  }

  // Check for license implications
  const licenses = rawData.vLicense?.length ?? 0;
  if (licenses > 0) {
    evidence.push({ label: 'VMware licenses detected', detail: `${licenses} license entries to review for portability`, severity: 'medium' });
  }

  const maxSeverity = evidence.length > 0
    ? evidence.reduce((max, e) => RISK_SEVERITY_ORDER[e.severity] > RISK_SEVERITY_ORDER[max] ? e.severity : max, 'low' as RiskSeverity)
    : 'medium';

  return { severity: maxSeverity, evidence };
}

function assessInfrastructureRisk(rawData: RVToolsData | null): { severity: RiskSeverity | null; evidence: RiskEvidence[] } {
  if (!rawData) return { severity: null, evidence: [] };

  const evidence: RiskEvidence[] = [];

  // Run pre-flight checks for both modes
  const roksChecks = runPreFlightChecks(rawData, 'roks');
  const vsiChecks = runPreFlightChecks(rawData, 'vsi');

  const totalVMs = roksChecks.length || vsiChecks.length || 1;

  // ROKS blockers
  const roksBlockers = roksChecks.filter(r => r.blockerCount > 0).length;
  const roksBlockerPct = (roksBlockers / totalVMs) * 100;
  if (roksBlockers > 0) {
    evidence.push({
      label: 'ROKS pre-flight blockers',
      detail: `${roksBlockers} VMs (${roksBlockerPct.toFixed(1)}%) have blockers for ROKS migration`,
      severity: roksBlockerPct > 15 ? 'critical' : roksBlockerPct > 5 ? 'high' : 'medium',
    });
  }

  // VSI blockers
  const vsiBlockers = vsiChecks.filter(r => r.blockerCount > 0).length;
  const vsiBlockerPct = (vsiBlockers / totalVMs) * 100;
  if (vsiBlockers > 0) {
    evidence.push({
      label: 'VSI pre-flight blockers',
      detail: `${vsiBlockers} VMs (${vsiBlockerPct.toFixed(1)}%) have blockers for VSI migration`,
      severity: vsiBlockerPct > 15 ? 'critical' : vsiBlockerPct > 5 ? 'high' : 'medium',
    });
  }

  // Warnings
  const roksWarnings = roksChecks.filter(r => r.warningCount > 0).length;
  const vsiWarnings = vsiChecks.filter(r => r.warningCount > 0).length;
  const totalWarnings = Math.max(roksWarnings, vsiWarnings);
  if (totalWarnings > 0) {
    evidence.push({
      label: 'Pre-flight warnings',
      detail: `${totalWarnings} VMs have warnings that may need remediation`,
      severity: 'low',
    });
  }

  if (evidence.length === 0) {
    evidence.push({ label: 'No blockers detected', detail: 'All VMs pass pre-flight checks', severity: 'low' });
  }

  // Overall: worst of both modes
  const maxBlockerPct = Math.max(roksBlockerPct, vsiBlockerPct);
  let severity: RiskSeverity;
  if (maxBlockerPct > 15) severity = 'critical';
  else if (maxBlockerPct > 5) severity = 'high';
  else if (maxBlockerPct > 0) severity = 'medium';
  else severity = 'low';

  return { severity, evidence };
}

function assessComplexityRisk(rawData: RVToolsData | null): { severity: RiskSeverity | null; evidence: RiskEvidence[] } {
  if (!rawData) return { severity: null, evidence: [] };

  const evidence: RiskEvidence[] = [];
  const activeVMs = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);

  // Calculate complexity scores (VSI mode as baseline)
  const scores = calculateComplexityScores(activeVMs, rawData.vDisk, rawData.vNetwork, 'vsi');
  const summary = getAssessmentSummary(scores);

  const totalVMs = summary.totalVMs || 1;
  const blockerPct = (summary.blockerCount / totalVMs) * 100;
  const complexPct = ((summary.complexCount + summary.blockerCount) / totalVMs) * 100;

  if (summary.blockerCount > 0) {
    evidence.push({
      label: 'Complexity blockers',
      detail: `${summary.blockerCount} VMs (${blockerPct.toFixed(1)}%) scored as blockers`,
      severity: blockerPct > 10 ? 'critical' : 'high',
    });
  }

  if (summary.complexCount > 0) {
    evidence.push({
      label: 'Complex VMs',
      detail: `${summary.complexCount} VMs require significant migration effort`,
      severity: complexPct > 30 ? 'high' : 'medium',
    });
  }

  evidence.push({
    label: 'Average complexity score',
    detail: `${summary.averageScore}/100 across ${totalVMs} VMs`,
    severity: summary.averageScore > 50 ? 'medium' : 'low',
  });

  // Distribution summary
  evidence.push({
    label: 'Distribution',
    detail: `Simple: ${summary.simpleCount}, Moderate: ${summary.moderateCount}, Complex: ${summary.complexCount}, Blocker: ${summary.blockerCount}`,
    severity: 'low',
  });

  let severity: RiskSeverity;
  if (blockerPct > 10) severity = 'critical';
  else if (complexPct > 30) severity = 'high';
  else if (summary.averageScore > 50) severity = 'medium';
  else severity = 'low';

  return { severity, evidence };
}

// ===== MAIN CALCULATOR =====

function createDomainAssessment(
  domainId: RiskDomainId,
  autoResult: { severity: RiskSeverity | null; evidence: RiskEvidence[] },
  overrides?: RiskOverrides
): RiskDomainAssessment {
  const overrideSeverity = overrides?.domainOverrides[domainId]?.severity ?? null;
  const notes = overrides?.domainOverrides[domainId]?.notes ?? '';

  return {
    domainId,
    label: RISK_DOMAIN_LABELS[domainId],
    mode: autoResult.severity !== null ? 'auto' : 'manual',
    autoSeverity: autoResult.severity,
    overrideSeverity,
    effectiveSeverity: overrideSeverity ?? autoResult.severity ?? 'low',
    evidence: autoResult.evidence,
    notes,
  };
}

function calculateGoNoGo(domains: Record<RiskDomainId, RiskDomainAssessment>): {
  overallSeverity: RiskSeverity;
  goNoGo: 'go' | 'no-go' | 'conditional';
} {
  const severities = Object.values(domains).map(d => d.effectiveSeverity);
  const hasCritical = severities.includes('critical');
  const hasHigh = severities.includes('high');

  const overallSeverity = hasCritical ? 'critical' : hasHigh ? 'high' : severities.includes('medium') ? 'medium' : 'low';
  const goNoGo = hasCritical ? 'no-go' : hasHigh ? 'conditional' : 'go';

  return { overallSeverity, goNoGo };
}

export function calculateRiskAssessment(
  rawData: RVToolsData | null,
  overrides?: RiskOverrides
): RiskAssessment {
  const costResult = assessCostRisk(rawData);
  const infraResult = assessInfrastructureRisk(rawData);
  const complexityResult = assessComplexityRisk(rawData);
  const securityResult: { severity: RiskSeverity | null; evidence: RiskEvidence[] } = { severity: null, evidence: [] };
  const otherResult: { severity: RiskSeverity | null; evidence: RiskEvidence[] } = { severity: null, evidence: [] };

  const domains: Record<RiskDomainId, RiskDomainAssessment> = {
    cost: createDomainAssessment('cost', costResult, overrides),
    infrastructure: createDomainAssessment('infrastructure', infraResult, overrides),
    complexity: createDomainAssessment('complexity', complexityResult, overrides),
    security: createDomainAssessment('security', securityResult, overrides),
    other: createDomainAssessment('other', otherResult, overrides),
  };

  const { overallSeverity, goNoGo } = calculateGoNoGo(domains);

  return { domains, overallSeverity, goNoGo };
}
