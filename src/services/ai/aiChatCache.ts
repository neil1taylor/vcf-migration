// Chat history persistence — localStorage with environment fingerprint scoping

import type { ChatMessage } from './types';

const CACHE_KEY = 'vcf-ai-chat-history';
const MAX_MESSAGES = 100;

interface CachedChatHistory {
  messages: ChatMessage[];
  environmentFingerprint: string;
  lastUpdated: string;
}

/**
 * Get cached chat history for the given environment
 */
export function getCachedChatHistory(environmentFingerprint: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as CachedChatHistory;
    if (parsed.environmentFingerprint !== environmentFingerprint) return [];
    if (!Array.isArray(parsed.messages)) return [];

    return parsed.messages;
  } catch {
    return [];
  }
}

/**
 * Save chat history to localStorage
 */
export function setCachedChatHistory(
  messages: ChatMessage[],
  environmentFingerprint: string
): void {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    const cached: CachedChatHistory = {
      messages: trimmed,
      environmentFingerprint,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Silently fail — cache is optional
  }
}

/**
 * Clear chat history
 */
export function clearChatHistory(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Silently fail
  }
}
