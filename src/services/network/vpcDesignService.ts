// VPC Network Design Service
// Maps VMware port groups to IBM Cloud VPC subnets, security groups, and ACLs

import type { RVToolsData, VNetworkInfo } from '@/types/rvtools';
import type {
  VPCDesign,
  VPCSubnet,
  VPCZone,
  SecurityGroup,
  SecurityGroupRule,
  ACLSuggestion,
  ACLRule,
  VPCDesignData,
} from '@/types/vpcDesign';
import { getZonesForRegion } from '@/types/vpcDesign';
import sgTemplates from '@/data/vpcSecurityGroupTemplates.json';

// ===== PORT GROUP MAPPING =====

interface PortGroupSummary {
  name: string;
  vmCount: number;
  vmNames: string[];
  workloadType: string;
  subnet?: string;
}

function summarizePortGroups(
  rawData: RVToolsData,
  subnetOverrides: Record<string, string>,
  workloadMap: Record<string, string>
): PortGroupSummary[] {
  const groups = new Map<string, PortGroupSummary>();

  // Only active VMs
  const activeVMNames = new Set(
    rawData.vInfo
      .filter(vm => vm.powerState === 'poweredOn' && !vm.template)
      .map(vm => vm.vmName)
  );

  rawData.vNetwork.forEach((nic: VNetworkInfo) => {
    if (!activeVMNames.has(nic.vmName)) return;
    const pgName = nic.networkName || 'Unknown';

    if (!groups.has(pgName)) {
      groups.set(pgName, {
        name: pgName,
        vmCount: 0,
        vmNames: [],
        workloadType: 'Default',
        subnet: subnetOverrides[pgName],
      });
    }

    const group = groups.get(pgName)!;
    if (!group.vmNames.includes(nic.vmName)) {
      group.vmNames.push(nic.vmName);
      group.vmCount++;
    }

    // Use first VM's workload type for the group
    const vmWorkload = workloadMap[nic.vmName];
    if (vmWorkload && group.workloadType === 'Default') {
      group.workloadType = vmWorkload;
    }
  });

  return Array.from(groups.values()).sort((a, b) => b.vmCount - a.vmCount);
}

// ===== SUBNET GENERATION =====

function mapPortGroupsToSubnets(
  portGroups: PortGroupSummary[],
  zones: string[],
  overrides?: VPCDesignData
): VPCSubnet[] {
  return portGroups.map((pg, index) => {
    const id = `subnet-${index}`;
    const overrideData = overrides?.subnetOverrides?.[id];
    const zoneIndex = index % zones.length;

    return {
      id,
      name: overrideData?.name ?? `sn-${pg.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)}`,
      cidr: overrideData?.cidr ?? pg.subnet ?? `10.${240 + Math.floor(index / 256)}.${index % 256}.0/24`,
      sourcePortGroup: pg.name,
      zone: overrideData?.zone ?? zones[zoneIndex],
      vmCount: pg.vmCount,
      securityGroupId: overrideData?.securityGroupId ?? `sg-${pg.workloadType.toLowerCase().replace(/\s+/g, '-')}`,
      purpose: pg.workloadType,
    };
  });
}

// ===== ZONE DISTRIBUTION =====

function distributeToZones(subnets: VPCSubnet[], zones: string[]): VPCZone[] {
  const zoneMap = new Map<string, VPCSubnet[]>();
  zones.forEach(z => zoneMap.set(z, []));

  subnets.forEach(subnet => {
    const zone = zoneMap.has(subnet.zone) ? subnet.zone : zones[0];
    zoneMap.get(zone)!.push(subnet);
  });

  return zones.map(name => ({
    name,
    subnets: zoneMap.get(name) || [],
  }));
}

// ===== SECURITY GROUPS =====

type TemplateRule = { protocol: string; portMin?: number; portMax?: number; source: string; description: string };

function generateSecurityGroups(subnets: VPCSubnet[]): SecurityGroup[] {
  const workloadTypes = [...new Set(subnets.map(s => s.purpose))];
  const templates = sgTemplates.templates as Record<string, { inbound: TemplateRule[]; outbound: TemplateRule[] }>;

  return workloadTypes.map(wt => {
    const template = templates[wt] || templates['Default'];
    const sgId = `sg-${wt.toLowerCase().replace(/\s+/g, '-')}`;

    const inboundRules: SecurityGroupRule[] = template.inbound.map(r => ({
      direction: 'inbound' as const,
      protocol: r.protocol as SecurityGroupRule['protocol'],
      portMin: r.portMin,
      portMax: r.portMax,
      source: r.source,
      description: r.description,
    }));

    const outboundRules: SecurityGroupRule[] = template.outbound.map(r => ({
      direction: 'outbound' as const,
      protocol: r.protocol as SecurityGroupRule['protocol'],
      portMin: r.portMin,
      portMax: r.portMax,
      source: r.source,
      description: r.description,
    }));

    return {
      id: sgId,
      name: `sg-${wt.toLowerCase().replace(/\s+/g, '-')}`,
      workloadType: wt,
      inboundRules,
      outboundRules,
    };
  });
}

// ===== ACL SUGGESTIONS =====

function generateACLSuggestions(subnets: VPCSubnet[]): ACLSuggestion[] {
  return subnets.map(subnet => {
    const rules: ACLRule[] = [
      {
        name: `allow-inbound-${subnet.name}`,
        direction: 'inbound',
        action: 'allow',
        protocol: 'all',
        source: '10.0.0.0/8',
        destination: subnet.cidr,
        description: 'Allow internal traffic',
      },
      {
        name: `allow-outbound-${subnet.name}`,
        direction: 'outbound',
        action: 'allow',
        protocol: 'all',
        source: subnet.cidr,
        destination: '0.0.0.0/0',
        description: 'Allow all outbound',
      },
      {
        name: `deny-all-inbound-${subnet.name}`,
        direction: 'inbound',
        action: 'deny',
        protocol: 'all',
        source: '0.0.0.0/0',
        destination: subnet.cidr,
        description: 'Deny all other inbound',
      },
    ];

    return { subnetId: subnet.id, subnetName: subnet.name, rules };
  });
}

// ===== MAIN BUILDER =====

export function buildVPCDesign(
  rawData: RVToolsData | null,
  region: string,
  subnetOverrides: Record<string, string>,
  workloadMap: Record<string, string>,
  designOverrides?: VPCDesignData
): VPCDesign {
  const zones = getZonesForRegion(region);
  const defaultDesign: VPCDesign = {
    region,
    vpcName: `vpc-migration-${region}`,
    zones: zones.map(name => ({ name, subnets: [] })),
    subnets: [],
    securityGroups: [],
    aclSuggestions: [],
    transitGateway: designOverrides?.transitGateway ?? {
      enabled: false,
      connectionType: 'vpc',
      name: `tgw-${region}`,
    },
  };

  if (!rawData) return defaultDesign;

  const portGroups = summarizePortGroups(rawData, subnetOverrides, workloadMap);
  if (portGroups.length === 0) return defaultDesign;

  const subnets = mapPortGroupsToSubnets(portGroups, zones, designOverrides);
  const vpcZones = distributeToZones(subnets, zones);
  const securityGroups = generateSecurityGroups(subnets);
  const aclSuggestions = generateACLSuggestions(subnets);

  return {
    region,
    vpcName: `vpc-migration-${region}`,
    zones: vpcZones,
    subnets,
    securityGroups,
    aclSuggestions,
    transitGateway: designOverrides?.transitGateway ?? defaultDesign.transitGateway,
  };
}
