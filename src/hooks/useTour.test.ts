import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTour } from './useTour';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useTour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('returns default state when no localStorage data', () => {
    const { result } = renderHook(() => useTour());
    expect(result.current.state).toEqual({
      isOpen: false,
      currentStep: 0,
      isDetailed: false,
      completed: false,
    });
    expect(result.current.totalSteps).toBe(5);
    expect(result.current.isFirstStep).toBe(true);
    expect(result.current.isLastStep).toBe(false);
  });

  it('loads completed flag from localStorage', () => {
    localStorageMock.setItem('vcf-guided-tour', JSON.stringify({ completed: true }));
    const { result } = renderHook(() => useTour());
    expect(result.current.state.completed).toBe(true);
  });

  it('opens tour at step 0', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.currentStep).toBe(0);
  });

  it('resets to step 0 and brief mode when opening', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.nextStep(); });
    act(() => { result.current.toggleMode(); });
    act(() => { result.current.closeTour(); });
    act(() => { result.current.openTour(); });
    expect(result.current.state.currentStep).toBe(0);
    expect(result.current.state.isDetailed).toBe(false);
  });

  it('closes tour and marks completed', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.closeTour(); });
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.completed).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'vcf-guided-tour',
      JSON.stringify({ completed: true }),
    );
  });

  it('advances to next step', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.nextStep(); });
    expect(result.current.state.currentStep).toBe(1);
    expect(result.current.isFirstStep).toBe(false);
  });

  it('closes tour when advancing past last step', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    // Advance to last step
    for (let i = 0; i < 4; i++) {
      act(() => { result.current.nextStep(); });
    }
    expect(result.current.isLastStep).toBe(true);
    // One more should close
    act(() => { result.current.nextStep(); });
    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.completed).toBe(true);
  });

  it('goes back to previous step', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.nextStep(); });
    act(() => { result.current.nextStep(); });
    act(() => { result.current.prevStep(); });
    expect(result.current.state.currentStep).toBe(1);
  });

  it('does not go below step 0', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.prevStep(); });
    expect(result.current.state.currentStep).toBe(0);
  });

  it('goToStep navigates to a specific step', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.goToStep(3); });
    expect(result.current.state.currentStep).toBe(3);
  });

  it('goToStep clamps to valid range', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.goToStep(99); });
    expect(result.current.state.currentStep).toBe(4);
    act(() => { result.current.goToStep(-5); });
    expect(result.current.state.currentStep).toBe(0);
  });

  it('toggles between brief and detailed mode', () => {
    const { result } = renderHook(() => useTour());
    expect(result.current.state.isDetailed).toBe(false);
    act(() => { result.current.toggleMode(); });
    expect(result.current.state.isDetailed).toBe(true);
    act(() => { result.current.toggleMode(); });
    expect(result.current.state.isDetailed).toBe(false);
  });

  it('resetTour clears completed flag', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.closeTour(); });
    expect(result.current.state.completed).toBe(true);
    act(() => { result.current.resetTour(); });
    expect(result.current.state.completed).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'vcf-guided-tour',
      JSON.stringify({ completed: false }),
    );
  });

  it('handles corrupted localStorage data gracefully', () => {
    localStorageMock.setItem('vcf-guided-tour', 'not-json');
    const { result } = renderHook(() => useTour());
    expect(result.current.state.completed).toBe(false);
  });

  it('isLastStep is true on the last step', () => {
    const { result } = renderHook(() => useTour());
    act(() => { result.current.openTour(); });
    act(() => { result.current.goToStep(4); });
    expect(result.current.isLastStep).toBe(true);
    expect(result.current.isFirstStep).toBe(false);
  });
});
