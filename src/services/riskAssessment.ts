// Risk Assessment Service
// Pure functions to auto-calculate risk severity across 6 domains

import type { RVToolsData } from '@/types/rvtools';
import type {
  RiskAssessment,
  RiskDomainAssessment,
  RiskDomainId,
  RiskSeverity,
  RiskEvidence,
  RiskOverrides,
  CostComparisonInput,
} from '@/types/riskAssessment';
import { RISK_DOMAIN_LABELS, RISK_SEVERITY_ORDER } from '@/types/riskAssessment';
import { runPreFlightChecks } from '@/services/preflightChecks';
import {
  calculateComplexityScores,
  getAssessmentSummary,
} from '@/services/migration/migrationAssessment';

// ===== DOMAIN AUTO-CALCULATORS =====

function assessCostRisk(
  rawData: RVToolsData | null,
  costInput?: CostComparisonInput
): { severity: RiskSeverity | null; evidence: RiskEvidence[] } {
  if (!rawData) return { severity: null, evidence: [] };

  const evidence: RiskEvidence[] = [];
  const currentCost = costInput?.currentMonthlyCost;
  const roksCost = costInput?.calculatedROKSMonthlyCost;
  const vsiCost = costInput?.calculatedVSIMonthlyCost;

  // If user has entered current cost and we have calculated costs, do real comparison
  if (currentCost != null && currentCost > 0 && (roksCost != null || vsiCost != null)) {
    const targetCost = Math.min(
      ...[roksCost, vsiCost].filter((c): c is number => c != null && c > 0)
    );
    const pctChange = ((targetCost - currentCost) / currentCost) * 100;
    const cheaper = roksCost != null && vsiCost != null
      ? (roksCost <= vsiCost ? 'ROKS' : 'VPC VSI')
      : (roksCost != null ? 'ROKS' : 'VPC VSI');

    evidence.push({
      label: 'Current monthly cost',
      detail: `$${currentCost.toLocaleString()}/month`,
      severity: 'low',
    });

    if (roksCost != null) {
      evidence.push({
        label: 'Calculated ROKS cost',
        detail: `$${roksCost.toLocaleString()}/month`,
        severity: 'low',
      });
    }
    if (vsiCost != null) {
      evidence.push({
        label: 'Calculated VSI cost',
        detail: `$${vsiCost.toLocaleString()}/month`,
        severity: 'low',
      });
    }

    let changeSeverity: RiskSeverity;
    if (pctChange <= 20) changeSeverity = 'low';
    else if (pctChange <= 50) changeSeverity = 'medium';
    else if (pctChange <= 100) changeSeverity = 'high';
    else changeSeverity = 'critical';

    const direction = pctChange <= 0 ? 'savings' : 'increase';
    evidence.push({
      label: 'Cost comparison',
      detail: `${Math.abs(pctChange).toFixed(1)}% ${direction} vs current (best target: ${cheaper})`,
      severity: changeSeverity,
    });

    return { severity: changeSeverity, evidence };
  }

  // Fallback: VM count heuristic when no current cost entered
  const vmCount = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template).length;

  if (vmCount > 500) {
    evidence.push({ label: 'Large environment', detail: `${vmCount} active VMs — expect significant cloud costs`, severity: 'high' });
  } else if (vmCount > 100) {
    evidence.push({ label: 'Medium environment', detail: `${vmCount} active VMs`, severity: 'medium' });
  } else {
    evidence.push({ label: 'Small environment', detail: `${vmCount} active VMs`, severity: 'low' });
  }

  const licenses = rawData.vLicense?.length ?? 0;
  if (licenses > 0) {
    evidence.push({ label: 'VMware licenses detected', detail: `${licenses} license entries to review for portability`, severity: 'medium' });
  }

  evidence.push({
    label: 'Tip',
    detail: 'Enter your current monthly cost for precise comparison',
    severity: 'low',
  });

  const maxSeverity = evidence.length > 0
    ? evidence.reduce((max, e) => RISK_SEVERITY_ORDER[e.severity] > RISK_SEVERITY_ORDER[max] ? e.severity : max, 'low' as RiskSeverity)
    : 'medium';

  return { severity: maxSeverity, evidence };
}

