// Discovery Questions Panel — accordion of AI-generated question groups

import {
  Tile,
  Tag,
  InlineLoading,
  InlineNotification,
  Button,
  Accordion,
  AccordionItem,
} from '@carbon/react';
import { Renew } from '@carbon/icons-react';
import type { DiscoveryQuestionsResult, DiscoveryQuestion } from '@/services/ai/types';

interface DiscoveryQuestionsPanelProps {
  questions: DiscoveryQuestionsResult | null;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

const priorityTagType: Record<string, 'red' | 'warm-gray' | 'cool-gray'> = {
  high: 'red',
  medium: 'warm-gray',
  low: 'cool-gray',
};

export function DiscoveryQuestionsPanel({
  questions,
  isLoading,
  error,
  onRefresh,
}: DiscoveryQuestionsPanelProps) {
  if (isLoading) {
    return (
      <Tile>
        <InlineLoading status="active" description="Generating discovery questions..." />
      </Tile>
    );
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        title="Discovery Questions"
        subtitle={error}
        lowContrast
        hideCloseButton
      />
    );
  }

  if (!questions || questions.questionGroups.length === 0) {
    return null;
  }

  return (
    <div className="discovery-questions-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4>Discovery Questions</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag type="purple" size="sm">AI</Tag>
          {onRefresh && (
            <Button kind="ghost" size="sm" renderIcon={Renew} iconDescription="Refresh" hasIconOnly onClick={onRefresh} />
          )}
        </div>
      </div>

      <Accordion>
        {questions.questionGroups.map((group, gi) => (
          <AccordionItem
            key={`group-${gi}`}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>{group.topic}</strong>
                <Tag type="cool-gray" size="sm">{group.questions.length} questions</Tag>
              </div>
            }
          >
            <p style={{ marginBottom: '0.75rem', fontStyle: 'italic' }}>{group.relevance}</p>
            {group.questions.map((q, qi) => (
              <QuestionItem key={q.id || `q-${gi}-${qi}`} question={q} />
            ))}
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function QuestionItem({ question }: { question: DiscoveryQuestion }) {
  return (
    <div style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--cds-border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <Tag type={priorityTagType[question.priority] || 'cool-gray'} size="sm">
          {question.priority}
        </Tag>
        <div>
          <p style={{ fontWeight: 500 }}>{question.question}</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginTop: '0.25rem' }}>
            {question.context}
          </p>
        </div>
      </div>
    </div>
  );
}
