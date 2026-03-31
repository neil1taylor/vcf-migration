/** Migration execution phases — shared between DOCX and PPTX exports */
export interface MigrationPhase {
  heading: string;
  bullets: string[];
}

export const MIGRATION_PHASES: MigrationPhase[] = [
  {
    heading: 'Discover',
    bullets: [
      'Discover all VLANs, bare metals, VSIs, file/block storage, DNS, and security groups in IBM Cloud Classic',
      'Discover all ESXi hosts, vSphere clusters, NSX networking, vSAN/NFS datastores, and VM inventory',
    ],
  },
  {
    heading: 'Design & Configure',
    bullets: [
      'Design the target VPC environment (subnets, security groups, routing, transit gateways)',
      'Configure IAM policies, access groups, and service-to-service authorizations',
      'Translate NSX firewall rules and micro-segmentation to VPC security groups and ACLs',
      'Map source VLANs and port groups to target VPC subnets and address ranges',
      'Assess application readiness and dependency mapping for migration wave planning',
      'Reconcile Classic and VMware configurations into a unified target architecture',
    ],
  },
  {
    heading: 'Migration',
    bullets: [
      'Migrate bare metal and VSI workloads from Classic infrastructure to VPC',
      'Migrate SQL databases and application data with minimal downtime',
      'Migrate VMware Classic VMs to VPC VSIs using RackWare or similar tooling',
      'Migrate Classic VMware workloads to IBM Cloud for VMware as a Service (VCF as a Service)',
      'Map and validate infrastructure configurations (DNS, load balancers, certificates)',
      'Leverage IBM Migration Partner automation suite for repeatable, auditable migrations',
    ],
  },
];
