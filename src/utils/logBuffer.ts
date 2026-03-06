// In-memory ring buffer for diagnostic log capture

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  module: string;
  message: string;
  context?: Record<string, unknown>;
}

const MAX_ENTRIES = 500;
const buffer: LogEntry[] = [];

export function pushLogEntry(entry: LogEntry): void {
  if (buffer.length >= MAX_ENTRIES) {
    buffer.shift();
  }
  buffer.push(entry);
}

export function getLogEntries(): LogEntry[] {
  return [...buffer];
}

export function clearLogBuffer(): void {
  buffer.length = 0;
}
