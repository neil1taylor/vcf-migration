// AI Chat hook - manages chat state, messages, history, and streaming

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { sendMessage } from '@/services/ai/aiChatApi';
import { streamFromProxy } from '@/services/ai/aiStreamClient';
import {
  getCachedChatHistory,
  setCachedChatHistory,
  clearChatHistory,
} from '@/services/ai/aiChatCache';
import type { ChatMessage, ChatContext } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  suggestedFollowUps: string[];
  sendUserMessage: (message: string, context?: ChatContext) => Promise<void>;
  sendUserMessageStreaming: (message: string, context?: ChatContext) => void;
  stopStreaming: () => void;
  clearConversation: () => void;
  loadHistory: (environmentFingerprint: string) => void;
  isAvailable: boolean;
}

let nextMessageId = 1;

function createMessageId(): string {
  return `msg-${Date.now()}-${nextMessageId++}`;
}

/**
 * Hook for AI chat functionality with streaming and persistence support
 */
export function useAIChat(): UseAIChatReturn {
  const { settings } = useAISettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fingerprintRef = useRef('');
  const isAvailable = isAIProxyConfigured() && settings.enabled;

  /** Load persisted chat history for an environment */
  const loadHistory = useCallback((environmentFingerprint: string) => {
    fingerprintRef.current = environmentFingerprint;
    const cached = getCachedChatHistory(environmentFingerprint);
    if (cached.length > 0) {
      setMessages(cached);
    }
  }, []);

  /** Persist messages to localStorage */
  const persistMessages = useCallback((msgs: ChatMessage[]) => {
    if (fingerprintRef.current) {
      setCachedChatHistory(msgs, fingerprintRef.current);
    }
  }, []);

  /** Non-streaming send (original behavior) */
  const sendUserMessage = useCallback(async (message: string, context?: ChatContext) => {
    if (!isAvailable) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    setMessages(prev => {
      const updated = [...prev, userMessage];
      persistMessages(updated);
      return updated;
    });
    setIsLoading(true);
    setError(null);

    try {
      const history = [...messages, userMessage]
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await sendMessage(message, history, context);

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
      };

      setMessages(prev => {
        const updated = [...prev, assistantMessage];
        persistMessages(updated);
        return updated;
      });
      setSuggestedFollowUps(response.suggestedFollowUps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, messages, persistMessages]);

  /** Streaming send — text appears progressively */
  const sendUserMessageStreaming = useCallback((message: string, context?: ChatContext) => {
    if (!isAvailable || isStreaming) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };

    const assistantMsgId = createMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);
    setError(null);

    const history = [...messages, userMessage]
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    abortRef.current = streamFromProxy(
      '/api/chat/stream',
      { message, conversationHistory: history, context },
      {
        onChunk: (text) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + text }
                : m
            )
          );
        },
        onDone: () => {
          setIsStreaming(false);
          abortRef.current = null;
          // Persist after streaming completes
          setMessages(prev => {
            persistMessages(prev);
            return prev;
          });
        },
        onError: (err) => {
          setIsStreaming(false);
          abortRef.current = null;
          setError(err.message);
        },
      }
    );
  }, [isAvailable, isStreaming, messages, persistMessages]);

  /** Stop active streaming */
  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const clearConversation = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError(null);
    setSuggestedFollowUps([]);
    clearChatHistory();
  }, [stopStreaming]);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    suggestedFollowUps,
    sendUserMessage,
    sendUserMessageStreaming,
    stopStreaming,
    clearConversation,
    loadHistory,
    isAvailable,
  };
}
