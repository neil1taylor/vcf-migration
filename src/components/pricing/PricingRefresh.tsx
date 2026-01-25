// Pricing Refresh Component - Shows pricing status and refresh button

import { Button, Tag, InlineLoading } from '@carbon/react';
import { Renew, CloudOffline, Checkmark, Warning } from '@carbon/icons-react';
import type { PricingSource } from '@/services/pricing/pricingCache';
import './PricingRefresh.scss';

interface PricingRefreshProps {
  lastUpdated: Date | null;
  source: PricingSource;
  isRefreshing: boolean;
  onRefresh: () => void;
  isApiAvailable?: boolean | null;
  error?: string | null;
  compact?: boolean;
}

function formatLastUpdated(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getSourceDisplay(
  source: PricingSource,
  isApiAvailable: boolean | null | undefined,
  lastUpdated: Date | null
): { label: string; kind: 'green' | 'gray' } {
  // If the proxy is confirmed available, show "Live API"
  if (isApiAvailable === true) {
    return { label: 'Live API', kind: 'green' };
  }

  // If the proxy is confirmed unavailable, show "Cache"
  if (isApiAvailable === false) {
    return { label: 'Cache', kind: 'gray' };
  }

  // If isApiAvailable is null (test was cancelled or pending), check if we have
  // cached data from the proxy. If so, assume the proxy is still available since
  // the data came from the live API.
  if ((source === 'proxy' || source === 'cached') && lastUpdated) {
    return { label: 'Live API', kind: 'green' };
  }

  // Default to "Cache" (static data or unknown state)
  return { label: 'Cache', kind: 'gray' };
}

export function PricingRefresh({
  lastUpdated,
  source,
  isRefreshing,
  onRefresh,
  isApiAvailable,
  error,
  compact = false,
}: PricingRefreshProps) {
  const sourceDisplay = getSourceDisplay(source, isApiAvailable, lastUpdated);

  if (compact) {
    const tooltipText = lastUpdated
      ? `Refresh pricing (last: ${formatLastUpdated(lastUpdated)})`
      : 'Refresh pricing';

    return (
      <div className="pricing-refresh pricing-refresh--compact">
        <Button
          kind="ghost"
          size="sm"
          renderIcon={isRefreshing ? undefined : Renew}
          onClick={onRefresh}
          disabled={isRefreshing}
          hasIconOnly
          iconDescription={tooltipText}
        >
          {isRefreshing && <InlineLoading description="" />}
        </Button>
        <Tag type={sourceDisplay.kind} size="sm">
          {sourceDisplay.label}
        </Tag>
      </div>
    );
  }

  return (
    <div className="pricing-refresh">
      <div className="pricing-refresh__status">
        <div className="pricing-refresh__source">
          {sourceDisplay.kind === 'green' ? (
            <Checkmark size={16} className="pricing-refresh__icon pricing-refresh__icon--api" />
          ) : isApiAvailable === false ? (
            <CloudOffline size={16} className="pricing-refresh__icon pricing-refresh__icon--offline" />
          ) : (
            <Warning size={16} className="pricing-refresh__icon pricing-refresh__icon--static" />
          )}
          <Tag type={sourceDisplay.kind} size="sm">
            {sourceDisplay.label}
          </Tag>
        </div>

        <span className="pricing-refresh__updated">
          {lastUpdated ? (
            <>Updated: {formatLastUpdated(lastUpdated)}</>
          ) : (
            <>Using bundled pricing data</>
          )}
        </span>
      </div>

      <Button
        kind="ghost"
        size="sm"
        renderIcon={isRefreshing ? undefined : Renew}
        onClick={onRefresh}
        disabled={isRefreshing}
        className="pricing-refresh__button"
      >
        {isRefreshing ? (
          <InlineLoading description="Refreshing..." />
        ) : (
          'Refresh Pricing'
        )}
      </Button>

      {error && isApiAvailable === false && (
        <span className="pricing-refresh__error">
          Proxy unavailable - using cached data
        </span>
      )}
    </div>
  );
}

export default PricingRefresh;
