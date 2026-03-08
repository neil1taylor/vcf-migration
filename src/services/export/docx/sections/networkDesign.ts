// Network Design DOCX Section

import { HeadingLevel } from 'docx';
import type { VPCDesign } from '@/types/vpcDesign';
import type { DocumentContent } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableDescription, createTableLabel } from '../utils/helpers';

/**
 * Build the network design section.
 * @param design VPC design data
 * @param inline When true, omits the top-level heading (used when embedded in another section)
 */
export function buildNetworkDesignSection(design: VPCDesign, inline?: boolean): DocumentContent[] {
  const sections: DocumentContent[] = [];

  if (!inline) {
    sections.push(
      createHeading('VPC Network Design', HeadingLevel.HEADING_1),
    );
  }

  sections.push(
    createParagraph(`Target VPC: ${design.vpcName} in region ${design.region}`),
    createParagraph(`${design.subnets.length} subnets across ${design.zones.filter(z => z.subnets.length > 0).length} availability zones with ${design.securityGroups.length} security groups.`),
  );

  // Subnet mapping table
  if (design.subnets.length > 0) {
    const headingLevel = inline ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2;
    sections.push(createHeading('Subnet Mapping', headingLevel));
    const subnetHeaders = ['Subnet', 'CIDR', 'Zone', 'Source Port Group', 'VMs', 'Purpose'];
    const subnetRows = design.subnets.map(s => [
      s.name, s.cidr, s.zone, s.sourcePortGroup, s.vmCount.toString(), s.purpose,
    ]);
    sections.push(
      ...createTableDescription('VPC Subnet Mapping', 'VMware port groups mapped to IBM Cloud VPC subnets'),
      createStyledTable(subnetHeaders, subnetRows),
      createTableLabel('VPC Subnet Mapping'),
    );
  }

  // Security group summary
  if (design.securityGroups.length > 0) {
    const headingLevel = inline ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2;
    sections.push(createHeading('Security Groups', headingLevel));
    const sgHeaders = ['Security Group', 'Workload Type', 'Inbound Rules', 'Outbound Rules'];
    const sgRows = design.securityGroups.map(sg => [
      sg.name, sg.workloadType, sg.inboundRules.length.toString(), sg.outboundRules.length.toString(),
    ]);
    sections.push(
      ...createTableDescription('Security Group Summary', 'Security groups generated from workload classification'),
      createStyledTable(sgHeaders, sgRows),
      createTableLabel('Security Group Summary'),
    );
  }

  // Transit Gateways
  const enabledGateways = design.transitGateways.filter(gw => gw.enabled);
  if (enabledGateways.length > 0) {
    const headingLevel = inline ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2;
    sections.push(createHeading('Transit Gateways', headingLevel));
    const tgwHeaders = ['Gateway', 'Connection', 'Type'];
    const tgwRows = enabledGateways.flatMap(gw =>
      gw.connections.length > 0
        ? gw.connections.map(conn => [gw.name, conn.name, conn.connectionType])
        : [[gw.name, '(no connections)', '']]
    );
    sections.push(
      ...createTableDescription('Transit Gateway Configuration', 'Transit gateways connecting the VPC to other networks'),
      createStyledTable(tgwHeaders, tgwRows),
      createTableLabel('Transit Gateway Configuration'),
    );
  }

  return sections;
}
