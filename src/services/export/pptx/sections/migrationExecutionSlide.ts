// Migration Execution Slide — describes the specialist migration partner's 3 phases

import type PptxGenJS from 'pptxgenjs';
import { COLORS, FONTS, BODY } from '../types';
import { addSlideTitle } from '../utils';

const PHASES: { heading: string; bullets: string[] }[] = [
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

export function addMigrationExecutionSlide(pres: PptxGenJS): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Migration Execution');

  // Build TextProps array with top-level section headers and indented bullets
  const textItems: PptxGenJS.TextProps[] = [];

  for (const phase of PHASES) {
    // Top-level section header (bold, same fontSize as body, no indent)
    textItems.push({
      text: phase.heading,
      options: {
        fontSize: 11,
        fontFace: FONTS.face,
        color: COLORS.darkGray,
        bold: true,
        bullet: { type: 'none' },
        breakType: 'none',
        paraSpaceBefore: 8,
        paraSpaceAfter: 2,
      },
    });

    // Bullet items (indented under each phase)
    for (const bullet of phase.bullets) {
      textItems.push({
        text: bullet,
        options: {
          fontSize: 9,
          fontFace: FONTS.face,
          color: COLORS.darkGray,
          bullet: true,
          indentLevel: 1,
          paraSpaceAfter: 2,
        },
      });
    }
  }

  slide.addText(textItems, {
    x: BODY.x,
    y: 0.9,
    w: BODY.w,
    h: 4.3,
    valign: 'top',
  });
}
