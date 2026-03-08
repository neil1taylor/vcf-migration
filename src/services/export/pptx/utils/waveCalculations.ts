// Wave computation utility for PPTX export

import type { RVToolsData } from '@/types/rvtools';
import type { WavePlanningPreference } from '../../docx/types';
import type { WaveGroup, NetworkWaveGroup } from '@/services/migration/wavePlanning';
import { calculateComplexityScores } from '@/services/migration/migrationAssessment';
import { buildVMWaveData, createComplexityWaves, createNetworkWaves } from '@/services/migration/wavePlanning';

/**
 * Compute migration waves from raw data using the given preference.
 * Returns WaveGroup[] for complexity mode, NetworkWaveGroup[] for network mode.
 */
export function computeWavesForExport(
  rawData: RVToolsData,
  migrationMode: 'roks' | 'vsi',
  preference: WavePlanningPreference
): WaveGroup[] | NetworkWaveGroup[] {
  const vms = rawData.vInfo.filter(vm => vm.powerState === 'poweredOn' && !vm.template);
  const complexityScores = calculateComplexityScores(vms, rawData.vDisk, rawData.vNetwork, migrationMode);
  const vmWaveData = buildVMWaveData(
    vms, complexityScores, rawData.vDisk, rawData.vSnapshot, rawData.vTools, rawData.vNetwork, migrationMode
  );

  if (preference.wavePlanningMode === 'complexity') {
    return createComplexityWaves(vmWaveData, migrationMode);
  }
  return createNetworkWaves(vmWaveData, preference.networkGroupBy);
}

/**
 * Get a human-readable label for the wave planning strategy.
 */
export function getStrategyLabel(pref: WavePlanningPreference): string {
  if (pref.wavePlanningMode === 'complexity') return 'Complexity-Based';
  if (pref.networkGroupBy === 'cluster') return 'Network-Based (Cluster)';
  return 'Network-Based (Port Group)';
}
