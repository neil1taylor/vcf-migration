// Data reducer for state management
import type { RVToolsData, AnalysisResults } from '@/types';
import type { ClassicBillingData } from '@/services/billing/types';

// Chart filter for drill-down functionality
export interface ChartFilter {
  dimension: string;  // e.g., 'powerState', 'cluster', 'guestOS'
  value: string;      // e.g., 'poweredOn', 'Cluster-01'
  source: string;     // which chart triggered it
}

// Calculated cost totals for risk assessment cost comparison
export interface CalculatedCosts {
  roksMonthlyCost: number | null;
  rovMonthlyCost: number | null;
  vsiMonthlyCost: number | null;
}

// State interface
export interface DataState {
  rawData: RVToolsData | null;
  analysis: AnalysisResults | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  chartFilter: ChartFilter | null;
  calculatedCosts: CalculatedCosts | null;
  originalFileBuffer: ArrayBuffer | null;
  originalFileName: string | null;
  billingData: ClassicBillingData | null;
}

// Action types
export type DataAction =
  | { type: 'SET_RAW_DATA'; payload: RVToolsData }
  | { type: 'SET_ANALYSIS'; payload: AnalysisResults }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CHART_FILTER'; payload: ChartFilter | null }
  | { type: 'SET_CALCULATED_COSTS'; payload: CalculatedCosts }
  | { type: 'SET_ORIGINAL_FILE'; payload: { buffer: ArrayBuffer; fileName: string } }
  | { type: 'SET_BILLING_DATA'; payload: ClassicBillingData }
  | { type: 'CLEAR_BILLING_DATA' }
  | { type: 'CLEAR_DATA' };

// Initial state
export const initialState: DataState = {
  rawData: null,
  analysis: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  chartFilter: null,
  calculatedCosts: null,
  originalFileBuffer: null,
  originalFileName: null,
  billingData: null,
};

// Reducer function
export function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'SET_RAW_DATA':
      return {
        ...state,
        rawData: action.payload,
        lastUpdated: new Date(),
        error: null,
      };

    case 'SET_ANALYSIS':
      return {
        ...state,
        analysis: action.payload,
        isLoading: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'SET_CHART_FILTER':
      return {
        ...state,
        chartFilter: action.payload,
      };

    case 'SET_CALCULATED_COSTS':
      return {
        ...state,
        calculatedCosts: action.payload,
      };

    case 'SET_ORIGINAL_FILE':
      return {
        ...state,
        originalFileBuffer: action.payload.buffer,
        originalFileName: action.payload.fileName,
      };

    case 'SET_BILLING_DATA':
      return {
        ...state,
        billingData: action.payload,
      };

    case 'CLEAR_BILLING_DATA':
      return {
        ...state,
        billingData: null,
      };

    case 'CLEAR_DATA':
      return initialState;

    default:
      return state;
  }
}