function assessReadinessRisk(rawData: RVToolsData | null): { severity: RiskSeverity | null; evidence: RiskEvidence[] } {
  if (!rawData) return { severity: null, evidence: [] };

  const evidence: RiskEvidence[] = [];

  // --- Pre-flight sub-assessment ---
  const roksChecks = runPreFlightChecks(rawData, 'roks');
  const vsiChecks = runPreFlightChecks(rawData, 'vsi');
  const totalVMs = roksChecks.length || vsiChecks.length || 1;

  const roksBlockers = roksChecks.filter(r => r.blockerCount > 0).length;
  const roksBlockerPct = (roksBlockers / totalVMs) * 100;
  if (roksBlockers > 0) {
    evidence.push({
      label: 'Pre-flight: ROKS blockers',
      detail: `${roksBlockers} VMs (${roksBlockerPct.toFixed(1)}%) have blockers for ROKS migration`,
      severity: roksBlockerPct > 15 ? 'critical' : roksBlockerPct > 5 ? 'high' : 'medium',
    });
  }

  const vsiBlockers = vsiChecks.filter(r => r.blockerCount > 0).length;
  const vsiBlockerPct = (vsiBlockers / totalVMs) * 100;
  if (vsiBlockers > 0) {
    evidence.push({
      label: 'Pre-flight: VSI blockers',
      detail: `${vsiBlockers} VMs (${vsiBlockerPct.toFixed(1)}%) have blockers for VSI migration`,
      severity: vsiBlockerPct > 15 ? 'critical' : vsiBlockerPct > 5 ? 'high' : 'medium',
    });
  }

  const roksWarnings = roksChecks.filter(r => r.warningCount > 0).length;
  const vsiWarnings = vsiChecks.filter(r => r.warningCount > 0).length;
  const totalWarnings = Math.max(roksWarnings, vsiWarnings);
  if (totalWarnings > 0) {
    evidence.push({
      label: 'Pre-flight: Warnings',
      detail: `${totalWarnings} VMs have warnings that may need remediation`,
      severity: 'low',
    });
  }

  if (roksBlockers === 0 && vsiBlockers === 0) {
    evidence.push({ label: 'Pre-flight: No blockers detected', detail: 'All VMs pass pre-flight checks', severity: 'low' });
  }

  // Pre-flight severity
  const maxBlockerPct = Math.max(roksBlockerPct, vsiBlockerPct);
  let preflightSeverity: RiskSeverity;
  if (maxBlockerPct > 15) preflightSeverity = 'critical';
  else if (maxBlockerPct > 5) preflightSeverity = 'high';
  else if (maxBlockerPct > 0) preflightSeverity = 'medium';
  else preflightSeverity = 'low';

  // --- Complexity sub-assessment ---
  const activeVMs = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  const scores = calculateComplexityScores(activeVMs, rawData.vDisk, rawData.vNetwork, 'vsi');
  const summary = getAssessmentSummary(scores);

  const complexTotalVMs = summary.totalVMs || 1;
  const blockerPct = (summary.blockerCount / complexTotalVMs) * 100;
  const complexPct = ((summary.complexCount + summary.blockerCount) / complexTotalVMs) * 100;

  if (summary.blockerCount > 0) {
    evidence.push({
      label: 'Complexity: Blockers',
      detail: `${summary.blockerCount} VMs (${blockerPct.toFixed(1)}%) scored as blockers`,
      severity: blockerPct > 10 ? 'critical' : 'high',
    });
  }

  if (summary.complexCount > 0) {
    evidence.push({
      label: 'Complexity: Complex VMs',
      detail: `${summary.complexCount} VMs require significant migration effort`,
      severity: complexPct > 30 ? 'high' : 'medium',
    });
  }

  evidence.push({
    label: 'Complexity: Average score',
    detail: `${summary.averageScore}/100 across ${complexTotalVMs} VMs`,
    severity: summary.averageScore > 50 ? 'medium' : 'low',
  });

  evidence.push({
    label: 'Complexity: Distribution',
    detail: `Simple: ${summary.simpleCount}, Moderate: ${summary.moderateCount}, Complex: ${summary.complexCount}, Blocker: ${summary.blockerCount}`,
    severity: 'low',
  });

  // Complexity severity
  let complexitySeverity: RiskSeverity;
  if (blockerPct > 10) complexitySeverity = 'critical';
  else if (complexPct > 30) complexitySeverity = 'high';
  else if (summary.averageScore > 50) complexitySeverity = 'medium';
  else complexitySeverity = 'low';

  // Readiness = worst of pre-flight and complexity
  const severity = RISK_SEVERITY_ORDER[preflightSeverity] >= RISK_SEVERITY_ORDER[complexitySeverity]
    ? preflightSeverity
    : complexitySeverity;

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
  overrides?: RiskOverrides,
  costInput?: CostComparisonInput
): RiskAssessment {
  const costResult = assessCostRisk(rawData, costInput);
  const readinessResult = assessReadinessRisk(rawData);
  const manualResult: { severity: RiskSeverity | null; evidence: RiskEvidence[] } = { severity: null, evidence: [] };

  const domains: Record<RiskDomainId, RiskDomainAssessment> = {
    cost: createDomainAssessment('cost', costResult, overrides),
    readiness: createDomainAssessment('readiness', readinessResult, overrides),
    security: createDomainAssessment('security', manualResult, overrides),
    operational: createDomainAssessment('operational', manualResult, overrides),
    compliance: createDomainAssessment('compliance', manualResult, overrides),
    timeline: createDomainAssessment('timeline', manualResult, overrides),
  };

  const { overallSeverity, goNoGo } = calculateGoNoGo(domains);

  return { domains, overallSeverity, goNoGo };
}
