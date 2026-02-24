// N+X Redundancy validation section for the Sizing Calculator
import {
  Grid,
  Column,
  Tile,
  Tag,
} from '@carbon/react';
import type { NodeCapacity, RedundancyValidation } from '@/hooks/useSizingCalculator';

interface SizingRedundancyValidationProps {
  redundancyValidation: RedundancyValidation;
  nodeCapacity: NodeCapacity;
  nodeRedundancy: number;
  evictionThreshold: number;
  operationalCapacity: number;
}

export function SizingRedundancyValidation({
  redundancyValidation,
  nodeCapacity,
  nodeRedundancy,
  evictionThreshold,
  operationalCapacity,
}: SizingRedundancyValidationProps) {
  return (
    <Column lg={16} md={8} sm={4}>
      <Tile className={`sizing-calculator__validation-results ${redundancyValidation.allPass ? 'sizing-calculator__validation-results--pass' : 'sizing-calculator__validation-results--fail'}`}>
        <div className="sizing-calculator__validation-header">
          <h3 className="sizing-calculator__section-title">N+{nodeRedundancy} Redundancy Validation</h3>
          <Tag type={redundancyValidation.allPass ? 'green' : 'red'} size="md">
            {redundancyValidation.allPass ? 'PASSED' : 'FAILED'}
          </Tag>
        </div>
        <p className="sizing-calculator__subtitle">
          Verifying cluster can handle workload after {nodeRedundancy} node failure{nodeRedundancy !== 1 ? 's' : ''}: CPU/Memory below {evictionThreshold}% eviction, ODF below {operationalCapacity}% operational
        </p>

        <Grid narrow>
          {/* Healthy Cluster State */}
          <Column lg={8} md={4} sm={4}>
            <div className="sizing-calculator__efficiency-scenario sizing-calculator__efficiency-scenario--healthy">
              <div className="sizing-calculator__efficiency-header">
                <Tag type="green" size="sm">Healthy State</Tag>
                <span className="sizing-calculator__efficiency-subtitle">{redundancyValidation.totalNodes} nodes</span>
              </div>

              <div className="sizing-calculator__efficiency-metrics">
                <div className="sizing-calculator__efficiency-metric">
                  <span className="sizing-calculator__efficiency-metric-label">CPU Utilization</span>
                  <span className="sizing-calculator__efficiency-metric-value">
                    {redundancyValidation.cpuUtilHealthy.toFixed(1)}%
                  </span>
                </div>
                <div className="sizing-calculator__efficiency-metric">
                  <span className="sizing-calculator__efficiency-metric-label">Memory Utilization</span>
                  <span className="sizing-calculator__efficiency-metric-value">
                    {redundancyValidation.memoryUtilHealthy.toFixed(1)}%
                  </span>
                </div>
                <div className="sizing-calculator__efficiency-metric">
                  <span className="sizing-calculator__efficiency-metric-label">Storage Utilization</span>
                  <span className="sizing-calculator__efficiency-metric-value">
                    {nodeCapacity.maxUsableStorageGiB > 0 ? `${redundancyValidation.storageUtilHealthy.toFixed(1)}%` : 'N/A (external)'}
                  </span>
                </div>
              </div>
            </div>
          </Column>

          {/* Post-Failure State */}
          <Column lg={8} md={4} sm={4}>
            <div className={`sizing-calculator__efficiency-scenario ${redundancyValidation.allPass ? 'sizing-calculator__efficiency-scenario--healthy' : 'sizing-calculator__efficiency-scenario--degraded'}`}>
              <div className="sizing-calculator__efficiency-header">
                <Tag type={redundancyValidation.allPass ? 'teal' : 'red'} size="sm">After {nodeRedundancy} Node Failure{nodeRedundancy !== 1 ? 's' : ''}</Tag>
                <span className="sizing-calculator__efficiency-subtitle">{redundancyValidation.survivingNodes} nodes remaining</span>
              </div>

              <div className="sizing-calculator__efficiency-metrics">
                <div className="sizing-calculator__efficiency-metric">
                  <span className="sizing-calculator__efficiency-metric-label">CPU Utilization</span>
                  <span className="sizing-calculator__efficiency-metric-value">
                    <Tag type={redundancyValidation.cpuPasses ? 'green' : 'red'} size="sm">
                      {redundancyValidation.cpuUtilAfterFailure.toFixed(1)}% {redundancyValidation.cpuPasses ? '\u2713' : '\u2717'}
                    </Tag>
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      (threshold: {evictionThreshold}%)
                    </span>
                  </span>
                </div>
                <div className="sizing-calculator__efficiency-metric">
                  <span className="sizing-calculator__efficiency-metric-label">Memory Utilization</span>
                  <span className="sizing-calculator__efficiency-metric-value">
                    <Tag type={redundancyValidation.memoryPasses ? 'green' : 'red'} size="sm">
                      {redundancyValidation.memoryUtilAfterFailure.toFixed(1)}% {redundancyValidation.memoryPasses ? '\u2713' : '\u2717'}
                    </Tag>
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      (threshold: {evictionThreshold}%)
                    </span>
                  </span>
                </div>
                <div className="sizing-calculator__efficiency-metric">
                  <span className="sizing-calculator__efficiency-metric-label">ODF Storage Utilization</span>
                  <span className="sizing-calculator__efficiency-metric-value">
                    {nodeCapacity.maxUsableStorageGiB > 0 ? (
                      <>
                        <Tag type={redundancyValidation.storagePasses ? 'green' : 'red'} size="sm">
                          {redundancyValidation.storageUtilAfterFailure.toFixed(1)}% {redundancyValidation.storagePasses ? '\u2713' : '\u2717'}
                        </Tag>
                        <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                          (ODF operational: {operationalCapacity}%)
                        </span>
                      </>
                    ) : (
                      <Tag type="gray" size="sm">N/A (external storage)</Tag>
                    )}
                  </span>
                </div>
                <div className="sizing-calculator__efficiency-metric">
                  <span className="sizing-calculator__efficiency-metric-label">ODF Quorum</span>
                  <span className="sizing-calculator__efficiency-metric-value">
                    <Tag type={redundancyValidation.odfQuorumPasses ? 'green' : 'red'} size="sm">
                      {redundancyValidation.survivingNodes} nodes {redundancyValidation.odfQuorumPasses ? '\u2713 (\u22653 required)' : '\u2717 (<3 nodes)'}
                    </Tag>
                  </span>
                </div>
              </div>
            </div>
          </Column>
        </Grid>

        {!redundancyValidation.allPass && (
          <div className="sizing-calculator__validation-warning" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--cds-support-error)', color: 'white', borderRadius: '4px' }}>
            <strong>Warning:</strong> Current configuration does not meet N+{nodeRedundancy} redundancy requirements.
            After {nodeRedundancy} node failure{nodeRedundancy !== 1 ? 's' : ''}, the cluster will exceed capacity thresholds
            {!redundancyValidation.cpuPasses && ` (CPU: ${redundancyValidation.cpuUtilAfterFailure.toFixed(0)}% > ${evictionThreshold}%)`}
            {!redundancyValidation.memoryPasses && ` (Memory: ${redundancyValidation.memoryUtilAfterFailure.toFixed(0)}% > ${evictionThreshold}%)`}
            {!redundancyValidation.storagePasses && nodeCapacity.maxUsableStorageGiB > 0 && ` (ODF: ${redundancyValidation.storageUtilAfterFailure.toFixed(0)}% > ${operationalCapacity}%)`}
            {!redundancyValidation.odfQuorumPasses && ` (ODF Quorum: only ${redundancyValidation.survivingNodes} nodes < 3 required)`}.
            Consider adding more nodes or adjusting thresholds.
          </div>
        )}
      </Tile>
    </Column>
  );
}
