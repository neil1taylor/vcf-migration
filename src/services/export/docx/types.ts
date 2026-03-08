// DOCX Generator Types and Constants

import { Paragraph, Table, AlignmentType, HeadingLevel } from 'docx';
import type { MigrationInsights } from '@/services/ai/types';
import type { RVToolsData } from '@/types/rvtools';
import type { RiskTableData, RiskTableOverrides } from '@/types/riskAssessment';
import type { TimelinePhase, TimelineConfig } from '@/types/timeline';
import type { VPCDesign, VPCDesignData } from '@/types/vpcDesign';
import type { PlatformSelectionScore, FactorAnswer } from '@/hooks/usePlatformSelection';
import type { SubnetOverridesData } from '@/hooks/useSubnetOverrides';
import { buildRiskTable } from '@/services/riskAssessment';
import { buildDefaultTimeline } from '@/services/migration/timelineEstimation';
import { calculateComplexityScores } from '@/services/migration/migrationAssessment';
import { buildVMWaveData, createComplexityWaves, createNetworkWaves } from '@/services/migration/wavePlanning';
import { buildVPCDesign } from '@/services/network/vpcDesignService';
import { getCachedBOM } from '@/services/bomCache';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import factorsData from '@/data/platformSelectionFactors.json';

// Type alias for document content elements
export type DocumentContent = Paragraph | Table;

export interface PlatformSelectionExport {
  score: PlatformSelectionScore;
  answers: Record<string, FactorAnswer>;
  roksMonthlyCost?: number | null;
  rovMonthlyCost?: number | null;
  vsiMonthlyCost?: number | null;
}

export interface WavePlanningPreference {
  wavePlanningMode: 'complexity' | 'network';
  networkGroupBy: 'cluster' | 'portGroup';
}

export interface DocxExportOptions {
  clientName?: string;
  preparedBy?: string;
  companyName?: string;
  includeROKS?: boolean;
  includeVSI?: boolean;
  includeCosts?: boolean;
  maxIssueVMs?: number;
  aiInsights?: MigrationInsights | null;
  riskAssessment?: RiskTableData | null;
  timelinePhases?: TimelinePhase[] | null;
  timelineStartDate?: Date;
  vpcDesign?: VPCDesign | null;
  wavePlanningPreference?: WavePlanningPreference | null;
  platformSelection?: PlatformSelectionExport | null;
  includeAppendices?: boolean;
}

export interface VMReadiness {
  vmName: string;
  cluster: string;
  guestOS: string;
  cpus: number;
  memoryGiB: number;
  storageGiB: number;
  hasBlocker: boolean;
  hasWarning: boolean;
  issues: string[];
}

export interface ROKSSizing {
  workerNodes: number;
  profileName: string;
  totalCores: number;
  totalThreads: number;
  totalMemoryGiB: number;
  totalNvmeTiB: number;
  odfUsableTiB: number;
  monthlyCost: number;
  cpuOvercommit: number;
}

export interface VSIMapping {
  vmName: string;
  sourceVcpus: number;
  sourceMemoryGiB: number;
  sourceStorageGiB: number;
  bootDiskGiB: number;
  dataDiskGiB: number;
  profile: string;
  profileVcpus: number;
  profileMemoryGiB: number;
  family: string;
  computeCost: number;
  bootStorageCost: number;
  dataStorageCost: number;
  storageCost: number;
  monthlyCost: number;
}

export interface NetworkWave {
  portGroup: string;
  vSwitch: string;
  vmCount: number;
  vcpus: number;
  memoryGiB: number;
  storageGiB: number;
  subnet: string;
}

export interface ChartData {
  label: string;
  value: number;
  color?: string;
}

// ===== STYLING CONSTANTS =====

export const FONT_FAMILY = 'IBM Plex Sans';

export const STYLES = {
  titleSize: 56,
  heading1Size: 32,
  heading2Size: 26,
  heading3Size: 22,
  bodySize: 22,
  smallSize: 20,
  primaryColor: '0f62fe', // IBM Blue
  secondaryColor: '393939',
  accentColor: '24a148', // Green
  warningColor: 'ff832b', // Orange
  errorColor: 'da1e28', // Red
  purpleColor: '8a3ffc', // Purple
  tealColor: '009d9a', // Teal
  magentaColor: 'ee5396', // Magenta
  cyanColor: '1192e8', // Cyan
  lightGray: 'f4f4f4',
  mediumGray: 'e0e0e0',
};

// Chart colors for visual consistency
export const CHART_COLORS = [
  '#0f62fe', // IBM Blue
  '#24a148', // Green
  '#8a3ffc', // Purple
  '#ff832b', // Orange
  '#009d9a', // Teal
  '#ee5396', // Magenta
  '#1192e8', // Cyan
  '#da1e28', // Red
];

