import {
  StructuredListWrapper, StructuredListHead, StructuredListBody,
  StructuredListRow, StructuredListCell,
} from '@carbon/react';
import type { ComparisonMetrics } from '@/hooks/useComparisonData';

interface MigrationEffortPanelProps {
  comparison: ComparisonMetrics;
}

export function MigrationEffortPanel({ comparison }: MigrationEffortPanelProps) {
  const { roks, vsi } = comparison;

  const rows = [
    { label: 'VM Count', roks: String(roks.vmCount), vsi: String(vsi.vmCount) },
    { label: 'Migration Tooling', roks: 'MTV (Migration Toolkit for Virtualization)', vsi: 'Wanclouds VPC+ / Manual' },
    { label: 'Estimated Waves', roks: String(roks.estimatedWaveCount), vsi: String(vsi.estimatedWaveCount) },
    { label: 'Readiness Score', roks: `${roks.readinessScore}%`, vsi: `${vsi.readinessScore}%` },
    {
      label: 'Complexity',
      roks: `${roks.complexityDistribution['Simple'] || 0} Simple, ${roks.complexityDistribution['Moderate'] || 0} Moderate, ${roks.complexityDistribution['Complex'] || 0} Complex`,
      vsi: `${vsi.complexityDistribution['Simple'] || 0} Simple, ${vsi.complexityDistribution['Moderate'] || 0} Moderate, ${vsi.complexityDistribution['Complex'] || 0} Complex`,
    },
    { label: 'Blockers', roks: String(roks.blockerCount), vsi: String(vsi.blockerCount) },
  ];

  return (
    <StructuredListWrapper>
      <StructuredListHead>
        <StructuredListRow head>
          <StructuredListCell head>Metric</StructuredListCell>
          <StructuredListCell head>ROKS (OpenShift)</StructuredListCell>
          <StructuredListCell head>VSI (Virtual Servers)</StructuredListCell>
        </StructuredListRow>
      </StructuredListHead>
      <StructuredListBody>
        {rows.map(row => (
          <StructuredListRow key={row.label}>
            <StructuredListCell>{row.label}</StructuredListCell>
            <StructuredListCell>{row.roks}</StructuredListCell>
            <StructuredListCell>{row.vsi}</StructuredListCell>
          </StructuredListRow>
        ))}
      </StructuredListBody>
    </StructuredListWrapper>
  );
}
