// design_vpc — VPC subnet/SG/ACL generation from network data

import { requireData } from '../lib/state';
import { buildVPCDesign } from '@/services/network/vpcDesignService';

export function designVpc(region: string): { content: Array<{ type: 'text'; text: string }> } {
  const data = requireData();

  // No subnet overrides or workload map in MCP context — use defaults
  const design = buildVPCDesign(data, region, {}, {});

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        region: design.region,
        vpcName: design.vpcName,
        zones: design.zones.map(z => ({
          name: z.name,
          subnetCount: z.subnets.length,
        })),
        subnets: design.subnets.map(s => ({
          name: s.name,
          zone: s.zone,
          cidr: s.cidr,
          vmCount: s.vmCount,
          workloadType: s.workloadType,
          sourcePortGroup: s.sourcePortGroup,
        })),
        securityGroups: design.securityGroups.map(sg => ({
          name: sg.name,
          ruleCount: sg.rules.length,
          description: sg.description,
        })),
        aclSuggestions: design.aclSuggestions.map(acl => ({
          name: acl.name,
          ruleCount: acl.rules.length,
        })),
      }, null, 2),
    }],
  };
}