// VSI Storage Configuration
export const BOOT_DISK_SIZE_GIB = 100;
export const BOOT_STORAGE_COST_PER_GB = 0.08;

export const DATA_STORAGE_TIER_DISTRIBUTION = {
  generalPurpose: 0.50,
  tier5iops: 0.30,
  tier10iops: 0.20,
};

export const DATA_STORAGE_COST_PER_GB =
  (DATA_STORAGE_TIER_DISTRIBUTION.generalPurpose * 0.08) +
  (DATA_STORAGE_TIER_DISTRIBUTION.tier5iops * 0.10) +
  (DATA_STORAGE_TIER_DISTRIBUTION.tier10iops * 0.13);

// ===== EXPORT READER FUNCTIONS =====
// Pure functions that read user inputs from localStorage for DOCX export
// without requiring React hooks.

/**
 * Compute platform selection score from answers (pure function).
 * Mirrors the scoring logic in usePlatformSelection hook.
 */
function computePlatformScore(
  answers: Record<string, FactorAnswer>,
  costData?: { roksMonthlyCost?: number | null; vsiMonthlyCost?: number | null }
): PlatformSelectionScore {
  let vsiCount = 0;
  let roksCount = 0;
  let answeredCount = 0;
  let costLeaning: 'vsi' | 'roks' | null = null;

  const roksCost = costData?.roksMonthlyCost;
  const vsiCost = costData?.vsiMonthlyCost;
  if (roksCost != null && vsiCost != null) {
    if (vsiCost < roksCost) costLeaning = 'vsi';
    else if (roksCost < vsiCost) costLeaning = 'roks';
  }

  for (const factor of factorsData.factors) {
    const answer = answers[factor.id];
    if (answer === 'yes') {
      answeredCount++;
      if (factor.target === 'vsi') {
        vsiCount++;
      } else if (factor.target === 'roks') {
        roksCount++;
      } else if (factor.target === 'dynamic' && (factor as { dynamicResolver?: string }).dynamicResolver === 'cost') {
        if (costLeaning === 'vsi') vsiCount++;
        else if (costLeaning === 'roks') roksCount++;
      }
    } else if (answer === 'no' || answer === 'no-preference') {
      answeredCount++;
    }
  }

  const leaning: 'roks' | 'vsi' | 'neutral' =
    vsiCount > roksCount ? 'vsi' :
    roksCount > vsiCount ? 'roks' :
    'neutral';

  let roksVariant: 'full' | 'rov' = 'full';
  if (leaning === 'roks' || (leaning === 'neutral' && roksCount > 0)) {
    const containerFactors = factorsData.factors.filter(
      (f: { containerRelated?: boolean }) => f.containerRelated
    );
    const hasContainerNeed = containerFactors.some(
      (f: { id: string }) => answers[f.id] === 'yes'
    );
    if (!hasContainerNeed) {
      roksVariant = 'rov';
    }
  }

  return { vsiCount, roksCount, answeredCount, leaning, costLeaning, roksVariant };
}

/**
 * Read platform selection data from localStorage and compute score.
 * Returns null if no answers have been recorded.
 */
export function getPlatformSelectionExport(rawData: RVToolsData | null): PlatformSelectionExport | null {
  try {
    const stored = localStorage.getItem('vcf-platform-selection');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!parsed?.version || !parsed.answers || Object.keys(parsed.answers).length === 0) return null;

    // Fingerprint check
    if (rawData && parsed.environmentFingerprint) {
      const fp = getEnvironmentFingerprint(rawData);
      if (!fingerprintsMatch(parsed.environmentFingerprint, fp)) return null;
    }

    const roksCache = getCachedBOM('roks');
    const vsiCache = getCachedBOM('vsi');
    const roksMonthlyCost = roksCache?.estimate?.totalMonthly ?? null;
    const vsiMonthlyCost = vsiCache?.estimate?.totalMonthly ?? null;

    const score = computePlatformScore(parsed.answers, { roksMonthlyCost, vsiMonthlyCost });

    return {
      score,
      answers: parsed.answers,
      roksMonthlyCost,
      vsiMonthlyCost,
      rovMonthlyCost: null, // ROV cost not separately cached
    };
  } catch { /* ignore */ }
  return null;
}

/**
 * Read risk assessment overrides from localStorage and build risk table.
 * Returns null if no overrides exist for the current environment.
 */
