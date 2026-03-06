// AI Discovery Questions API client

import { createLogger } from '@/utils/logger';
import { isAIProxyConfigured } from './aiProxyClient';
import type {
  DiscoveryQuestionsInput,
  DiscoveryQuestionsResult,
  InterviewInput,
  InterviewResult,
} from './types';

const logger = createLogger('AI Discovery Questions');

/**
 * Fetch AI-generated discovery questions
 */
export async function fetchAIDiscoveryQuestions(
  input: DiscoveryQuestionsInput
): Promise<DiscoveryQuestionsResult | null> {
  if (!isAIProxyConfigured()) {
    logger.info('AI proxy not configured, skipping discovery questions');
    return null;
  }

  logger.info('Fetching AI discovery questions');
  const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL as string;

  try {
    const response = await fetch(`${AI_PROXY_URL}/api/discovery-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: input }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Discovery questions failed: ${response.status}`);
    }

    const data = await response.json();
    const r = data.result || {};

    const result: DiscoveryQuestionsResult = {
      questionGroups: r.questionGroups || r.question_groups || [],
      source: 'watsonx',
    };

    logger.info(`Generated ${result.questionGroups.length} question groups`);
    return result;
  } catch (error) {
    logger.error('AI discovery questions failed', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Send interview answer and get next question
 */
export async function sendInterviewAnswer(
  input: InterviewInput
): Promise<InterviewResult | null> {
  if (!isAIProxyConfigured()) {
    return null;
  }

  const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL as string;

  try {
    const response = await fetch(`${AI_PROXY_URL}/api/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Interview failed: ${response.status}`);
    }

    const data = await response.json();
    const r = data.result || {};

    return {
      nextQuestion: r.nextQuestion || r.next_question || { id: 'unknown', question: '', topic: '' },
      followUpContext: r.followUpContext || r.follow_up_context || '',
      insightsFromAnswer: r.insightsFromAnswer || r.insights_from_answer || [],
      source: 'watsonx',
    };
  } catch (error) {
    logger.error('Interview failed', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}
