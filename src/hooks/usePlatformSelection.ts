import { useState, useCallback, useEffect, useMemo } from 'react';
import { useData } from './useData';
import { getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import factorsData from '@/data/platformSelectionFactors.json';

export type FactorAnswer = 'yes' | 'no' | 'not-sure';

export interface PlatformSelectionScore {
  vsiCount: number;
  roksCount: number;
  answeredCount: number;
  leaning: 'roks' | 'vsi' | 'neutral';
}

interface PlatformSelectionData {
  version: number;
  environmentFingerprint: string;
  answers: Record<string, FactorAnswer>;
  createdAt: string;
  modifiedAt: string;
}

const STORAGE_KEY = 'vcf-platform-selection';
const CURRENT_VERSION = 1;

function loadFromStorage(): PlatformSelectionData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PlatformSelectionData;
      if (parsed?.version === CURRENT_VERSION && parsed.answers) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function saveToStorage(data: PlatformSelectionData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

function createEmpty(fingerprint: string): PlatformSelectionData {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    environmentFingerprint: fingerprint,
    answers: {},
    createdAt: now,
    modifiedAt: now,
  };
}

export interface UsePlatformSelectionReturn {
  answers: Record<string, FactorAnswer>;
  setAnswer: (factorId: string, answer: FactorAnswer | null) => void;
  resetAll: () => void;
  score: PlatformSelectionScore;
}

export function usePlatformSelection(): UsePlatformSelectionReturn {
  const { rawData } = useData();

  const currentFingerprint = useMemo(() => {
    if (!rawData) return '';
    return getEnvironmentFingerprint(rawData);
  }, [rawData]);

  const [data, setData] = useState<PlatformSelectionData>(() => {
    const stored = loadFromStorage();
    if (stored && currentFingerprint && fingerprintsMatch(stored.environmentFingerprint, currentFingerprint)) {
      return stored;
    }
    return createEmpty(currentFingerprint);
  });

  // Re-sync when environment changes
  useEffect(() => {
    if (!currentFingerprint) return;
    const stored = loadFromStorage();
    if (stored && fingerprintsMatch(stored.environmentFingerprint, currentFingerprint)) {
      setData(stored);
    } else {
      const newData = createEmpty(currentFingerprint);
      setData(newData);
      saveToStorage(newData);
    }
  }, [currentFingerprint]);

  // Persist
  useEffect(() => {
    if (data.environmentFingerprint) {
      saveToStorage(data);
    }
  }, [data]);

  const setAnswer = useCallback((factorId: string, answer: FactorAnswer | null) => {
    setData(prev => {
      const now = new Date().toISOString();
      if (answer === null) {
        const { [factorId]: _, ...rest } = prev.answers;
        void _;
        return { ...prev, answers: rest, modifiedAt: now };
      }
      return { ...prev, answers: { ...prev.answers, [factorId]: answer }, modifiedAt: now };
    });
  }, []);

  const resetAll = useCallback(() => {
    setData(prev => ({
      ...prev,
      answers: {},
      modifiedAt: new Date().toISOString(),
    }));
  }, []);

  const score = useMemo((): PlatformSelectionScore => {
    let vsiCount = 0;
    let roksCount = 0;
    let answeredCount = 0;

    for (const factor of factorsData.factors) {
      const answer = data.answers[factor.id];
      if (answer === 'yes') {
        answeredCount++;
        if (factor.target === 'vsi') vsiCount++;
        else if (factor.target === 'roks') roksCount++;
      } else if (answer === 'no' || answer === 'not-sure') {
        answeredCount++;
      }
    }

    const leaning: 'roks' | 'vsi' | 'neutral' =
      vsiCount > roksCount ? 'vsi' :
      roksCount > vsiCount ? 'roks' :
      'neutral';

    return { vsiCount, roksCount, answeredCount, leaning };
  }, [data.answers]);

  return { answers: data.answers, setAnswer, resetAll, score };
}
