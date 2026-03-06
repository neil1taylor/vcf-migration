// Diagnostic bundle builder — assembles anonymized diagnostic info for troubleshooting

import { getLogEntries, type LogEntry } from '@/utils/logBuffer';
import { getPricingSource } from '@/services/pricing/pricingCache';
import { isProxyConfigured } from '@/services/pricing/globalCatalogApi';
import { isProfilesProxyConfigured } from '@/services/ibmCloudProfilesApi';
import { getAIEnabled } from '@/hooks/useAISettings';

// ===== TYPES =====

export interface DiagnosticBundle {
  generatedAt: string;
  appVersion: string;
  logs: LogEntry[];
  environment: {
    buildTime: string;
    userAgent: string;
    currentUrl: string;
    pricingSource: string;
    pricingProxyConfigured: boolean;
    profilesProxyConfigured: boolean;
    aiProxyConfigured: boolean;
    aiEnabled: boolean;
  };
  stateSnapshot: {
    vmCount: number;
    excludedVMCount: number;
    loadedSheets: string[];
    selectedRegion: string | null;
    selectedDiscountType: string | null;
  };
}

export interface DiagnosticStateInput {
  vmCount: number;
  excludedVMCount: number;
  loadedSheets: string[];
  selectedRegion?: string | null;
  selectedDiscountType?: string | null;
}

// ===== SENSITIVE KEY FILTERING =====

const SENSITIVE_KEYS = new Set([
  'ip', 'ipaddress', 'uuid', 'vmname', 'name', 'apikey', 'url', 'proxy',
  'hostname', 'host', 'dns', 'fqdn', 'password', 'token', 'secret', 'key',
]);

export function sanitizeContext(context: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[redacted]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ===== BUNDLE BUILDER =====

export function buildDiagnosticBundle(stateInput: DiagnosticStateInput): DiagnosticBundle {
  const logs = getLogEntries().map(entry => ({
    ...entry,
    context: sanitizeContext(entry.context),
  }));

  const aiProxyConfigured = Boolean(
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_AI_PROXY_URL
  );

  return {
    generatedAt: new Date().toISOString(),
    appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
    logs,
    environment: {
      buildTime: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'unknown',
      userAgent: navigator.userAgent,
      currentUrl: window.location.href,
      pricingSource: getPricingSource(),
      pricingProxyConfigured: isProxyConfigured(),
      profilesProxyConfigured: isProfilesProxyConfigured(),
      aiProxyConfigured,
      aiEnabled: getAIEnabled(),
    },
    stateSnapshot: {
      vmCount: stateInput.vmCount,
      excludedVMCount: stateInput.excludedVMCount,
      loadedSheets: stateInput.loadedSheets,
      selectedRegion: stateInput.selectedRegion ?? null,
      selectedDiscountType: stateInput.selectedDiscountType ?? null,
    },
  };
}

// ===== DOWNLOAD =====

export function downloadDiagnosticBundle(bundle: DiagnosticBundle): void {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const link = document.createElement('a');
  link.href = url;
  link.download = `vcf-diagnostics-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
