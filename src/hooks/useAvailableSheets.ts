// Hook to derive which RVTools sheets are available from parsed data
import { useMemo } from 'react';
import { useData } from './useData';

export interface AvailableSheets {
  hasVDisk: boolean;
  hasVDatastore: boolean;
  hasVNetwork: boolean;
  hasVHost: boolean;
  hasVCluster: boolean;
  hasVSnapshot: boolean;
  hasVTools: boolean;
}

export function useAvailableSheets(): AvailableSheets {
  const { rawData } = useData();

  return useMemo(() => ({
    hasVDisk: (rawData?.vDisk?.length ?? 0) > 0,
    hasVDatastore: (rawData?.vDatastore?.length ?? 0) > 0,
    hasVNetwork: (rawData?.vNetwork?.length ?? 0) > 0,
    hasVHost: (rawData?.vHost?.length ?? 0) > 0,
    hasVCluster: (rawData?.vCluster?.length ?? 0) > 0,
    hasVSnapshot: (rawData?.vSnapshot?.length ?? 0) > 0,
    hasVTools: (rawData?.vTools?.length ?? 0) > 0,
  }), [rawData]);
}
