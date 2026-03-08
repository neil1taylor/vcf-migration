// Next Steps Slide — action items as bullet list

import type PptxGenJS from 'pptxgenjs';
import { addSlideTitle, addBulletList } from '../utils';

const DEFAULT_NEXT_STEPS = [
  'Review migration readiness findings and resolve identified blockers',
  'Complete the Platform Selection questionnaire to determine ROKS vs VSI fit',
  'Validate VM-to-target assignments and adjust overrides as needed',
  'Finalize wave planning and migration timeline with stakeholders',
  'Provision IBM Cloud infrastructure (VPC, subnets, security groups)',
  'Execute pilot migration with a small batch of non-critical workloads',
  'Plan and schedule production migration waves',
];

export function addNextStepsSlide(
  pres: PptxGenJS
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Next Steps');

  addBulletList(slide, DEFAULT_NEXT_STEPS, {
    y: 1.0,
    h: 3.8,
    fontSize: 13,
  });

}
