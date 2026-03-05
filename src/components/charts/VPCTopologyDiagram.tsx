// VPC Topology Diagram — D3 hierarchical zone/subnet layout
import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { ChartWrapper } from './ChartWrapper';
import type { VPCDesign } from '@/types/vpcDesign';
import './VPCTopologyDiagram.scss';

interface VPCTopologyDiagramProps {
  title?: string;
  subtitle?: string;
  design: VPCDesign;
  height?: number;
  onSubnetClick?: (subnetId: string) => void;
}

const ZONE_COLORS = ['#0f62fe', '#8a3ffc', '#009d9a'];
const WORKLOAD_COLORS: Record<string, string> = {
  'Web Server': '#0f62fe',
  'Application Server': '#8a3ffc',
  'Database': '#da1e28',
  'Infrastructure': '#009d9a',
  'Middleware': '#ee5396',
  'Default': '#878d96',
};

export function VPCTopologyDiagram({
  title = 'VPC Topology',
  subtitle,
  design,
  height = 500,
  onSubnetClick,
}: VPCTopologyDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const margin = { top: 40, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select(tooltipRef.current);

    // VPC label
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#161616')
      .text(`${design.vpcName} (${design.region})`);

    // VPC border
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'none')
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 2)
      .attr('rx', 8);

    const zones = design.zones;
    const zoneWidth = (innerWidth - 40) / Math.max(zones.length, 1);
    const zoneMargin = 10;

    zones.forEach((zone, zi) => {
      const zx = 20 + zi * zoneWidth;
      const zy = 20;
      const zw = zoneWidth - zoneMargin;
      const zh = innerHeight - 40;

      // Zone background
      g.append('rect')
        .attr('x', zx)
        .attr('y', zy)
        .attr('width', zw)
        .attr('height', zh)
        .attr('fill', `${ZONE_COLORS[zi % ZONE_COLORS.length]}10`)
        .attr('stroke', ZONE_COLORS[zi % ZONE_COLORS.length])
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')
        .attr('rx', 6);

      // Zone label
      g.append('text')
        .attr('x', zx + zw / 2)
        .attr('y', zy + 18)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', '600')
        .attr('fill', ZONE_COLORS[zi % ZONE_COLORS.length])
        .text(zone.name);

      // Subnets in zone
      const subnetHeight = Math.min(50, (zh - 40) / Math.max(zone.subnets.length, 1) - 5);

      zone.subnets.forEach((subnet, si) => {
        const sx = zx + 8;
        const sy = zy + 30 + si * (subnetHeight + 5);
        const sw = zw - 16;
        const color = WORKLOAD_COLORS[subnet.purpose] || WORKLOAD_COLORS['Default'];

        // Subnet box
        const rect = g.append('rect')
          .attr('x', sx)
          .attr('y', sy)
          .attr('width', sw)
          .attr('height', subnetHeight)
          .attr('fill', `${color}20`)
          .attr('stroke', color)
          .attr('stroke-width', 1)
          .attr('rx', 4)
          .attr('cursor', onSubnetClick ? 'pointer' : 'default');

        if (onSubnetClick) {
          rect.on('click', () => onSubnetClick(subnet.id));
        }

        // Tooltip
        rect.on('mouseover', (event) => {
          tooltip
            .style('display', 'block')
            .style('left', `${event.offsetX + 10}px`)
            .style('top', `${event.offsetY - 10}px`)
            .html(`
              <strong>${subnet.name}</strong><br/>
              CIDR: ${subnet.cidr}<br/>
              Source: ${subnet.sourcePortGroup}<br/>
              VMs: ${subnet.vmCount}<br/>
              Purpose: ${subnet.purpose}
            `);
        })
        .on('mouseout', () => {
          tooltip.style('display', 'none');
        });

        // Subnet label
        g.append('text')
          .attr('x', sx + 6)
          .attr('y', sy + subnetHeight / 2 + 4)
          .attr('font-size', '10px')
          .attr('fill', '#161616')
          .text(`${subnet.name} (${subnet.vmCount} VMs)`);
      });
    });

    // Transit Gateway indicator
    if (design.transitGateway.enabled) {
      g.append('rect')
        .attr('x', innerWidth / 2 - 80)
        .attr('y', innerHeight - 10)
        .attr('width', 160)
        .attr('height', 24)
        .attr('fill', '#f4f4f4')
        .attr('stroke', '#0f62fe')
        .attr('stroke-width', 1)
        .attr('rx', 4);

      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#0f62fe')
        .text(`Transit Gateway (${design.transitGateway.connectionType})`);
    }
  }, [design, height, onSubnetClick]);

  return (
    <ChartWrapper title={title} subtitle={subtitle}>
      <div className="vpc-topology" style={{ position: 'relative' }}>
        <svg ref={svgRef} style={{ width: '100%', height }} />
        <div
          ref={tooltipRef}
          className="vpc-topology__tooltip"
          style={{ display: 'none' }}
        />
      </div>
    </ChartWrapper>
  );
}
