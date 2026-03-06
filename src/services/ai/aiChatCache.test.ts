import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedChatHistory, setCachedChatHistory, clearChatHistory } from './aiChatCache';
import type { ChatMessage } from './types';

describe('aiChatCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const fingerprint = 'test-env-123';

  const messages: ChatMessage[] = [
    { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1000 },
    { id: 'msg-2', role: 'assistant', content: 'Hi there', timestamp: 2000 },
  ];

  it('returns empty array when no cache exists', () => {
    expect(getCachedChatHistory(fingerprint)).toEqual([]);
  });

  it('stores and retrieves messages', () => {
    setCachedChatHistory(messages, fingerprint);
    const result = getCachedChatHistory(fingerprint);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Hello');
  });

  it('returns empty for different fingerprint', () => {
    setCachedChatHistory(messages, fingerprint);
    expect(getCachedChatHistory('other-env')).toEqual([]);
  });

  it('clears history', () => {
    setCachedChatHistory(messages, fingerprint);
    clearChatHistory();
    expect(getCachedChatHistory(fingerprint)).toEqual([]);
  });

  it('trims to max 100 messages', () => {
    const manyMessages = Array.from({ length: 150 }, (_, i) => ({
      id: `msg-${i}`,
      role: 'user' as const,
      content: `Message ${i}`,
      timestamp: i * 1000,
    }));
    setCachedChatHistory(manyMessages, fingerprint);
    const result = getCachedChatHistory(fingerprint);
    expect(result).toHaveLength(100);
    expect(result[0].content).toBe('Message 50'); // Kept last 100
  });
});
