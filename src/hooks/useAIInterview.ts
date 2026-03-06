// AI Interactive Interview hook

import { useState, useCallback, useRef } from 'react';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import { sendInterviewAnswer } from '@/services/ai/aiDiscoveryQuestionsApi';
import {
  getCachedInterview,
  setCachedInterview,
  clearInterviewCache,
} from '@/services/ai/aiInterviewCache';
import type { InterviewAnswer } from '@/services/ai/aiInterviewCache';
import type { InterviewResult } from '@/services/ai/types';
import { useAISettings } from './useAISettings';

export interface UseAIInterviewReturn {
  answers: InterviewAnswer[];
  currentQuestion: InterviewResult['nextQuestion'] | null;
  isLoading: boolean;
  error: string | null;
  submitAnswer: (answer: string) => Promise<void>;
  startInterview: (fingerprint: string, envContext?: { totalVMs?: number; migrationTarget?: string }) => void;
  clearInterview: () => void;
  allInsights: string[];
  isAvailable: boolean;
  progress: number; // number of questions answered
}

export function useAIInterview(): UseAIInterviewReturn {
  const { settings } = useAISettings();
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewResult['nextQuestion'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const fingerprintRef = useRef('');
  const envContextRef = useRef<{ totalVMs?: number; migrationTarget?: string }>({});
  const isAvailable = isAIProxyConfigured() && settings.enabled;

  const startInterview = useCallback((fingerprint: string, envContext?: { totalVMs?: number; migrationTarget?: string }) => {
    fingerprintRef.current = fingerprint;
    envContextRef.current = envContext || {};

    const cached = getCachedInterview(fingerprint);
    if (cached.length > 0) {
      setAnswers(cached);
    }

    // Set initial question
    setCurrentQuestion({
      id: 'initial',
      question: 'What is the primary business driver for this migration? (e.g., cost reduction, data center exit, modernization, compliance)',
      topic: 'Business Context',
    });
  }, []);

  const submitAnswer = useCallback(async (answer: string) => {
    if (!isAvailable || fetchingRef.current || !currentQuestion) return;

    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendInterviewAnswer({
        currentQuestionId: currentQuestion.id,
        userAnswer: answer,
        interviewHistory: answers.map(a => ({ question: a.question, answer: a.answer })),
        environmentContext: envContextRef.current,
      });

      const newAnswer: InterviewAnswer = {
        questionId: currentQuestion.id,
        question: currentQuestion.question,
        answer,
        topic: currentQuestion.topic,
        insights: result?.insightsFromAnswer || [],
        timestamp: Date.now(),
      };

      const updatedAnswers = [...answers, newAnswer];
      setAnswers(updatedAnswers);
      setCachedInterview(updatedAnswers, fingerprintRef.current);

      if (result?.nextQuestion) {
        setCurrentQuestion(result.nextQuestion);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Interview failed');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [isAvailable, currentQuestion, answers]);

  const clearInterview = useCallback(() => {
    clearInterviewCache();
    setAnswers([]);
    setCurrentQuestion(null);
    setError(null);
  }, []);

  const allInsights = answers.flatMap(a => a.insights);

  return {
    answers,
    currentQuestion,
    isLoading,
    error,
    submitAnswer,
    startInterview,
    clearInterview,
    allInsights,
    isAvailable,
    progress: answers.length,
  };
}
