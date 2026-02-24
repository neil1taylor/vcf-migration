// Guided tour state management with localStorage persistence
import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'vcf-guided-tour';
const TOTAL_STEPS = 5;

interface TourState {
  isOpen: boolean;
  currentStep: number;
  isDetailed: boolean;
  completed: boolean;
}

export interface UseTourReturn {
  state: TourState;
  openTour: () => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (n: number) => void;
  toggleMode: () => void;
  resetTour: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  totalSteps: number;
}

function loadCompleted(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return !!parsed.completed;
    }
  } catch { /* ignore */ }
  return false;
}

function saveCompleted(completed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed }));
  } catch { /* ignore */ }
}

export function useTour(): UseTourReturn {
  const [state, setState] = useState<TourState>(() => ({
    isOpen: false,
    currentStep: 0,
    isDetailed: false,
    completed: loadCompleted(),
  }));

  const openTour = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true, currentStep: 0, isDetailed: false }));
  }, []);

  const closeTour = useCallback(() => {
    setState(prev => {
      saveCompleted(true);
      return { ...prev, isOpen: false, completed: true };
    });
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep >= TOTAL_STEPS - 1) {
        saveCompleted(true);
        return { ...prev, isOpen: false, completed: true };
      }
      return { ...prev, currentStep: prev.currentStep + 1 };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(0, prev.currentStep - 1),
    }));
  }, []);

  const goToStep = useCallback((n: number) => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(0, Math.min(TOTAL_STEPS - 1, n)),
    }));
  }, []);

  const toggleMode = useCallback(() => {
    setState(prev => ({ ...prev, isDetailed: !prev.isDetailed }));
  }, []);

  const resetTour = useCallback(() => {
    saveCompleted(false);
    setState(prev => ({ ...prev, completed: false }));
  }, []);

  const isFirstStep = state.currentStep === 0;
  const isLastStep = state.currentStep === TOTAL_STEPS - 1;

  return useMemo(() => ({
    state,
    openTour,
    closeTour,
    nextStep,
    prevStep,
    goToStep,
    toggleMode,
    resetTour,
    isFirstStep,
    isLastStep,
    totalSteps: TOTAL_STEPS,
  }), [state, openTour, closeTour, nextStep, prevStep, goToStep, toggleMode, resetTour, isFirstStep, isLastStep]);
}
