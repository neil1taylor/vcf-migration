// Settings restore — writes bundled settings back to localStorage
import { SETTINGS_KEYS } from '@/services/export/handoverExporter';

const allowedKeys = new Set<string>(SETTINGS_KEYS);

export function restoreBundledSettings(
  settings: Record<string, string>
): { restored: string[]; skipped: string[] } {
  const restored: string[] = [];
  const skipped: string[] = [];

  for (const [key, value] of Object.entries(settings)) {
    // Skip metadata keys
    if (key.startsWith('_')) {
      continue;
    }

    if (allowedKeys.has(key)) {
      localStorage.setItem(key, value);
      restored.push(key);
    } else {
      skipped.push(key);
    }
  }

  return { restored, skipped };
}
