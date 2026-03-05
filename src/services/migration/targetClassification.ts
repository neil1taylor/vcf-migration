/**
 * Target Classification Service
 *
 * Classifies VMs into migration targets (ROKS or VSI) based on OS compatibility,
 * resource requirements, and workload type heuristics.
 */

import type { VirtualMachine } from '@/types/rvtools';
import { getROKSOSCompatibility, getVSIOSCompatibility } from './osCompatibility';
import { getVMIdentifier } from '@/utils/vmIdentifier';

// --- Types ---

export type MigrationTarget = 'roks' | 'vsi';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface VMClassification {
  vmId: string;
  vmName: string;
  target: MigrationTarget;
  reasons: string[];
  confidence: ConfidenceLevel;
}

export type RecommendationType = 'all-roks' | 'all-vsi' | 'split';

export interface ComparisonRecommendation {
  type: RecommendationType;
  title: string;
  reasoning: string[];
  roksPercentage: number;
  vsiPercentage: number;
}

// --- Constants ---

const MEMORY_THRESHOLD_MIB = 524288; // 512 GB in MiB

const LINUX_PATTERNS = [
  'linux',
  'ubuntu',
  'centos',
  'rhel',
  'red hat',
  'debian',
  'suse',
  'fedora',
  'oracle linux',
  'alma',
  'rocky',
];

const VSI_WORKLOAD_TYPES = [
  'database',
  'enterprise',
  'backup',
  'monitoring',
];

const ROKS_WORKLOAD_TYPES = [
  'middleware',
  'dev',
];

// --- Helpers ---

function isWindows(guestOS: string): boolean {
  return guestOS.toLowerCase().includes('windows');
}

function isLinux(guestOS: string): boolean {
  const osLower = guestOS.toLowerCase();
  return LINUX_PATTERNS.some(pattern => osLower.includes(pattern));
}

function isVSIWorkload(workloadType: string | undefined): boolean {
  if (!workloadType) return false;
  const lower = workloadType.toLowerCase();
  return VSI_WORKLOAD_TYPES.some(t => lower.includes(t));
}

function isROKSWorkload(workloadType: string | undefined, guestOS: string): boolean {
  if (!workloadType) return false;
  const lower = workloadType.toLowerCase();
  return ROKS_WORKLOAD_TYPES.some(t => lower.includes(t)) && isLinux(guestOS);
}

// --- Classification ---

/**
 * Classify a single VM into a migration target (ROKS or VSI).
 *
 * Heuristic priority:
 * 1. Windows OS → VSI (ROKS doesn't support Windows)
 * 2. ROKS unsupported + VSI supported → VSI
 * 3. VSI unsupported + ROKS supported → ROKS
 * 4. Memory >512GB → ROKS (bare metal)
 * 5. Workload type heuristics
 * 6. Linux default → ROKS
 * 7. Fallback → VSI
 */
