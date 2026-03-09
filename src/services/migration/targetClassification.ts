/**
 * Target Classification Service
 *
 * Data-driven rule engine that classifies VMs into migration targets.
 * Rules are defined in src/data/targetClassificationRules.json and evaluated in
 * priority order. Currently handles PowerVS routing for Oracle/SAP workloads,
 * with all other VMs falling back to VSI (platform leaning is applied by the
 * useTargetAssignments hook at a higher level).
 */

import type { VirtualMachine } from '@/types/rvtools';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import rulesData from '@/data/targetClassificationRules.json';

// --- Types ---

export type MigrationTarget = 'roks' | 'vsi' | 'powervs';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface VMClassification {
  vmId: string;
  vmName: string;
  target: MigrationTarget;
  reasons: string[];
  confidence: ConfidenceLevel;
}

export type RecommendationType = 'all-roks' | 'all-vsi' | 'all-powervs' | 'split';

export interface ComparisonRecommendation {
  type: RecommendationType;
  title: string;
  reasoning: string[];
  roksPercentage: number;
  vsiPercentage: number;
  powervsPercentage: number;
}

interface ClassificationRule {
  id: string;
  priority: number;
  type: string;
  target: MigrationTarget;
  confidence: ConfidenceLevel;
  reasonTemplate: string;
  // workload-type
  workloadTypes?: string[];
  namePatterns?: string[];
}

// --- Rule Engine ---

const sortedRules: ClassificationRule[] = [...rulesData.rules]
  .sort((a, b) => a.priority - b.priority) as ClassificationRule[];

function interpolateReason(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function evaluateRule(
  rule: ClassificationRule,
  vm: VirtualMachine,
  workloadType: string | undefined,
): string | null {
  switch (rule.type) {
    case 'workload-type': {
      if (!workloadType || !rule.workloadTypes) return null;
      const lower = workloadType.toLowerCase();
      const typeMatches = rule.workloadTypes.some(t => lower.includes(t));
      if (!typeMatches) return null;

      if (rule.namePatterns) {
        const vmNameLower = vm.vmName.toLowerCase();
        const nameMatches = rule.namePatterns.some(p => vmNameLower.includes(p));
        if (!nameMatches) return null;
      }

      return interpolateReason(rule.reasonTemplate, { workloadType });
    }

    case 'fallback': {
      return interpolateReason(rule.reasonTemplate, { guestOS: vm.guestOS });
    }

    default:
      return null;
  }
}

// --- Classification ---

/**
 * Classify a single VM into a migration target.
 *
 * Evaluates data-driven rules from targetClassificationRules.json in priority order.
 * The first matching rule determines the classification. Currently routes Oracle/SAP
 * to PowerVS; everything else falls back to VSI. Platform leaning (ROKS vs VSI) is
 * applied at the hook level by useTargetAssignments.
 */
export function classifyVMTarget(
  vm: VirtualMachine,
  workloadType?: string,
): VMClassification {
  const vmId = getVMIdentifier(vm);

  for (const rule of sortedRules) {
    const reason = evaluateRule(rule, vm, workloadType);
    if (reason !== null) {
      return {
        vmId,
        vmName: vm.vmName,
        target: rule.target,
        reasons: [reason],
        confidence: rule.confidence,
      };
    }
  }

  // Should never reach here if fallback rule exists
  return {
    vmId,
    vmName: vm.vmName,
    target: 'vsi',
    reasons: ['Assigned based on platform recommendation'],
    confidence: 'low',
  };
}

/**
 * Classify all VMs into migration targets.
 *
 * @param vms - Array of VirtualMachine objects
 * @param workloadTypes - Map of vmId → workload type string
 */
export function classifyAllVMs(
  vms: VirtualMachine[],
  workloadTypes: Map<string, string>,
): VMClassification[] {
  return vms.map(vm => {
    const vmId = getVMIdentifier(vm);
    const workloadType = workloadTypes.get(vmId);
    return classifyVMTarget(vm, workloadType);
  });
}

/**
 * Generate a migration recommendation based on VM classifications and cost data.
 *
 * Logic:
 * - >70% one target → recommend that target
 * - Otherwise → split migration
 * - Cost comparison used as tiebreaker/supporting evidence
 */
export function getRecommendation(
  classifications: VMClassification[],
  roksCost: number,
  vsiCost: number,
  splitCost: number,
): ComparisonRecommendation {
  if (classifications.length === 0) {
    return {
      type: 'split',
      title: 'Split Migration',
      reasoning: ['No VMs to classify'],
      roksPercentage: 0,
      vsiPercentage: 0,
      powervsPercentage: 0,
    };
  }

  const roksCount = classifications.filter(c => c.target === 'roks').length;
  const vsiCount = classifications.filter(c => c.target === 'vsi').length;
  const powervsCount = classifications.filter(c => c.target === 'powervs').length;
  const total = classifications.length;
  const roksPercentage = Math.round((roksCount / total) * 100);
  const vsiPercentage = Math.round((vsiCount / total) * 100);
  const powervsPercentage = Math.round((powervsCount / total) * 100);

  const reasoning: string[] = [];

  // Check for >70% threshold
  if (roksPercentage > 70) {
    reasoning.push(`${roksPercentage}% of VMs are classified for ROKS`);
    if (roksCost <= vsiCost) {
      reasoning.push('ROKS is also the most cost-effective option');
    } else {
      reasoning.push(`VSI would be cheaper ($${vsiCost.toLocaleString()} vs $${roksCost.toLocaleString()}), but the workload mix strongly favors ROKS`);
    }
    return { type: 'all-roks', title: 'All ROKS Migration', reasoning, roksPercentage, vsiPercentage, powervsPercentage };
  }

  if (vsiPercentage > 70) {
    reasoning.push(`${vsiPercentage}% of VMs are classified for VSI`);
    if (vsiCost <= roksCost) {
      reasoning.push('VSI is also the most cost-effective option');
    } else {
      reasoning.push(`ROKS would be cheaper ($${roksCost.toLocaleString()} vs $${vsiCost.toLocaleString()}), but the workload mix strongly favors VSI`);
    }
    return { type: 'all-vsi', title: 'All VSI Migration', reasoning, roksPercentage, vsiPercentage, powervsPercentage };
  }

  if (powervsPercentage > 70) {
    reasoning.push(`${powervsPercentage}% of VMs are classified for PowerVS`);
    reasoning.push('Workload mix strongly favors IBM Power Virtual Server');
    return { type: 'all-powervs', title: 'All PowerVS Migration', reasoning, roksPercentage, vsiPercentage, powervsPercentage };
  }

  // Split migration
  reasoning.push(`Mixed workload: ${roksPercentage}% ROKS, ${vsiPercentage}% VSI, ${powervsPercentage}% PowerVS`);

  const minCost = Math.min(roksCost, vsiCost, splitCost);
  if (splitCost === minCost) {
    reasoning.push('Split migration is the most cost-effective approach');
  } else if (roksCost === minCost) {
    reasoning.push(`All-ROKS would be cheapest ($${roksCost.toLocaleString()}), but workload mix requires a split approach`);
  } else {
    reasoning.push(`All-VSI would be cheapest ($${vsiCost.toLocaleString()}), but workload mix requires a split approach`);
  }

  return { type: 'split', title: 'Split Migration', reasoning, roksPercentage, vsiPercentage, powervsPercentage };
}
