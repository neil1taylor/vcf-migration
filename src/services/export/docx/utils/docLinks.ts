// IBM Cloud Virtualization Solutions Documentation Links

const BASE_URL = 'https://cloud.ibm.com/docs/virtualization-solutions?topic=virtualization-solutions-';

function buildUrl(topicId: string): string {
  return `${BASE_URL}${topicId}`;
}

export const DOC_LINKS = {
  // General
  overview: buildUrl('overview'),

  // ROKS / OpenShift Virtualization
  roksArchitecture: buildUrl('virt-sol-rove-architecture'),
  roksMigrationDesign: buildUrl('virt-sol-openshift-migration-design-infrastructure'),
  roksMigrationOverview: buildUrl('virt-sol-openshift-migration-design'),
  migrationToolkit: buildUrl('virt-sol-openshift-migration-design-mtv'),
  vmwareRequirements: buildUrl('virt-sol-openshift-migration-design-migration-vmware'),
  migrationWorkflow: buildUrl('virt-sol-openshift-migration-design-migration-workflow'),
  roksStorage: buildUrl('virt-sol-openshift-storage-design-overview'),
  roksCompute: buildUrl('virt-sol-openshift-compute-design'),
  roksNetworking: buildUrl('virt-sol-openshift-network-design'),
  roksSecurity: buildUrl('virt-sol-openshift-security-design-overview'),
  roksResiliency: buildUrl('virt-sol-openshift-resiliency-design'),
  roksObservability: buildUrl('virt-sol-openshift-openshift-observability-design-overview'),

  // VPC VSI
  vsiArchitecture: buildUrl('virt-sol-vpc-vsi-architecture'),
  vsiMigrationOverview: buildUrl('virt-sol-vpc-migration-design-migration'),
  vsiMigrationDesign: buildUrl('virt-sol-vpc-migration-design-design-overview'),
  vsiPreMigration: buildUrl('virt-sol-vpc-migration-design-premigration'),
  vsiWavePlanning: buildUrl('virt-sol-vpc-migration-design-wave'),
  vsiPostMigration: buildUrl('virt-sol-vpc-migration-design-post'),
  vsiRiskMitigation: buildUrl('virt-sol-vpc-migration-design-risk'),
  vsiMigrationMethods: buildUrl('virt-sol-vpc-migration-design-methods'),
  vsiLinux: buildUrl('virt-sol-vpc-migration-design-linux'),
  vsiWindows: buildUrl('virt-sol-vpc-migration-design-windows'),
  vsiStorage: buildUrl('virt-sol-storage-design-overview'),
  vsiCompute: buildUrl('virt-sol-vpc-compute-design-overview'),
  vsiNetworking: buildUrl('virt-sol-network-design'),
  vsiSecurity: buildUrl('virt-sol-vpc-security-design-overview'),
  vsiResiliency: buildUrl('virt-sol-vpc-vpc-resiliency-design'),
  vsiObservability: buildUrl('virt-sol-vpc-observability-design-overview'),

  // Tools & Tutorials
  rackwareGuide: buildUrl('virt-sol-vpc-migration-design-rmm-guide'),
  rackwareTutorial: buildUrl('virt-sol-vpc-migration-design-rmm-tutorial'),
  mtvTutorial: buildUrl('vsphere-openshift-migration'),
  backupTutorial: buildUrl('virt-sol-openshift-backup'),
  vsiMigrationTutorial: buildUrl('virt-sol-vpc-migration-tutorial-overview'),
} as const;
