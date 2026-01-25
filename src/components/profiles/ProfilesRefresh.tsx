// Profiles Refresh Component - Shows profiles status and refresh button

import { Button, Tag, InlineLoading } from '@carbon/react';
import { Renew, CloudOffline, Checkmark, Warning } from '@carbon/icons-react';
import type { ProfilesSource } from '@/services/profiles/profilesCache';
import './ProfilesRefresh.scss';

interface ProfilesRefreshProps {
  lastUpdated: Date | null;
  source: ProfilesSource;
  isRefreshing: boolean;
  onRefresh: () => void;
  isApiAvailable?: boolean | null;
  error?: string | null;
  compact?: boolean;
  profileCounts?: { vsi: number; bareMetal: number };
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
  source: ProfilesSource,
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

export function ProfilesRefresh({
  lastUpdated,
  source,
  isRefreshing,
  onRefresh,
  isApiAvailable,
  error,
  compact = false,
  profileCounts,
}: ProfilesRefreshProps) {
  const sourceDisplay = getSourceDisplay(source, isApiAvailable, lastUpdated);

  if (compact) {
    const tooltipText = lastUpdated
      ? `Refresh profiles (last: ${formatLastUpdated(lastUpdated)})`
      : 'Refresh profiles';

    return (
      <div className="profiles-refresh profiles-refresh--compact">
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
    <div className="profiles-refresh">
      <div className="profiles-refresh__status">
        <div className="profiles-refresh__source">
          {sourceDisplay.kind === 'green' ? (
            <Checkmark size={16} className="profiles-refresh__icon profiles-refresh__icon--api" />
          ) : isApiAvailable === false ? (
            <CloudOffline size={16} className="profiles-refresh__icon profiles-refresh__icon--offline" />
          ) : (
            <Warning size={16} className="profiles-refresh__icon profiles-refresh__icon--static" />
          )}
          <Tag type={sourceDisplay.kind} size="sm">
            {sourceDisplay.label}
          </Tag>
        </div>

        <span className="profiles-refresh__updated">
          {lastUpdated ? (
            <>Updated: {formatLastUpdated(lastUpdated)}</>
          ) : (
            <>Using bundled profile data</>
          )}
        </span>

        {profileCounts && (
          <span className="profiles-refresh__counts">
            {profileCounts.vsi} VSI, {profileCounts.bareMetal} Bare Metal
          </span>
        )}
      </div>

      <Button
        kind="ghost"
        size="sm"
        renderIcon={isRefreshing ? undefined : Renew}
        onClick={onRefresh}
        disabled={isRefreshing}
        className="profiles-refresh__button"
      >
        {isRefreshing ? (
          <InlineLoading description="Refreshing..." />
        ) : (
          'Refresh Profiles'
        )}
      </Button>

      {error && (
        <span className="profiles-refresh__error" title={error}>
          Proxy unavailable - using cached data
        </span>
      )}
    </div>
  );
}

export default ProfilesRefresh;
