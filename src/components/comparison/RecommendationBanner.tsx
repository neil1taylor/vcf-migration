import { Tile, UnorderedList, ListItem } from '@carbon/react';
import { Recommend } from '@carbon/icons-react';
import type { ComparisonRecommendation } from '@/services/migration/targetClassification';

interface RecommendationBannerProps {
  recommendation: ComparisonRecommendation;
}

export function RecommendationBanner({ recommendation }: RecommendationBannerProps) {
  // Use these colors: all-roks → teal (#009d9a), all-vsi → blue (#0f62fe), split → purple (#8a3ffc)
  const colorMap: Record<string, string> = {
    'all-roks': '#009d9a',
    'all-vsi': '#0f62fe',
    'split': '#8a3ffc',
  };
  const borderColor = colorMap[recommendation.type] || '#0f62fe';

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
    </Tile>
  );
}
