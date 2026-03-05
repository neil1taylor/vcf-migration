// VPC Design Hook
// Manages VPC design state with localStorage persistence

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { useSubnetOverrides } from './useSubnetOverrides';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import { buildVPCDesign } from '@/services/network/vpcDesignService';
import type { VPCDesign, VPCDesignData, TransitGatewayConfig } from '@/types/vpcDesign';

const STORAGE_KEY = 'vcf-vpc-design';
const CURRENT_VERSION = 1;

function loadFromStorage(): VPCDesignData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.version) return parsed as VPCDesignData;
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveToStorage(data: VPCDesignData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

function createEmpty(fingerprint: string): VPCDesignData {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    environmentFingerprint: fingerprint,
    region: 'us-south',
    subnetOverrides: {},
    transitGateway: { enabled: false, connectionType: 'vpc', name: 'tgw-us-south' },
    createdAt: now,
    modifiedAt: now,
  };
}

function resolveData(fingerprint: string): VPCDesignData {
  if (!fingerprint) return createEmpty('');
  const stored = loadFromStorage();
  if (stored && fingerprintsMatch(stored.environmentFingerprint, fingerprint)) {
    return stored;
  }
  const newData = createEmpty(fingerprint);
  saveToStorage(newData);
  return newData;
}

export interface UseVPCDesignReturn {
  design: VPCDesign;
  region: string;
  setRegion: (region: string) => void;
  updateSubnetZone: (subnetId: string, zone: string) => void;
  updateSubnetCIDR: (subnetId: string, cidr: string) => void;
  updateSubnetName: (subnetId: string, name: string) => void;
  updateSubnetSG: (subnetId: string, sgId: string) => void;
  toggleTransitGateway: () => void;
  setTransitGatewayType: (type: TransitGatewayConfig['connectionType']) => void;
  regenerateDesign: () => void;
}

export function useVPCDesign(workloadMap: Record<string, string>): UseVPCDesignReturn {
  const { rawData } = useData();
  const { overrides: subnetOverridesData } = useSubnetOverrides();

  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  const [data, setData] = useState<VPCDesignData>(() => resolveData(currentFingerprint));

  // Re-sync when environment changes — same pattern as useRiskAssessment/useVMOverrides
  useEffect(() => {
    if (!currentFingerprint) return;
    const resolved = resolveData(currentFingerprint);
    setData(resolved); // eslint-disable-line react-hooks/set-state-in-effect -- sync localStorage on env change
  }, [currentFingerprint]);

  // Persist to localStorage when data changes
  useEffect(() => {
    if (data.environmentFingerprint) {
      saveToStorage(data);
    }
  }, [data]);

  // Convert subnet overrides from hook to simple map
  const subnetMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(subnetOverridesData).forEach(o => {
      if (o.subnet) map[o.portGroup] = o.subnet;
    });
    return map;
  }, [subnetOverridesData]);

  const design = useMemo(() => {
    return buildVPCDesign(rawData, data.region, subnetMap, workloadMap, data);
  }, [rawData, data, subnetMap, workloadMap]);

  const setRegion = useCallback((region: string) => {
    setData(prev => ({
      ...prev,
      region,
      transitGateway: { ...prev.transitGateway, name: `tgw-${region}` },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const updateSubnet = useCallback((subnetId: string, updates: Partial<{ cidr: string; zone: string; name: string; securityGroupId: string }>) => {
    setData(prev => ({
      ...prev,
      subnetOverrides: {
        ...prev.subnetOverrides,
        [subnetId]: { ...prev.subnetOverrides[subnetId], ...updates },
      },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const updateSubnetZone = useCallback((subnetId: string, zone: string) => updateSubnet(subnetId, { zone }), [updateSubnet]);
  const updateSubnetCIDR = useCallback((subnetId: string, cidr: string) => updateSubnet(subnetId, { cidr }), [updateSubnet]);
  const updateSubnetName = useCallback((subnetId: string, name: string) => updateSubnet(subnetId, { name }), [updateSubnet]);
  const updateSubnetSG = useCallback((subnetId: string, sgId: string) => updateSubnet(subnetId, { securityGroupId: sgId }), [updateSubnet]);

  const toggleTransitGateway = useCallback(() => {
    setData(prev => ({
      ...prev,
      transitGateway: { ...prev.transitGateway, enabled: !prev.transitGateway.enabled },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const setTransitGatewayType = useCallback((type: TransitGatewayConfig['connectionType']) => {
    setData(prev => ({
      ...prev,
      transitGateway: { ...prev.transitGateway, connectionType: type },
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const regenerateDesign = useCallback(() => {
    setData(prev => ({
      ...prev,
      subnetOverrides: {},
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  return {
    design,
    region: data.region,
    setRegion,
    updateSubnetZone,
    updateSubnetCIDR,
    updateSubnetName,
    updateSubnetSG,
    toggleTransitGateway,
    setTransitGatewayType,
    regenerateDesign,
  };
}
