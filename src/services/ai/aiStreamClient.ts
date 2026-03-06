// SSE stream reader for watsonx.ai streaming endpoints

import { createLogger } from '@/utils/logger';
import type { StreamCallbacks } from './types';

const logger = createLogger('AI Stream');

const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL as string | undefined;

/**
 * Stream responses from a proxy endpoint using Server-Sent Events.
 * Returns an AbortController for cancellation.
 */
export function streamFromProxy(
  endpoint: string,
  body: unknown,
  callbacks: StreamCallbacks
): AbortController {
  const controller = new AbortController();

  if (!AI_PROXY_URL) {
    callbacks.onError(new Error('AI proxy URL not configured'));
    return controller;
  }

  const url = `${AI_PROXY_URL}${endpoint}`;
  let fullText = '';

  (async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Stream request failed (${response.status}): ${errorBody}`);
      }

      if (!response.body) {
        throw new Error('Response body is not readable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE events from chunk
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              callbacks.onDone(fullText);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              // watsonx text generation stream format
              const text =
                parsed.results?.[0]?.generated_text ||
                parsed.choices?.[0]?.delta?.content ||
                parsed.choices?.[0]?.message?.content ||
                '';

              if (text) {
                fullText += text;
                callbacks.onChunk(text);
              }
            } catch {
              // Not JSON — could be raw text chunk
              if (data.trim()) {
                fullText += data;
                callbacks.onChunk(data);
              }
            }
          }
        }
      }

      // Stream ended without [DONE] marker
      callbacks.onDone(fullText);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.debug('Stream aborted by user');
        callbacks.onDone(fullText);
        return;
      }
      logger.error('Stream error', error instanceof Error ? error : new Error(String(error)));
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return controller;
}