export function classifyVMTarget(
  vm: VirtualMachine,
  workloadType?: string,
): VMClassification {
  const vmId = getVMIdentifier(vm);
  const reasons: string[] = [];

  // Rule 1: Windows → VSI
  if (isWindows(vm.guestOS)) {
    reasons.push('Windows OS is not supported on ROKS (OpenShift Virtualization)');
    return { vmId, vmName: vm.vmName, target: 'vsi', reasons, confidence: 'high' };
  }

  // Rule 2 & 3: OS compatibility cross-check
  const roksCompat = getROKSOSCompatibility(vm.guestOS);
  const vsiCompat = getVSIOSCompatibility(vm.guestOS);

  const roksUnsupported = roksCompat.compatibilityStatus === 'unsupported';
  const vsiUnsupported = vsiCompat.status === 'unsupported';
  const roksSupported = !roksUnsupported;
  const vsiSupported = !vsiUnsupported;

  // Rule 2: ROKS unsupported, VSI supported → VSI
  if (roksUnsupported && vsiSupported) {
    reasons.push(`OS "${vm.guestOS}" is unsupported on ROKS but supported on VSI`);
    return { vmId, vmName: vm.vmName, target: 'vsi', reasons, confidence: 'high' };
  }

  // Rule 3: VSI unsupported, ROKS supported → ROKS
  if (vsiUnsupported && roksSupported) {
    reasons.push(`OS "${vm.guestOS}" is unsupported on VSI but supported on ROKS`);
    return { vmId, vmName: vm.vmName, target: 'roks', reasons, confidence: 'high' };
  }

  // Rule 4: High memory → ROKS (bare metal)
  if (vm.memory > MEMORY_THRESHOLD_MIB) {
    const memGB = Math.round(vm.memory / 1024);
    reasons.push(`High memory (${memGB} GB) requires bare metal, best suited for ROKS`);
    return { vmId, vmName: vm.vmName, target: 'roks', reasons, confidence: 'medium' };
  }

  // Rule 5: Workload type heuristics
  if (isVSIWorkload(workloadType)) {
    reasons.push(`Workload type "${workloadType}" is typically better suited for VSI`);
    return { vmId, vmName: vm.vmName, target: 'vsi', reasons, confidence: 'medium' };
  }

  if (isROKSWorkload(workloadType, vm.guestOS)) {
    reasons.push(`Workload type "${workloadType}" on Linux is well suited for ROKS`);
    return { vmId, vmName: vm.vmName, target: 'roks', reasons, confidence: 'medium' };
  }

  // Rule 6: Linux default → ROKS
  if (isLinux(vm.guestOS)) {
    reasons.push('Linux workload defaults to ROKS (OpenShift Virtualization)');
    return { vmId, vmName: vm.vmName, target: 'roks', reasons, confidence: 'low' };
  }

  // Rule 7: Fallback → VSI
  reasons.push('Default classification: VSI (no specific ROKS indicators)');
  return { vmId, vmName: vm.vmName, target: 'vsi', reasons, confidence: 'low' };
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
    };
  }

  const roksCount = classifications.filter(c => c.target === 'roks').length;
  const vsiCount = classifications.filter(c => c.target === 'vsi').length;
  const total = classifications.length;
  const roksPercentage = Math.round((roksCount / total) * 100);
  const vsiPercentage = Math.round((vsiCount / total) * 100);

  const reasoning: string[] = [];

  // Check for >70% threshold
  if (roksPercentage > 70) {
    reasoning.push(`${roksPercentage}% of VMs are classified for ROKS`);
    if (roksCost <= vsiCost) {
      reasoning.push('ROKS is also the most cost-effective option');
    } else {
      reasoning.push(`VSI would be cheaper ($${vsiCost.toLocaleString()} vs $${roksCost.toLocaleString()}), but the workload mix strongly favors ROKS`);
    }
    return { type: 'all-roks', title: 'All ROKS Migration', reasoning, roksPercentage, vsiPercentage };
  }

  if (vsiPercentage > 70) {
    reasoning.push(`${vsiPercentage}% of VMs are classified for VSI`);
    if (vsiCost <= roksCost) {
      reasoning.push('VSI is also the most cost-effective option');
    } else {
      reasoning.push(`ROKS would be cheaper ($${roksCost.toLocaleString()} vs $${vsiCost.toLocaleString()}), but the workload mix strongly favors VSI`);
    }
    return { type: 'all-vsi', title: 'All VSI Migration', reasoning, roksPercentage, vsiPercentage };
  }

  // Split migration
  reasoning.push(`Mixed workload: ${roksPercentage}% ROKS, ${vsiPercentage}% VSI`);

  const minCost = Math.min(roksCost, vsiCost, splitCost);
  if (splitCost === minCost) {
    reasoning.push('Split migration is the most cost-effective approach');
  } else if (roksCost === minCost) {
    reasoning.push(`All-ROKS would be cheapest ($${roksCost.toLocaleString()}), but workload mix requires a split approach`);
  } else {
    reasoning.push(`All-VSI would be cheapest ($${vsiCost.toLocaleString()}), but workload mix requires a split approach`);
  }

  return { type: 'split', title: 'Split Migration', reasoning, roksPercentage, vsiPercentage };
}
