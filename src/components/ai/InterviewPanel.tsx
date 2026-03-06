// Interactive Interview Panel — step-by-step interview UI

import { useState, useCallback } from 'react';
import {
  Tile,
  Tag,
  TextInput,
  Button,
  InlineLoading,
  InlineNotification,
  ProgressIndicator,
  ProgressStep,
} from '@carbon/react';
import { Send, TrashCan } from '@carbon/icons-react';
import type { UseAIInterviewReturn } from '@/hooks/useAIInterview';

interface InterviewPanelProps {
  interview: UseAIInterviewReturn;
}

export function InterviewPanel({ interview }: InterviewPanelProps) {
  const {
    answers,
    currentQuestion,
    isLoading,
    error,
    submitAnswer,
    clearInterview,
    allInsights,
    isAvailable,
    progress,
  } = interview;

  const [inputValue, setInputValue] = useState('');

  const handleSubmit = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    setInputValue('');
    await submitAnswer(trimmed);
  }, [inputValue, isLoading, submitAnswer]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!isAvailable) {
    return null;
  }

  return (
    <div className="interview-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4>Migration Discovery Interview</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag type="purple" size="sm">AI</Tag>
          <Tag type="cool-gray" size="sm">{progress} answered</Tag>
          {answers.length > 0 && (
            <Button
              kind="ghost"
              size="sm"
              renderIcon={TrashCan}
              iconDescription="Clear interview"
              hasIconOnly
              onClick={clearInterview}
            />
          )}
        </div>
      </div>

      {/* Progress */}
      {answers.length > 0 && (
        <ProgressIndicator
          currentIndex={Math.min(answers.length, 4)}
          style={{ marginBottom: '1rem' }}
        >
          <ProgressStep label="Business" />
          <ProgressStep label="Technical" />
          <ProgressStep label="Risk" />
          <ProgressStep label="Operations" />
          <ProgressStep label="Dependencies" />
        </ProgressIndicator>
      )}

      {/* Previous Q&A */}
      {answers.map((a, i) => (
        <Tile key={i} style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Tag type="cool-gray" size="sm">{a.topic}</Tag>
            <strong>{a.question}</strong>
          </div>
          <p style={{ marginBottom: '0.25rem' }}>{a.answer}</p>
          {a.insights.length > 0 && (
            <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              Insights: {a.insights.join('; ')}
            </div>
          )}
        </Tile>
      ))}

      {/* Current question */}
      {currentQuestion && (
        <Tile style={{ marginBottom: '0.5rem', borderLeft: '3px solid var(--cds-interactive)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Tag type="teal" size="sm">{currentQuestion.topic}</Tag>
            <strong>{currentQuestion.question}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <TextInput
              id="interview-input"
              labelText="Your answer"
              hideLabel
              placeholder="Type your answer..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              size="lg"
            />
            <Button
              kind="primary"
              size="lg"
              renderIcon={Send}
              iconDescription="Submit"
              hasIconOnly
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isLoading}
            />
          </div>
        </Tile>
      )}

      {isLoading && (
        <InlineLoading status="active" description="Processing answer..." />
      )}

      {error && (
        <InlineNotification
          kind="error"
          title="Interview"
          subtitle={error}
          lowContrast
          hideCloseButton
        />
      )}

      {/* Accumulated insights */}
      {allInsights.length > 0 && (
        <Tile style={{ marginTop: '1rem' }}>
          <h5 style={{ marginBottom: '0.5rem' }}>Insights Gathered ({allInsights.length})</h5>
          <ul>
            {allInsights.map((insight, i) => <li key={i}>{insight}</li>)}
          </ul>
        </Tile>
      )}
    </div>
  );
}
