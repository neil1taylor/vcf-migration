// Pre-flight checks hook - delegates to canonical service for single source of truth

import { useMemo } from 'react';
import { getHardwareVersionNumber } from '@/utils/formatters';
import { HW_VERSION_MINIMUM, HW_VERSION_RECOMMENDED } from '@/utils/constants';
import {
  type MigrationMode,
  type PreflightCheckCounts,
  generateRemediationItems,
  countRemediationSeverity,
} from '@/services/migration';
import { runPreFlightChecks, derivePreflightCounts } from '@/services/preflightChecks';
import type { RemediationItem } from '@/components/common';
import type { RVToolsData } from '@/types/rvtools';

export interface UsePreflightChecksConfig {
  mode: MigrationMode;
  filteredRawData: RVToolsData;
  includeAllChecks?: boolean;
}

export interface UsePreflightChecksReturn {
  counts: PreflightCheckCounts;
  remediationItems: RemediationItem[];
  blockerCount: number;
  warningCount: number;
  hwVersionCounts: { recommended: number; supported: number; outdated: number };
}

/**
 * Hook for managing migration pre-flight checks.
 * Delegates to runPreFlightChecks() + derivePreflightCounts() — the same
 * canonical service used by PPTX, XLSX, DOCX, and the Pre-Flight Report page.
 */
export function usePreflightChecks(config: UsePreflightChecksConfig): UsePreflightChecksReturn {
  const { mode, filteredRawData, includeAllChecks = false } = config;

  const { counts, hwVersionCounts } = useMemo(() => {
    // Delegate to canonical service — single source of truth for all check evaluation
    const checkResults = runPreFlightChecks(filteredRawData, mode);
    const derivedCounts = derivePreflightCounts(checkResults, mode);

    // Static IP powered-off check: not in service (which only processes powered-on VMs)
    if (mode === 'roks') {
      const poweredOffWithIP = filteredRawData.vInfo.filter(
        vm => vm.powerState === 'poweredOff' && vm.guestIP
      );
      derivedCounts.vmsStaticIPPoweredOff = poweredOffWithIP.length;
      derivedCounts.vmsStaticIPPoweredOffList = poweredOffWithIP.map(vm => vm.vmName);
    }

    // Hardware version summary: UI-only aggregate not provided by the service
    const poweredOnVMs = filteredRawData.vInfo.filter(
      vm => vm.powerState === 'poweredOn' && !vm.template
    );
    const hwCounts = poweredOnVMs.reduce((acc, vm) => {
      const versionNum = getHardwareVersionNumber(vm.hardwareVersion);
      if (versionNum >= HW_VERSION_RECOMMENDED) acc.recommended++;
      else if (versionNum >= HW_VERSION_MINIMUM) acc.supported++;
      else acc.outdated++;
      return acc;
    }, { recommended: 0, supported: 0, outdated: 0 });

    return { counts: derivedCounts, hwVersionCounts: hwCounts };
  }, [filteredRawData, mode]);

  const remediationItems = useMemo(
    () => generateRemediationItems(counts, mode, includeAllChecks),
    [counts, mode, includeAllChecks]
  );

  const { blockers: blockerCount, warnings: warningCount } = useMemo(
    () => countRemediationSeverity(remediationItems),
    [remediationItems]
  );

  return { counts, remediationItems, blockerCount, warningCount, hwVersionCounts };
}

export default usePreflightChecks;
