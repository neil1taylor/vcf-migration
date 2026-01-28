// Settings page - AI configuration, proxy status, and cache management

import { useEffect, useCallback } from 'react';
import {
  Grid,
  Column,
  Tile,
  Toggle,
  Tag,
  Button,
  InlineNotification,
} from '@carbon/react';
import {
  Checkmark,
  CloudOffline,
  ConnectionSignal,
  TrashCan,
  Settings as SettingsIcon,
} from '@carbon/icons-react';
import { useAISettings } from '@/hooks/useAISettings';
import { useAIStatus } from '@/hooks/useAIStatus';
import { clearClassificationCache } from '@/services/ai/aiClassificationCache';
import { clearRightsizingCache } from '@/services/ai/aiRightsizingCache';
import './SettingsPage.scss';

export function SettingsPage() {
  const { settings, updateSettings } = useAISettings();
  const { isConfigured, proxyHealth, isTestingProxy, testProxy } = useAIStatus();

  // Auto-test proxy on mount if configured
  useEffect(() => {
    if (isConfigured && !proxyHealth) {
      testProxy();
    }
  }, [isConfigured, proxyHealth, testProxy]);

  const handleClearClassificationCache = useCallback(() => {
    clearClassificationCache();
  }, []);

  const handleClearRightsizingCache = useCallback(() => {
    clearRightsizingCache();
  }, []);

  const handleClearAllCaches = useCallback(() => {
    clearClassificationCache();
    clearRightsizingCache();
  }, []);

  return (
    <div className="settings-page">
      <Grid>
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <h1 className="settings-page__title">Settings</h1>
          <p className="settings-page__subtitle">
            Configure AI features and manage application settings
          </p>
        </Column>

        {/* AI Features */}
        <Column lg={8} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <SettingsIcon size={20} />
              AI Features
            </h2>

            <div className="settings-page__toggle-row">
              <Toggle
                id="ai-enabled-toggle"
                labelText="Enable AI features"
                labelA="Off"
                labelB="On"
                toggled={settings.enabled}
                onToggle={(checked: boolean) => {
                  updateSettings({ enabled: checked });
                  if (!checked) {
                    updateSettings({ enabled: false, consentGiven: false });
                  }
                }}
                disabled={!isConfigured}
              />
            </div>

            {!isConfigured && (
              <InlineNotification
                kind="info"
                title="AI proxy not configured"
                subtitle="Set the VITE_AI_PROXY_URL environment variable to enable AI features."
                lowContrast
                hideCloseButton
              />
            )}

            {isConfigured && settings.enabled && !settings.consentGiven && (
              <div className="settings-page__consent">
                <InlineNotification
                  kind="warning"
                  title="Consent required"
                  subtitle="AI features send aggregated migration data (VM counts, resource totals, workload categories) to IBM watsonx.ai. No individual VM names, IPs, or raw data is transmitted."
                  lowContrast
                  hideCloseButton
                />
                <Button
                  kind="primary"
                  size="sm"
                  onClick={() => updateSettings({ consentGiven: true })}
                  style={{ marginTop: '0.5rem' }}
                >
                  I understand and consent
                </Button>
              </div>
            )}

            {isConfigured && settings.enabled && settings.consentGiven && (
              <div className="settings-page__privacy-notice">
                <p>
                  AI features are active. Only aggregated summaries are sent to watsonx.ai.
                  Individual VM names, IPs, and raw RVTools data are never transmitted.
                </p>
              </div>
            )}
          </Tile>
        </Column>

        {/* AI Proxy Status */}
        <Column lg={8} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <ConnectionSignal size={20} />
              AI Proxy Status
            </h2>

            <div className="settings-page__status-row">
              <span className="settings-page__status-label">Connection</span>
              {!isConfigured ? (
                <Tag type="gray" size="sm">
                  <CloudOffline size={12} />
                  &nbsp;Not Configured
                </Tag>
              ) : proxyHealth === null ? (
                <Tag type="gray" size="sm">Untested</Tag>
              ) : proxyHealth.success ? (
                <Tag type="green" size="sm">
                  <Checkmark size={12} />
                  &nbsp;Connected
                </Tag>
              ) : (
                <Tag type="red" size="sm">
                  <CloudOffline size={12} />
                  &nbsp;Unavailable
                </Tag>
              )}
            </div>

            {proxyHealth && !proxyHealth.success && proxyHealth.error && (
              <p className="settings-page__error-detail">{proxyHealth.error}</p>
            )}

            <Button
              kind="tertiary"
              size="sm"
              onClick={testProxy}
              disabled={!isConfigured || isTestingProxy}
              style={{ marginTop: '1rem' }}
            >
              {isTestingProxy ? 'Testing...' : 'Test Connection'}
            </Button>
          </Tile>
        </Column>

        {/* Cache Management */}
        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <Tile className="settings-page__tile">
            <h2 className="settings-page__section-title">
              <TrashCan size={20} />
              Cache Management
            </h2>
            <p className="settings-page__cache-description">
              AI results are cached locally for 24 hours. Clear caches to force fresh analysis.
            </p>

            <div className="settings-page__cache-actions">
              <Button
                kind="tertiary"
                size="sm"
                onClick={handleClearClassificationCache}
              >
                Clear Classification Cache
              </Button>
              <Button
                kind="tertiary"
                size="sm"
                onClick={handleClearRightsizingCache}
              >
                Clear Right-sizing Cache
              </Button>
              <Button
                kind="danger--tertiary"
                size="sm"
                onClick={handleClearAllCaches}
                renderIcon={TrashCan}
              >
                Clear All AI Caches
              </Button>
            </div>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
