// Risk Assessment Service — v3 (flat risk table)
// Generates auto-detected risks, loads curated defaults, and merges with user overrides

import type { RVToolsData } from '@/types/rvtools';
import type {
  RiskRow,
  RiskStatus,
  RiskTableData,
  RiskTableOverrides,
  CostComparisonInput,
} from '@/types/riskAssessment';
import curatedRisksData from '@/data/curatedMigrationRisks.json';
import { runPreFlightChecks } from '@/services/preflightChecks';
import {
  calculateComplexityScores,
  getAssessmentSummary,
} from '@/services/migration/migrationAssessment';

// ===== AUTO-DETECTED RISKS =====

export function generateAutoRisks(
  rawData: RVToolsData | null,
  costInput?: CostComparisonInput
): RiskRow[] {
  if (!rawData) return [];

  const rows: RiskRow[] = [];
  const activeVMs = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  const vmCount = activeVMs.length;

  // --- Pre-flight blockers ---
  const roksChecks = runPreFlightChecks(rawData, 'roks');
  const vsiChecks = runPreFlightChecks(rawData, 'vsi');
  const totalVMs = roksChecks.length || vsiChecks.length || 1;

  const roksBlockers = roksChecks.filter(r => r.blockerCount > 0).length;
  const vsiBlockers = vsiChecks.filter(r => r.blockerCount > 0).length;

  if (roksBlockers > 0 || vsiBlockers > 0) {
    const maxPct = Math.max(
      (roksBlockers / totalVMs) * 100,
      (vsiBlockers / totalVMs) * 100
    );
    const status: RiskStatus = maxPct > 15 ? 'red' : maxPct > 5 ? 'red' : 'amber';
    const details: string[] = [];
    if (roksBlockers > 0) details.push(`ROKS: ${roksBlockers} VMs (${((roksBlockers / totalVMs) * 100).toFixed(1)}%)`);
    if (vsiBlockers > 0) details.push(`VSI: ${vsiBlockers} VMs (${((vsiBlockers / totalVMs) * 100).toFixed(1)}%)`);

    rows.push({
      id: 'auto-preflight-blockers',
      source: 'auto',
      category: 'Technical',
      description: 'Pre-flight check blockers detected that prevent migration of some VMs without remediation.',
      impactArea: 'Migration Readiness',
      status,
      mitigationPlan: 'Review pre-flight check results and remediate blockers before migration.',
      evidenceDetail: details.join('; '),
    });
  }

  // --- Complexity ---
  const scores = calculateComplexityScores(activeVMs, rawData.vDisk, rawData.vNetwork, 'vsi');
  const summary = getAssessmentSummary(scores);

  if (summary.blockerCount > 0 || summary.complexCount > 0) {
    const blockerPct = (summary.blockerCount / (summary.totalVMs || 1)) * 100;
    const complexPct = ((summary.complexCount + summary.blockerCount) / (summary.totalVMs || 1)) * 100;
    const status: RiskStatus = blockerPct > 10 ? 'red' : complexPct > 30 ? 'red' : 'amber';

    rows.push({
      id: 'auto-complexity',
      source: 'auto',
      category: 'Technical',
      description: 'Complex or blocker-level VMs detected that require significant migration effort. Includes tightly coupled monoliths dependent on specific storage or network topology.',
      impactArea: 'Schedule / Effort',
      status,
      mitigationPlan: 'Prioritize simple VMs in early waves; plan dedicated effort for complex workloads.',
      evidenceDetail: `${summary.blockerCount} blockers, ${summary.complexCount} complex out of ${summary.totalVMs} VMs (avg score: ${summary.averageScore}/100)`,
    });
  }

  // --- Cost comparison ---
  const currentCost = costInput?.currentMonthlyCost;
  const roksCost = costInput?.calculatedROKSMonthlyCost;
  const vsiCost = costInput?.calculatedVSIMonthlyCost;

  if (currentCost != null && currentCost > 0 && (roksCost != null || vsiCost != null)) {
    const targetCost = Math.min(
      ...[roksCost, vsiCost].filter((c): c is number => c != null && c > 0)
    );
    const pctChange = ((targetCost - currentCost) / currentCost) * 100;

    let status: RiskStatus;
    if (pctChange <= 20) status = 'green';
    else if (pctChange <= 50) status = 'amber';
    else status = 'red';

    const direction = pctChange <= 0 ? 'savings' : 'increase';

    rows.push({
      id: 'auto-cost-comparison',
      source: 'auto',
      category: 'Financial',
      description: `Cloud cost ${direction} compared to current VMware spend.`,
      impactArea: 'Budget',
      status,
      mitigationPlan: pctChange > 20
        ? 'Review right-sizing opportunities and reserved capacity pricing to reduce costs.'
        : 'Monitor costs during migration to maintain projected savings.',
      evidenceDetail: `${Math.abs(pctChange).toFixed(1)}% ${direction} ($${currentCost.toLocaleString()}/mo current vs $${targetCost.toLocaleString()}/mo target)`,
    });
  }

  // --- OS compatibility ---
  const roksWarnings = roksChecks.filter(r => r.warningCount > 0).length;
  const vsiWarnings = vsiChecks.filter(r => r.warningCount > 0).length;
  const totalWarnings = Math.max(roksWarnings, vsiWarnings);

  if (totalWarnings > 0) {
    rows.push({
      id: 'auto-os-compatibility',
      source: 'auto',
      category: 'Technical',
      description: 'Some VMs have OS compatibility warnings that may require attention during migration.',
      impactArea: 'Migration Readiness',
      status: 'amber',
      mitigationPlan: 'Review OS compatibility report and plan OS upgrades or alternative migration paths.',
      evidenceDetail: `${totalWarnings} VMs with compatibility warnings`,
    });
  }

  // --- Large environment scale ---
  if (vmCount > 200) {
    rows.push({
      id: 'auto-scale',
      source: 'auto',
      category: 'Ops & Tooling',
      description: 'Large environment scale increases migration complexity and requires robust tooling and coordination.',
      impactArea: 'Schedule / Operations',
      status: vmCount > 500 ? 'red' : 'amber',
      mitigationPlan: 'Use automated migration tooling (RackWare, MTV). Plan multiple migration waves with dedicated resources.',
      evidenceDetail: `${vmCount} active VMs across ${new Set(activeVMs.map(vm => vm.cluster).filter(Boolean)).size} clusters`,
    });
  }

  // --- VMware license count ---
  const licenses = rawData.vLicense?.length ?? 0;
  if (licenses > 0) {
    rows.push({
      id: 'auto-vmware-licenses',
      source: 'auto',
      category: 'Financial',
      description: 'VMware licenses detected that need to be reviewed for portability and contract implications.',
      impactArea: 'Compliance / Cost',
      status: 'amber',
      mitigationPlan: 'Review VMware license contracts for termination terms and portability restrictions.',
      evidenceDetail: `${licenses} VMware license entries detected`,
    });
  }

  return rows;
}

