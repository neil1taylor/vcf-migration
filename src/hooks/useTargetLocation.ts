// Source Data Center Hook
// Manages source data center selection with localStorage persistence
// Maps DC codes to nearest IBM Cloud VPC MZR for pricing and network design

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import dcData from '@/data/ibmCloudDataCenters.json';
import type { RVToolsData } from '@/types/rvtools';

const STORAGE_KEY = 'vcf-target-location';
const CURRENT_VERSION = 2;
const DEFAULT_LOCATION = 'DAL10';

export interface MZROption {
  id: string;
  label: string;
}

export const MZR_OPTIONS: MZROption[] = [
  { id: 'us-south', label: 'Dallas (us-south)' },
  { id: 'us-east', label: 'Washington DC (us-east)' },
  { id: 'us-west', label: 'San Jose (us-west)' },
  { id: 'eu-gb', label: 'London (eu-gb)' },
  { id: 'eu-de', label: 'Frankfurt (eu-de)' },
  { id: 'eu-es', label: 'Madrid (eu-es)' },
  { id: 'br-sao', label: 'São Paulo (br-sao)' },
  { id: 'ca-tor', label: 'Toronto (ca-tor)' },
  { id: 'au-syd', label: 'Sydney (au-syd)' },
  { id: 'jp-tok', label: 'Tokyo (jp-tok)' },
  { id: 'jp-osa', label: 'Osaka (jp-osa)' },
];

export interface DataCenter {
  id: string;
  label: string;
  city: string | null;
  country: string | null;
  mzr: string | null;
  type: string;
}

export const DATA_CENTERS: DataCenter[] = dcData.dataCenters as DataCenter[];

interface TargetLocationData {
  version: number;
  environmentFingerprint: string;
  location: string;
  targetMzr: string | null;
  createdAt: string;
  modifiedAt: string;
}

// Keyword → DC mapping for best-guess (first DC in matched city)
const LOCATION_KEYWORDS: Array<{ keywords: RegExp; location: string }> = [
  { keywords: /dallas|dal\b/, location: 'DAL10' },
  { keywords: /washington|wdc|ashburn/, location: 'WDC04' },
  { keywords: /san jose|sjc/, location: 'SJC03' },
  { keywords: /london|lon\b/, location: 'LON04' },
  { keywords: /frankfurt|fra\b/, location: 'FRA02' },
  { keywords: /madrid|mad\b/, location: 'MAD02' },
  { keywords: /amsterdam|ams/, location: 'AMS03' },
  { keywords: /milan|mil\b/, location: 'MIL01' },
  { keywords: /paris|par\b/, location: 'PAR01' },
  { keywords: /tokyo|tok\b/, location: 'TOK02' },
  { keywords: /osaka|osa\b/, location: 'OSA21' },
  { keywords: /sydney|syd\b/, location: 'SYD01' },
  { keywords: /toronto|tor\b/, location: 'TOR01' },
  { keywords: /montreal|mon\b/, location: 'MON01' },
  { keywords: /sao paulo|sao\b|brazil/, location: 'SAO01' },
  { keywords: /chennai|che\b/, location: 'CHE01' },
  { keywords: /mumbai|mum\b/, location: 'MUM02' },
  { keywords: /singapore|sng/, location: 'SNG01' },
];

export function guessLocationFromData(rawData: RVToolsData): string {
  const strings: string[] = [];

  // Collect datacenter names from vInfo, vCluster, vHost
  for (const vm of rawData.vInfo) {
    if (vm.datacenter) strings.push(vm.datacenter);
  }
  for (const cluster of rawData.vCluster) {
    if (cluster.datacenter) strings.push(cluster.datacenter);
  }
  for (const host of rawData.vHost) {
    if (host.datacenter) strings.push(host.datacenter);
  }
  // Server names from vSource
  for (const source of rawData.vSource) {
    if (source.server) strings.push(source.server);
  }

  const combined = strings.join(' ').toLowerCase();

  for (const { keywords, location } of LOCATION_KEYWORDS) {
    if (keywords.test(combined)) return location;
  }

  return DEFAULT_LOCATION;
}

export function getTargetMZR(location: string): string | null {
  const dc = DATA_CENTERS.find(d => d.id === location);
  return dc?.mzr ?? null;
}

function getLocationLabel(location: string): string {
  const dc = DATA_CENTERS.find(d => d.id === location);
  return dc?.label ?? location;
}

function loadFromStorage(): TargetLocationData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.version && parsed?.location) {
        return parsed as TargetLocationData;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveToStorage(data: TargetLocationData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

function createNew(fingerprint: string, location: string): TargetLocationData {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    environmentFingerprint: fingerprint,
    location,
    targetMzr: getTargetMZR(location),
    createdAt: now,
    modifiedAt: now,
  };
}

function migrateData(data: TargetLocationData): TargetLocationData {
  if (data.version < 2) {
    return { ...data, version: 2, targetMzr: getTargetMZR(data.location) };
  }
  return data;
}

function resolveData(fingerprint: string, rawData: RVToolsData | null): TargetLocationData {
  if (!fingerprint) return createNew('', DEFAULT_LOCATION);
  const stored = loadFromStorage();
  if (stored && fingerprintsMatch(stored.environmentFingerprint, fingerprint)) {
    const migrated = migrateData(stored);
    if (migrated !== stored) saveToStorage(migrated);
    return migrated;
  }
  const guessed = rawData ? guessLocationFromData(rawData) : DEFAULT_LOCATION;
  const newData = createNew(fingerprint, guessed);
  saveToStorage(newData);
  return newData;
}

export interface UseTargetLocationReturn {
  location: string;
  setLocation: (location: string) => void;
  targetMzr: string | null;
  setTargetMzr: (mzr: string | null) => void;
  locationLabel: string;
}

export function useTargetLocation(): UseTargetLocationReturn {
  const { rawData } = useData();

  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  const [data, setData] = useState<TargetLocationData>(() =>
    resolveData(currentFingerprint, rawData)
  );

  // Re-sync when environment changes
  useEffect(() => {
    if (!currentFingerprint) return;
    const resolved = resolveData(currentFingerprint, rawData);
    setData(resolved); // eslint-disable-line react-hooks/set-state-in-effect -- sync localStorage on env change
  }, [currentFingerprint, rawData]);

  // Persist to localStorage when data changes
  useEffect(() => {
    if (data.environmentFingerprint) {
      saveToStorage(data);
    }
  }, [data]);

  const setLocation = useCallback((location: string) => {
    setData(prev => ({
      ...prev,
      location,
      targetMzr: getTargetMZR(location),
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const setTargetMzr = useCallback((mzr: string | null) => {
    setData(prev => ({
      ...prev,
      targetMzr: mzr,
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const locationLabel = useMemo(() => getLocationLabel(data.location), [data.location]);

  return { location: data.location, setLocation, targetMzr: data.targetMzr, setTargetMzr, locationLabel };
}
