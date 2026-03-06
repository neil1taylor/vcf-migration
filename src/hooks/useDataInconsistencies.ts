import { useMemo } from 'react';
import { useData, useVMOverrides } from '@/hooks';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import {
  checkDataInconsistencies,
  type DataInconsistencyResult,
} from '@/services/dataInconsistencyChecks';

export function useDataInconsistencies(): DataInconsistencyResult {
  const { rawData } = useData();
  const vmOverrides = useVMOverrides();

  return useMemo(() => {
    if (!rawData) return { warnings: [], hasCritical: false };

    const vms = rawData.vInfo.filter((vm) => {
      if (vm.template || vm.powerState !== 'poweredOn') return false;
      const vmId = getVMIdentifier(vm);
      return !vmOverrides.isExcluded(vmId);
    });

    return checkDataInconsistencies(vms);
  }, [rawData, vmOverrides]);
}