// ===== CURATED RISKS =====

interface CuratedRiskEntry {
  id: string;
  category: string;
  description: string;
  impactArea: string;
  defaultStatus: string;
  mitigationPlan: string;
  evidenceDetail?: string;
}

export function loadCuratedRisks(): RiskRow[] {
  return (curatedRisksData as CuratedRiskEntry[]).map(entry => ({
    id: entry.id,
    source: 'curated' as const,
    category: entry.category as RiskRow['category'],
    description: entry.description,
    impactArea: entry.impactArea,
    status: entry.defaultStatus as RiskStatus,
    mitigationPlan: entry.mitigationPlan,
    evidenceDetail: entry.evidenceDetail ?? '',
  }));
}

// ===== MAIN BUILDER =====

export function buildRiskTable(
  rawData: RVToolsData | null,
  overrides?: RiskTableOverrides | null,
  costInput?: CostComparisonInput
): RiskTableData {
  const autoRisks = generateAutoRisks(rawData, costInput);
  const curatedRisks = loadCuratedRisks();
  const userRows = overrides?.userRows ?? [];

  // Merge all rows, filtering out deleted ones
  const deletedSet = new Set(overrides?.deletedRows ?? []);
  const allRows = [...autoRisks, ...curatedRisks, ...userRows].filter(r => !deletedSet.has(r.id));

  // Apply overrides (status and mitigation changes)
  const rowOverrides = overrides?.rowOverrides ?? {};
  const rows = allRows.map(row => {
    const override = rowOverrides[row.id];
    if (!override) return row;
    return {
      ...row,
      ...(override.status !== undefined ? { status: override.status } : {}),
      ...(override.mitigationPlan !== undefined ? { mitigationPlan: override.mitigationPlan } : {}),
      ...(override.category !== undefined ? { category: override.category } : {}),
      ...(override.description !== undefined ? { description: override.description } : {}),
      ...(override.impactArea !== undefined ? { impactArea: override.impactArea } : {}),
      ...(override.evidenceDetail !== undefined ? { evidenceDetail: override.evidenceDetail } : {}),
    };
  });

  return { rows };
}
