import { useState } from 'react';
import {
  Column,
  InlineNotification,
  Link,
} from '@carbon/react';
import type { DataInconsistencyWarning } from '@/services/dataInconsistencyChecks';

interface SizingDataQualityBannerProps {
  warnings: DataInconsistencyWarning[];
  hasCritical: boolean;
}

export function SizingDataQualityBanner({ warnings, hasCritical }: SizingDataQualityBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (warnings.length === 0) return null;

  // Deduplicate by vmName for the summary count
  const uniqueVMs = new Set(warnings.map((w) => w.vmName));

  return (
    <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
      <InlineNotification
        kind={hasCritical ? 'error' : 'warning'}
        title="Data quality"
        subtitle={
          (
            <>
              {uniqueVMs.size} VM{uniqueVMs.size !== 1 ? 's have' : ' has'} suspicious resource allocations that may affect sizing accuracy.{' '}
              <Link
                onClick={(e: React.MouseEvent) => { e.preventDefault(); setExpanded(!expanded); }}
                style={{ cursor: 'pointer' }}
              >
                {expanded ? 'Hide details' : 'Show details'}
              </Link>
            </>
          ) as unknown as string
        }
        lowContrast
        hideCloseButton
      />
      {expanded && (
        <div style={{ marginTop: '0.5rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--cds-border-subtle-01, #e0e0e0)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>VM</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Issue</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Value</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Expected</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((w, i) => (
                <tr key={`${w.vmName}-${w.category}-${i}`} style={{ borderBottom: '1px solid var(--cds-border-subtle-01, #e0e0e0)' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{w.vmName}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span style={{ color: w.severity === 'critical' ? 'var(--cds-support-error)' : 'var(--cds-support-warning)' }}>
                      {w.message}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{w.metric}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{w.expected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Column>
  );
}