export function getRiskAssessmentExport(rawData: RVToolsData): RiskTableData | null {
  try {
    const stored = localStorage.getItem('vcf-risk-overrides');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed?.version !== 3 || !parsed.rowOverrides) return null;

    // Fingerprint check
    const fp = getEnvironmentFingerprint(rawData);
    if (parsed.environmentFingerprint && !fingerprintsMatch(parsed.environmentFingerprint, fp)) return null;

    return buildRiskTable(rawData, parsed as RiskTableOverrides);
  } catch { /* ignore */ }
  return null;
}

/**
 * Read timeline configuration from localStorage and build phases.
 * Returns null if unconfigured for the current environment.
 */
export function getTimelineExport(rawData: RVToolsData): { phases: TimelinePhase[]; startDate?: Date } | null {
  try {
    const stored = localStorage.getItem('vcf-timeline-config');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as TimelineConfig;
    if (!parsed?.version || !parsed.phaseDurations) return null;

    // Fingerprint check
    const fp = getEnvironmentFingerprint(rawData);
    if (parsed.environmentFingerprint && !fingerprintsMatch(parsed.environmentFingerprint, fp)) return null;

    // Compute wave data from raw data for accurate VM counts and storage sizes
    const wavePref = getWavePlanningPreference();
    let waveVmCounts: number[] | undefined;
    let waveNames: string[] | undefined;
    let waveStorageGiB: number[] | undefined;
    let waveCount = 3;

    if (wavePref) {
      const vms = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
      // Use 'roks' mode as default for timeline — the wave grouping is the same
      const complexityScores = calculateComplexityScores(vms, rawData.vDisk, rawData.vNetwork, 'roks');
      const vmWaveData = buildVMWaveData(
        vms, complexityScores, rawData.vDisk, rawData.vSnapshot, rawData.vTools, rawData.vNetwork, 'roks'
      );

      const waves = wavePref.wavePlanningMode === 'complexity'
        ? createComplexityWaves(vmWaveData, 'roks')
        : createNetworkWaves(vmWaveData, wavePref.networkGroupBy);

      // First wave becomes pilot, remaining become production waves
      waveVmCounts = waves.map(w => w.vmCount);
      waveNames = waves.map(w => w.name);
      waveStorageGiB = waves.map(w => w.storageGiB);
      waveCount = Math.max(1, waves.length - 1); // subtract pilot wave
    }

    const phases = buildDefaultTimeline(waveCount, parsed.phaseDurations, waveVmCounts, waveNames, waveStorageGiB);
    const startDate = parsed.startDate ? new Date(parsed.startDate) : undefined;

    return { phases, startDate };
  } catch { /* ignore */ }
  return null;
}

/**
 * Read VPC design from localStorage and rebuild.
 * Returns null if unconfigured for the current environment.
 */
export function getVPCDesignExport(rawData: RVToolsData): VPCDesign | null {
  try {
    const stored = localStorage.getItem('vcf-vpc-design');
    if (!stored) return null;
    const parsed = JSON.parse(stored) as VPCDesignData;
    if (!parsed?.version || !parsed.region) return null;

    // Fingerprint check
    const fp = getEnvironmentFingerprint(rawData);
    if (parsed.environmentFingerprint && !fingerprintsMatch(parsed.environmentFingerprint, fp)) return null;

    // Read subnet overrides
    const subnetMap: Record<string, string> = {};
    try {
      const subnetStored = localStorage.getItem('vcf-subnet-overrides');
      if (subnetStored) {
        const subnetData = JSON.parse(subnetStored) as SubnetOverridesData;
        if (subnetData?.overrides) {
          Object.values(subnetData.overrides).forEach(o => {
            if (o.subnet) subnetMap[o.portGroup] = o.subnet;
          });
        }
      }
    } catch { /* ignore */ }

    // Build simple workload map (same as NetworkDesignPage)
    const workloadMap: Record<string, string> = {};
    rawData.vInfo.forEach(vm => {
      workloadMap[vm.vmName] = 'Default';
    });

    return buildVPCDesign(rawData, parsed.region, subnetMap, workloadMap, parsed);
  } catch { /* ignore */ }
  return null;
}

/**
 * Read wave planning preference from localStorage.
 * Returns null if not set or invalid.
 */
export function getWavePlanningPreference(): WavePlanningPreference | null {
  try {
    const stored = localStorage.getItem('vcf-wave-planning-mode');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      (parsed.wavePlanningMode === 'complexity' || parsed.wavePlanningMode === 'network') &&
      (parsed.networkGroupBy === 'cluster' || parsed.networkGroupBy === 'portGroup')
    ) {
      return {
        wavePlanningMode: parsed.wavePlanningMode,
        networkGroupBy: parsed.networkGroupBy,
      };
    }
  } catch { /* ignore */ }
  return null;
}

// Re-export needed docx types for convenience
export { AlignmentType, HeadingLevel };
