// VPC Design Hook
// Manages VPC design state with localStorage persistence

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { useSubnetOverrides } from './useSubnetOverrides';
import { useTargetLocation } from './useTargetLocation';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import { buildVPCDesign } from '@/services/network/vpcDesignService';
import type { VPCDesign, VPCDesignData, TransitGatewayConfig, TransitGatewayConnection } from '@/types/vpcDesign';
import { IBM_CLOUD_REGIONS } from '@/types/vpcDesign';

const STORAGE_KEY = 'vcf-vpc-design';
const CURRENT_VERSION = 2;

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
    transitGateways: [],
    createdAt: now,
    modifiedAt: now,
  };
}

// Migrate old single transitGateway to transitGateways array
function migrateStoredData(stored: VPCDesignData & { transitGateway?: { enabled: boolean; connectionType: string; name: string } }): VPCDesignData {
  if (stored.transitGateway && !stored.transitGateways) {
    const old = stored.transitGateway;
    const migrated: VPCDesignData = {
      ...stored,
      version: CURRENT_VERSION,
      transitGateways: old.enabled
        ? [{
            id: 'tgw-0',
            name: old.name,
            enabled: true,
            connections: [{
              id: 'conn-0',
              connectionType: old.connectionType as TransitGatewayConnection['connectionType'],
              name: `conn-${old.connectionType}`,
            }],
          }]
        : [],
    };
    delete (migrated as unknown as Record<string, unknown>).transitGateway;
    return migrated;
  }
  return stored;
}

function resolveData(fingerprint: string): VPCDesignData {
  if (!fingerprint) return createEmpty('');
  const stored = loadFromStorage();
  if (stored && fingerprintsMatch(stored.environmentFingerprint, fingerprint)) {
    return migrateStoredData(stored);
  }
  const newData = createEmpty(fingerprint);
  saveToStorage(newData);
  return newData;
}

let nextGatewayCounter = 0;
let nextConnectionCounter = 0;

export interface UseVPCDesignReturn {
  design: VPCDesign;
  region: string;
  setRegion: (region: string) => void;
  updateSubnetZone: (subnetId: string, zone: string) => void;
  updateSubnetCIDR: (subnetId: string, cidr: string) => void;
  updateSubnetName: (subnetId: string, name: string) => void;
  updateSubnetSG: (subnetId: string, sgId: string) => void;
  addTransitGateway: () => void;
  removeTransitGateway: (id: string) => void;
  updateTransitGateway: (id: string, updates: Partial<Pick<TransitGatewayConfig, 'name' | 'enabled'>>) => void;
  addConnection: (gwId: string) => void;
  removeConnection: (gwId: string, connId: string) => void;
  updateConnection: (gwId: string, connId: string, updates: Partial<Pick<TransitGatewayConnection, 'connectionType' | 'name'>>) => void;
  regenerateDesign: () => void;
}

export function useVPCDesign(workloadMap: Record<string, string>): UseVPCDesignReturn {
  const { rawData } = useData();
  const { overrides: subnetOverridesData } = useSubnetOverrides();
  const { targetMzr } = useTargetLocation();

  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  const [data, setData] = useState<VPCDesignData>(() => resolveData(currentFingerprint));

  // Re-sync when environment changes
  useEffect(() => {
    if (!currentFingerprint) return;
    const resolved = resolveData(currentFingerprint);
    setData(resolved);
  }, [currentFingerprint]);

  // Sync region when Discovery MZR changes
  const validRegionIds: string[] = IBM_CLOUD_REGIONS.map(r => r.id);
  useEffect(() => {
    if (targetMzr && validRegionIds.includes(targetMzr)) {
      setData(prev => ({
        ...prev,
        region: targetMzr,
        modifiedAt: new Date().toISOString(),
      }));
    }
  }, [targetMzr]); // eslint-disable-line react-hooks/exhaustive-deps -- validRegionIds is stable

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

  const addTransitGateway = useCallback(() => {
    const id = `tgw-${Date.now()}-${nextGatewayCounter++}`;
    setData(prev => ({
      ...prev,
      transitGateways: [
        ...prev.transitGateways,
        { id, name: `tgw-${prev.region}-${prev.transitGateways.length + 1}`, enabled: true, connections: [] },
      ],
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const removeTransitGateway = useCallback((id: string) => {
    setData(prev => ({
      ...prev,
      transitGateways: prev.transitGateways.filter(gw => gw.id !== id),
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const updateTransitGateway = useCallback((id: string, updates: Partial<Pick<TransitGatewayConfig, 'name' | 'enabled'>>) => {
    setData(prev => ({
      ...prev,
      transitGateways: prev.transitGateways.map(gw =>
        gw.id === id ? { ...gw, ...updates } : gw
      ),
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const addConnection = useCallback((gwId: string) => {
    const connId = `conn-${Date.now()}-${nextConnectionCounter++}`;
    setData(prev => ({
      ...prev,
      transitGateways: prev.transitGateways.map(gw =>
        gw.id === gwId
          ? { ...gw, connections: [...gw.connections, { id: connId, connectionType: 'vpc' as const, name: `conn-vpc-${gw.connections.length + 1}` }] }
          : gw
      ),
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const removeConnection = useCallback((gwId: string, connId: string) => {
    setData(prev => ({
      ...prev,
      transitGateways: prev.transitGateways.map(gw =>
        gw.id === gwId
          ? { ...gw, connections: gw.connections.filter(c => c.id !== connId) }
          : gw
      ),
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const updateConnection = useCallback((gwId: string, connId: string, updates: Partial<Pick<TransitGatewayConnection, 'connectionType' | 'name'>>) => {
    setData(prev => ({
      ...prev,
      transitGateways: prev.transitGateways.map(gw =>
        gw.id === gwId
          ? { ...gw, connections: gw.connections.map(c => c.id === connId ? { ...c, ...updates } : c) }
          : gw
      ),
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
    addTransitGateway,
    removeTransitGateway,
    updateTransitGateway,
    addConnection,
    removeConnection,
    updateConnection,
    regenerateDesign,
  };
}
