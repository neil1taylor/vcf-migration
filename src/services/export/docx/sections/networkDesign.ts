// Network Design DOCX Section

import { HeadingLevel } from 'docx';
import type { VPCDesign } from '@/types/vpcDesign';
import type { DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableCaption } from '../utils/helpers';

export function buildNetworkDesignSection(design: VPCDesign): DocumentContent[] {
  const sections: DocumentContent[] = [
    createHeading('VPC Network Design', HeadingLevel.HEADING_1),
    createParagraph(`Target VPC: ${design.vpcName} in region ${design.region}`),
    createParagraph(`${design.subnets.length} subnets across ${design.zones.filter(z => z.subnets.length > 0).length} availability zones with ${design.securityGroups.length} security groups.`),
  ];

  // Subnet mapping table
  if (design.subnets.length > 0) {
    sections.push(createHeading('Subnet Mapping', HeadingLevel.HEADING_2));
    const subnetHeaders = ['Subnet', 'CIDR', 'Zone', 'Source Port Group', 'VMs', 'Purpose'];
    const subnetRows = design.subnets.map(s => [
      s.name, s.cidr, s.zone, s.sourcePortGroup, s.vmCount.toString(), s.purpose,
    ]);
    sections.push(
      ...createTableCaption('VPC Subnet Mapping', 'VMware port groups mapped to IBM Cloud VPC subnets'),
      createStyledTable(subnetHeaders, subnetRows),
    );
  }

  // Security group summary
  if (design.securityGroups.length > 0) {
    sections.push(createHeading('Security Groups', HeadingLevel.HEADING_2));
    const sgHeaders = ['Security Group', 'Workload Type', 'Inbound Rules', 'Outbound Rules'];
    const sgRows = design.securityGroups.map(sg => [
      sg.name, sg.workloadType, sg.inboundRules.length.toString(), sg.outboundRules.length.toString(),
    ]);
    sections.push(
      ...createTableCaption('Security Group Summary', 'Security groups generated from workload classification'),
      createStyledTable(sgHeaders, sgRows),
    );
  }

  // Transit Gateways
  const enabledGateways = design.transitGateways.filter(gw => gw.enabled);
  if (enabledGateways.length > 0) {
    sections.push(createHeading('Transit Gateways', HeadingLevel.HEADING_2));
    const tgwHeaders = ['Gateway', 'Connection', 'Type'];
    const tgwRows = enabledGateways.flatMap(gw =>
      gw.connections.length > 0
        ? gw.connections.map(conn => [gw.name, conn.name, conn.connectionType])
        : [[gw.name, '(no connections)', '']]
    );
    sections.push(
      ...createTableCaption('Transit Gateway Configuration', 'Transit gateways connecting the VPC to other networks'),
      createStyledTable(tgwHeaders, tgwRows),
    );
  }

  return sections;
}
