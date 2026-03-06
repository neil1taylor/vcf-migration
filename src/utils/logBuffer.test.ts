import { describe, it, expect, beforeEach } from 'vitest';
import { pushLogEntry, getLogEntries, clearLogBuffer, type LogEntry } from './logBuffer';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    module: 'test',
    message: 'test message',
    ...overrides,
  };
}

describe('logBuffer', () => {
  beforeEach(() => {
    clearLogBuffer();
  });

  it('stores and retrieves entries in order', () => {
    pushLogEntry(makeEntry({ message: 'first' }));
    pushLogEntry(makeEntry({ message: 'second' }));
    pushLogEntry(makeEntry({ message: 'third' }));

    const entries = getLogEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0].message).toBe('first');
    expect(entries[2].message).toBe('third');
  });

  it('returns a copy, not the internal buffer', () => {
    pushLogEntry(makeEntry());
    const a = getLogEntries();
    const b = getLogEntries();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('caps at 500 entries', () => {
    for (let i = 0; i < 510; i++) {
      pushLogEntry(makeEntry({ message: `msg-${i}` }));
    }

    const entries = getLogEntries();
    expect(entries).toHaveLength(500);
    // Oldest entries (0-9) should have been evicted
    expect(entries[0].message).toBe('msg-10');
    expect(entries[499].message).toBe('msg-509');
  });

  it('clearLogBuffer empties the buffer', () => {
    pushLogEntry(makeEntry());
    pushLogEntry(makeEntry());
    expect(getLogEntries()).toHaveLength(2);

    clearLogBuffer();
    expect(getLogEntries()).toHaveLength(0);
  });

  it('stores entries with context', () => {
    pushLogEntry(makeEntry({ context: { foo: 'bar', count: 42 } }));
    const entries = getLogEntries();
    expect(entries[0].context).toEqual({ foo: 'bar', count: 42 });
  });

  it('stores entries without context', () => {
    pushLogEntry(makeEntry());
    const entries = getLogEntries();
    expect(entries[0].context).toBeUndefined();
  });
});
