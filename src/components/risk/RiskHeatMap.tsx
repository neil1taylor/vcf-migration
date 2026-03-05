// Risk Heat Map — 6-domain color-coded summary table
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
} from '@carbon/react';
import type { RiskAssessment, RiskDomainId, RiskSeverity } from '@/types/riskAssessment';
import { RISK_SEVERITY_COLORS } from '@/types/riskAssessment';

interface RiskHeatMapProps {
  assessment: RiskAssessment;
}

const TAG_TYPE_MAP: Record<RiskSeverity, 'green' | 'gray' | 'warm-gray' | 'red'> = {
  low: 'green',
  medium: 'warm-gray',
  high: 'warm-gray',
  critical: 'red',
};

const DOMAIN_ORDER: RiskDomainId[] = ['cost', 'readiness', 'security', 'operational', 'compliance', 'timeline'];

export function RiskHeatMap({ assessment }: RiskHeatMapProps) {
  return (
    <Table size="md">
      <TableHead>
        <TableRow>
          <TableHeader>Risk Domain</TableHeader>
          <TableHeader>Auto</TableHeader>
          <TableHeader>Override</TableHeader>
          <TableHeader>Effective</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {DOMAIN_ORDER.map(domainId => {
          const domain = assessment.domains[domainId];
          return (
            <TableRow key={domainId}>
              <TableCell>{domain.label}</TableCell>
              <TableCell>
                {domain.autoSeverity ? (
                  <Tag type={TAG_TYPE_MAP[domain.autoSeverity]} size="sm">
                    {domain.autoSeverity}
                  </Tag>
                ) : (
                  <span style={{ color: 'var(--cds-text-placeholder)' }}>—</span>
                )}
              </TableCell>
              <TableCell>
                {domain.overrideSeverity ? (
                  <Tag type={TAG_TYPE_MAP[domain.overrideSeverity]} size="sm">
                    {domain.overrideSeverity}
                  </Tag>
                ) : (
                  <span style={{ color: 'var(--cds-text-placeholder)' }}>—</span>
                )}
              </TableCell>
              <TableCell>
                <Tag
                  type={TAG_TYPE_MAP[domain.effectiveSeverity]}
                  size="sm"
                  style={{
                    backgroundColor: RISK_SEVERITY_COLORS[domain.effectiveSeverity],
                    color: domain.effectiveSeverity === 'medium' ? 'var(--cds-text-primary)' : 'var(--cds-text-on-color)',
                  }}
                >
                  {domain.effectiveSeverity.toUpperCase()}
                </Tag>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
