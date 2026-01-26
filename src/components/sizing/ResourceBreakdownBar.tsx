// Generic resource breakdown horizontal bar visualization for CPU, Memory, Storage
import { useMemo } from 'react';
import { Link } from '@carbon/react';
import './ResourceBreakdownBar.scss';

export interface ResourceSegment {
  label: string;
  value: number;
  color: string;
  description?: string;
}

export type ResourceUnit = 'vcpus' | 'gib' | 'storage' | 'percent';

interface ResourceBreakdownBarProps {
  segments: ResourceSegment[];
  title?: string;
  unit?: ResourceUnit;
  formatValue?: (value: number) => string;
  showLegend?: boolean;
  height?: number;
  infoLink?: {
    text: string;
    href: string;
  };
}

// Default formatters for different resource types
const formatters: Record<ResourceUnit, (value: number) => string> = {
  vcpus: (value: number): string => {
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} vCPUs`;
  },
  gib: (value: number): string => {
    if (value >= 1024) {
      return `${(value / 1024).toFixed(2)} TiB`;
    }
    return `${value.toFixed(1)} GiB`;
  },
  storage: (value: number): string => {
    if (value >= 1024) {
      return `${(value / 1024).toFixed(2)} TiB`;
    }
    return `${value.toFixed(1)} GiB`;
  },
  percent: (value: number): string => {
    return `${value.toFixed(1)}%`;
  },
};

export function ResourceBreakdownBar({
  segments,
  title,
  unit = 'storage',
  formatValue,
  showLegend = true,
  height = 32,
  infoLink,
}: ResourceBreakdownBarProps) {
  const formatter = formatValue || formatters[unit];

  const total = useMemo(() => {
    return segments.reduce((sum, seg) => sum + seg.value, 0);
  }, [segments]);

  // Filter out zero-value segments for display
  const visibleSegments = useMemo(() => {
    return segments.filter(seg => seg.value > 0);
  }, [segments]);

  if (total === 0) {
    return null;
  }

  return (
    <div className="resource-breakdown-bar">
      <div className="resource-breakdown-bar__header">
        {title && <div className="resource-breakdown-bar__title">{title}</div>}
        {infoLink && (
          <Link
            href={infoLink.href}
            size="sm"
            className="resource-breakdown-bar__info-link"
          >
            {infoLink.text}
          </Link>
        )}
      </div>

      <div className="resource-breakdown-bar__container">
        <div
          className="resource-breakdown-bar__bar"
          style={{ height: `${height}px` }}
        >
          {visibleSegments.map((segment) => {
            const percentage = (segment.value / total) * 100;
            return (
              <div
                key={segment.label}
                className="resource-breakdown-bar__segment"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: segment.color,
                }}
                title={`${segment.label}: ${formatter(segment.value)} (${percentage.toFixed(1)}%)${segment.description ? `\n${segment.description}` : ''}`}
              >
                {percentage > 10 && (
                  <span className="resource-breakdown-bar__segment-label">
                    {segment.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="resource-breakdown-bar__total">
          Total: {formatter(total)}
        </div>
      </div>

      {showLegend && (
        <div className="resource-breakdown-bar__legend">
          {visibleSegments.map((segment) => {
            const percentage = (segment.value / total) * 100;
            return (
              <div key={segment.label} className="resource-breakdown-bar__legend-item">
                <span
                  className="resource-breakdown-bar__legend-color"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="resource-breakdown-bar__legend-label">
                  {segment.label}
                </span>
                <span className="resource-breakdown-bar__legend-value">
                  {formatter(segment.value)}
                </span>
                <span className="resource-breakdown-bar__legend-percent">
                  ({percentage.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Color constants for resource breakdown segments
export const RESOURCE_SEGMENT_COLORS = {
  // CPU colors
  vmCpu: '#0f62fe',           // Blue - VM vCPU requirements
  cpuOverhead: '#8a3ffc',     // Purple - virtualization overhead

  // Memory colors
  vmMemory: '#009d9a',        // Teal - VM memory requirements
  memoryOverhead: '#d4bbff',  // Light purple - virtualization overhead

  // Infrastructure reserved colors
  odfReserved: '#da1e28',     // Red - ODF/Ceph reserved
  systemReserved: '#ff832b',  // Orange - System reserved (kubelet, etc.)

  // Free/available capacity
  free: '#c6c6c6',            // Gray - Free/unused capacity

  // Storage colors (same as StorageBreakdownBar)
  vmData: '#0f62fe',          // Blue - base VM data
  growth: '#009d9a',          // Teal - growth projection
  storageOverhead: '#8a3ffc', // Purple - virtualization overhead
  replica: '#da1e28',         // Red - replica factor
  headroom: '#ff832b',        // Orange - operational headroom
} as const;
