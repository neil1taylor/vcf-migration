import { Tile, UnorderedList, ListItem } from '@carbon/react';
import { Recommend } from '@carbon/icons-react';
import type { ComparisonRecommendation } from '@/services/migration/targetClassification';
import type { PlatformSelectionScore } from '@/hooks/usePlatformSelection';

interface RecommendationBannerProps {
  recommendation: ComparisonRecommendation;
  platformScore?: PlatformSelectionScore;
}

export function RecommendationBanner({ recommendation, platformScore }: RecommendationBannerProps) {
  // Use these colors: all-roks → teal (#009d9a), all-vsi → blue (#0f62fe), split → purple (#8a3ffc)
  const colorMap: Record<string, string> = {
    'all-roks': '#009d9a',
    'all-vsi': '#0f62fe',
    'split': '#8a3ffc',
  };
  const borderColor = colorMap[recommendation.type] || '#0f62fe';

  // Determine if questionnaire agrees/disagrees with auto-recommendation
  const autoLeaning = recommendation.type === 'all-roks' ? 'roks' : recommendation.type === 'all-vsi' ? 'vsi' : null;
  const hasQuestionnaireAnswers = platformScore && platformScore.answeredCount > 0;
  const questionnaireDisagrees = hasQuestionnaireAnswers && autoLeaning && platformScore.leaning !== 'neutral' && platformScore.leaning !== autoLeaning;

  return (
    <Tile style={{ borderLeft: `4px solid ${borderColor}`, marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Recommend size={20} />
        <h4 style={{ margin: 0 }}>Recommendation: {recommendation.title}</h4>
      </div>
      <UnorderedList>
        {recommendation.reasoning.map((reason, i) => (
          <ListItem key={i}>{reason}</ListItem>
        ))}
      </UnorderedList>
      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#525252' }}>
        {recommendation.roksPercentage}% ROKS / {recommendation.vsiPercentage}% VSI
      </div>
      {hasQuestionnaireAnswers && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0', fontSize: '0.875rem' }}>
          <p style={{ margin: 0 }}>
            <strong>Platform questionnaire:</strong> {platformScore.vsiCount} factor{platformScore.vsiCount !== 1 ? 's' : ''} favour
            VSI, {platformScore.roksCount} factor{platformScore.roksCount !== 1 ? 's' : ''} favour ROKS.
          </p>
          {questionnaireDisagrees ? (
            <p style={{ margin: '0.25rem 0 0', color: '#da1e28' }}>
              Note: Your questionnaire responses suggest {platformScore.leaning === 'vsi' ? 'VPC VSI' : 'ROKS'} may be a better fit.
            </p>
          ) : (
            <p style={{ margin: '0.25rem 0 0', color: '#198038' }}>
              Your questionnaire responses support this recommendation.
            </p>
          )}
        </div>
      )}
    </Tile>
  );
}
