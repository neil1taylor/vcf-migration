// VPC Topology Diagram — Pure React/Carbon layout
import { Tag, Tooltip } from '@carbon/react';
import { ConnectionSignal } from '@carbon/icons-react';
import { SectionErrorBoundary } from '@/components/common';
import type { VPCDesign, VPCSubnet } from '@/types/vpcDesign';
import './VPCTopologyDiagram.scss';

interface VPCTopologyDiagramProps {
  title?: string;
  subtitle?: string;
  design: VPCDesign;
  height?: number;
  onSubnetClick?: (subnetId: string) => void;
}

type CarbonTagType = 'blue' | 'purple' | 'red' | 'teal' | 'magenta' | 'cool-gray';

const WORKLOAD_TAG_TYPE: Record<string, CarbonTagType> = {
  'Web Server': 'blue',
  'Application Server': 'purple',
  'Database': 'red',
  'Infrastructure': 'teal',
  'Middleware': 'magenta',
  'Default': 'cool-gray',
};

function getWorkloadTagType(purpose: string): CarbonTagType {
  return WORKLOAD_TAG_TYPE[purpose] || WORKLOAD_TAG_TYPE['Default'];
}

function SubnetTile({
  subnet,
  onSubnetClick,
}: {
  subnet: VPCSubnet;
  onSubnetClick?: (subnetId: string) => void;
}) {
  const tagType = getWorkloadTagType(subnet.purpose);

  const tooltipContent = (
    <div className="vpc-topology__subnet-tooltip">
      <strong>{subnet.name}</strong>
      <br />
      CIDR: {subnet.cidr}
      <br />
      Source: {subnet.sourcePortGroup}
      <br />
      VMs: {subnet.vmCount}
      <br />
      Purpose: {subnet.purpose}
    </div>
  );

  return (
    <Tooltip
      label={tooltipContent}
      align="bottom"
      className="vpc-topology__subnet-tooltip-wrapper"
    >
      <button
        type="button"
        className={`vpc-topology__subnet vpc-topology__subnet--${tagType}`}
        onClick={onSubnetClick ? () => onSubnetClick(subnet.id) : undefined}
      >
        <span className="vpc-topology__subnet-name">{subnet.name}</span>
        <Tag type={tagType} size="sm">
          {subnet.purpose} · {subnet.vmCount} VMs
        </Tag>
      </button>
    </Tooltip>
  );
}

export function VPCTopologyDiagram({
  title = 'VPC Topology',
  subtitle,
  design,
  // @ts-expect-error height is part of the public API but not yet used in the component body
  height = 500,
  onSubnetClick,
}: VPCTopologyDiagramProps) {
  // Collect unique workload types for legend
  const workloadTypes = Array.from(
    new Set(design.subnets.map((s) => s.purpose))
  ).sort();

  return (
    <SectionErrorBoundary sectionName="VPC Topology">
      <div className="vpc-topology">
        <div className="vpc-topology__header">
          {title && <h4 className="vpc-topology__title">{title}</h4>}
          {subtitle && <p className="vpc-topology__subtitle">{subtitle}</p>}
        </div>
        <div className="vpc-topology__vpc-container">
          <div className="vpc-topology__vpc-header">
            {design.vpcName} ({design.region})
          </div>

          <div className="vpc-topology__zones">
            {design.zones.map((zone, zi) => (
              <div
                key={zone.name}
                className={`vpc-topology__zone vpc-topology__zone--${zi}`}
              >
                <span className="vpc-topology__zone-label">{zone.name}</span>
                <div className="vpc-topology__zone-subnets">
                  {zone.subnets.length === 0 ? (
                    <div className="vpc-topology__zone-empty">No subnets</div>
                  ) : (
                    zone.subnets.map((subnet) => (
                      <SubnetTile
                        key={subnet.id}
                        subnet={subnet}
                        onSubnetClick={onSubnetClick}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          {design.transitGateways.length > 0 && (
            <div className="vpc-topology__transit-gateways">
              {design.transitGateways.map(gw => (
                <div key={gw.id} className="vpc-topology__transit-gateway">
                  <ConnectionSignal size={16} />
                  <span>
                    {gw.name} ({gw.connections.length} connection{gw.connections.length !== 1 ? 's' : ''})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {workloadTypes.length > 0 && (
          <div className="vpc-topology__legend">
            <span className="vpc-topology__legend-label">Workload types:</span>
            {workloadTypes.map((wt) => (
              <Tag key={wt} type={getWorkloadTagType(wt)} size="sm">
                {wt}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  );
}
