// Centralized default filename generation for all export types

export interface FilenameContext {
  sourceFileName?: string;
  region?: string;
  mode?: string; // 'roks' | 'vsi'
  wavePlanningMode?: 'network' | 'complexity';
  networkGroupBy?: string;
}

function getDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getBaseName(sourceFileName?: string): string {
  if (!sourceFileName) return 'rvtools';
  return sourceFileName.replace(/\.[^/.]+$/, '');
}

export function getDefaultFilename(exportType: string, context: FilenameContext = {}): string {
  const date = getDateStr();
  const baseName = getBaseName(context.sourceFileName);

  switch (exportType) {
    case 'pdf':
      return `${baseName}_analysis_${date}.pdf`;
    case 'excel':
      return `rvtools-analysis_${date}.xlsx`;
    case 'docx':
      return `${baseName}_migration_report_${date}.docx`;
    case 'pptx':
      return `${baseName}_presentation_${date}.pptx`;
    case 'vsi-bom':
      return `vpc-vsi-bom-${context.region || 'us-south'}-${date}.xlsx`;
    case 'roks-bom':
      return `roks-bom-${context.region || 'us-south'}-${date}.xlsx`;
    case 'source-bom':
      return `source-infrastructure-bom-${date}.xlsx`;
    case 'preflight': {
      const mode = context.mode || 'roks';
      return `preflight-report-${mode}-${date}.xlsx`;
    }
    case 'waves': {
      const waveMode = context.wavePlanningMode || 'complexity';
      const modeLabel = waveMode === 'network'
        ? `network-${context.networkGroupBy || 'cluster'}`
        : 'complexity';
      return `wave-planning-${modeLabel}-${date}.xlsx`;
    }
    case 'mtv-yaml':
      return 'mtv-migration-bundle.zip';
    case 'rackware':
      return `rackware-export-${date}.csv`;
    case 'handover': {
      const handoverBase = getBaseName(context.sourceFileName);
      return `${handoverBase}_coe_${date}.xlsx`;
    }
    case 'diagnostics':
      return `vcf-diagnostics-${getTimestamp()}.json`;
    default:
      return `export-${date}`;
  }
}

/**
 * Sanitize a user-provided filename: strip path separators, null bytes,
 * and ensure the correct extension is present.
 */
export function sanitizeFilename(filename: string, requiredExtension: string): string {
  // Strip path separators and null bytes
  let sanitized = filename.replace(/[/\\]/g, '').replace(/\0/g, '');
  // Trim whitespace
  sanitized = sanitized.trim();
  // If empty after sanitization, use a fallback
  if (!sanitized) {
    sanitized = `export${requiredExtension}`;
  }
  // Ensure correct extension
  if (!sanitized.toLowerCase().endsWith(requiredExtension.toLowerCase())) {
    sanitized += requiredExtension;
  }
  return sanitized;
}
