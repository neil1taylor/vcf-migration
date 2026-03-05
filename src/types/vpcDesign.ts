// VPC Network Topology Design Types

export interface VPCSubnet {
  id: string;
  name: string;
  cidr: string;
  sourcePortGroup: string;  // VMware port group
  zone: string;             // us-south-1, us-south-2, us-south-3
  vmCount: number;
  securityGroupId: string;
  purpose: string;          // From workload classification
}

export interface SecurityGroupRule {
  direction: 'inbound' | 'outbound';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  portMin?: number;
  portMax?: number;
  source: string;   // CIDR or SG reference
  description: string;
}

export interface SecurityGroup {
  id: string;
  name: string;
  workloadType: string;
  inboundRules: SecurityGroupRule[];
  outboundRules: SecurityGroupRule[];
}

export interface ACLSuggestion {
  subnetId: string;
  subnetName: string;
  rules: ACLRule[];
}

export interface ACLRule {
  name: string;
  direction: 'inbound' | 'outbound';
  action: 'allow' | 'deny';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  source: string;
  destination: string;
  portMin?: number;
  portMax?: number;
  description?: string;
}

export interface TransitGatewayConfig {
  enabled: boolean;
  connectionType: 'vpc' | 'classic' | 'directlink';
  name: string;
}

export interface VPCZone {
  name: string;
  subnets: VPCSubnet[];
}

export interface VPCDesign {
  region: string;
  vpcName: string;
  zones: VPCZone[];
  subnets: VPCSubnet[];
  securityGroups: SecurityGroup[];
  aclSuggestions: ACLSuggestion[];
  transitGateway: TransitGatewayConfig;
}

export interface VPCDesignData {
  version: number;
  environmentFingerprint: string;
  region: string;
  subnetOverrides: Record<string, Partial<Pick<VPCSubnet, 'cidr' | 'zone' | 'name' | 'securityGroupId'>>>;
  transitGateway: TransitGatewayConfig;
  createdAt: string;
  modifiedAt: string;
}

export const IBM_CLOUD_REGIONS = [
  { id: 'us-south', label: 'Dallas (us-south)' },
  { id: 'us-east', label: 'Washington DC (us-east)' },
  { id: 'eu-gb', label: 'London (eu-gb)' },
  { id: 'eu-de', label: 'Frankfurt (eu-de)' },
  { id: 'jp-tok', label: 'Tokyo (jp-tok)' },
  { id: 'jp-osa', label: 'Osaka (jp-osa)' },
  { id: 'au-syd', label: 'Sydney (au-syd)' },
  { id: 'ca-tor', label: 'Toronto (ca-tor)' },
  { id: 'br-sao', label: 'São Paulo (br-sao)' },
] as const;

export function getZonesForRegion(region: string): string[] {
  return [`${region}-1`, `${region}-2`, `${region}-3`];
}
