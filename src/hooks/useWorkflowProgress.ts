// Tracks workflow step completion for the guided migration flow
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from './useData';
import { getEnvironmentFingerprint } from '@/utils/vmIdentifier';
import { ROUTES } from '@/utils/constants';

const STORAGE_KEY = 'vcf-workflow-progress';

export interface WorkflowProgress {
  upload: boolean;
  review: boolean;
  prepare: boolean;
  migrate: boolean;
  export: boolean;
}

interface StoredProgress {
  fingerprint: string;
  progress: WorkflowProgress;
}

const EMPTY_PROGRESS: WorkflowProgress = {
  upload: false,
  review: false,
  prepare: false,
  migrate: false,
  export: false,
};

// Map routes to workflow steps
const routeToStep: Record<string, keyof WorkflowProgress> = {
  [ROUTES.dashboard]: 'review',
  [ROUTES.discovery]: 'prepare',
  [ROUTES.roksMigration]: 'migrate',
  [ROUTES.vsiMigration]: 'migrate',
  [ROUTES.export]: 'export',
};

// Map steps to step indices
const stepIndex: Record<keyof WorkflowProgress, number> = {
  upload: 0,
  review: 1,
  prepare: 2,
  migrate: 3,
  export: 4,
};

export function useWorkflowProgress() {
  const location = useLocation();
  const { rawData } = useData();

  const fingerprint = useMemo(
    () => (rawData ? getEnvironmentFingerprint(rawData) : null),
    [rawData],
  );

  const [progress, setProgress] = useState<WorkflowProgress>(() => {
    if (!fingerprint) return EMPTY_PROGRESS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredProgress = JSON.parse(stored);
        if (parsed.fingerprint === fingerprint) {
          return { ...parsed.progress, upload: true };
        }
      }
    } catch { /* ignore */ }
    return { ...EMPTY_PROGRESS, upload: true };
  });

  // Clean up stale localStorage key from previous version
  try { localStorage.removeItem('vcf-workflow-stepper-visible'); } catch { /* ignore */ }

  // Reset progress when fingerprint changes (new data uploaded)
  // Syncing state from localStorage — setState in effect is intentional
  useEffect(() => {
    if (!fingerprint) {
      setProgress(EMPTY_PROGRESS); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredProgress = JSON.parse(stored);
        if (parsed.fingerprint === fingerprint) {
          setProgress({ ...parsed.progress, upload: true });
          return;
        }
      }
    } catch { /* ignore */ }

    setProgress({ ...EMPTY_PROGRESS, upload: true });
  }, [fingerprint]);

  // Track page visits — syncing route changes to localStorage
  useEffect(() => {
    if (!fingerprint) return;
    const step = routeToStep[location.pathname];
    if (!step) return;

    setProgress(prev => { // eslint-disable-line react-hooks/set-state-in-effect
      if (prev[step]) return prev; // Already visited
      const updated = { ...prev, [step]: true };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          fingerprint,
          progress: updated,
        }));
      } catch { /* ignore */ }
      return updated;
    });
  }, [location.pathname, fingerprint]);

  // Mark export step complete (can be called from export actions)
  const markExportComplete = useCallback(() => {
    if (!fingerprint) return;
    setProgress(prev => {
      if (prev.export) return prev;
      const updated = { ...prev, export: true };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          fingerprint,
          progress: updated,
        }));
      } catch { /* ignore */ }
      return updated;
    });
  }, [fingerprint]);

  // Determine current step based on route
  const currentStep = useMemo(() => {
    const step = routeToStep[location.pathname];
    if (step) return stepIndex[step];
    if (location.pathname === ROUTES.home) return 0;
    return -1; // Not on a workflow page
  }, [location.pathname]);

  return {
    progress,
    currentStep,
    markExportComplete,
    hasData: !!rawData,
  };
}
