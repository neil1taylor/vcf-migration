import { describe, it, expect, beforeEach } from 'vitest';
import { getCachedInterview, setCachedInterview, clearInterviewCache } from './aiInterviewCache';
import type { InterviewAnswer } from './aiInterviewCache';

describe('aiInterviewCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const fingerprint = 'test-env-123';

  const answers: InterviewAnswer[] = [
    {
      questionId: 'q1',
      question: 'What is the business driver?',
      answer: 'Cost reduction',
      topic: 'Business Context',
      insights: ['Primary driver is cost reduction'],
      timestamp: Date.now(),
    },
  ];

  it('returns empty array when no cache exists', () => {
    expect(getCachedInterview(fingerprint)).toEqual([]);
  });

  it('stores and retrieves answers', () => {
    setCachedInterview(answers, fingerprint);
    const result = getCachedInterview(fingerprint);
    expect(result).toHaveLength(1);
    expect(result[0].answer).toBe('Cost reduction');
  });

  it('returns empty for different fingerprint', () => {
    setCachedInterview(answers, fingerprint);
    expect(getCachedInterview('other-env')).toEqual([]);
  });

  it('clears interview cache', () => {
    setCachedInterview(answers, fingerprint);
    clearInterviewCache();
    expect(getCachedInterview(fingerprint)).toEqual([]);
  });
});
