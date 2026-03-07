// Extract bundled settings from a handover Excel file without full RVTools parsing
import * as XLSX from 'xlsx';

export interface ExtractedSettings {
  settings: Record<string, string>;
  metadata: {
    exportDate: string | null;
    sourceFileName: string | null;
    settingsVersion: string | null;
  };
  settingKeys: string[];
}

export function extractSettingsFromArrayBuffer(
  arrayBuffer: ArrayBuffer
): ExtractedSettings | null {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  if (!workbook.SheetNames.includes('_vcfSettings')) {
    return null;
  }

  const sheet = workbook.Sheets['_vcfSettings'];
  const rows = XLSX.utils.sheet_to_json<{ key: string; value: string }>(sheet);

  const settings: Record<string, string> = {};
  let exportDate: string | null = null;
  let sourceFileName: string | null = null;
  let settingsVersion: string | null = null;

  for (const row of rows) {
    if (!row.key || typeof row.value !== 'string') continue;

    if (row.key === '_exportDate') {
      exportDate = row.value;
    } else if (row.key === '_sourceFileName') {
      sourceFileName = row.value;
    } else if (row.key === '_vcfSettingsVersion') {
      settingsVersion = row.value;
    } else if (!row.key.startsWith('_')) {
      settings[row.key] = row.value;
    }
  }

  const settingKeys = Object.keys(settings);

  if (settingKeys.length === 0) {
    return null;
  }

  return {
    settings,
    metadata: { exportDate, sourceFileName, settingsVersion },
    settingKeys,
  };
}

export async function extractSettingsFromFile(
  file: File
): Promise<ExtractedSettings | null> {
  const arrayBuffer = await file.arrayBuffer();
  return extractSettingsFromArrayBuffer(arrayBuffer);
}
