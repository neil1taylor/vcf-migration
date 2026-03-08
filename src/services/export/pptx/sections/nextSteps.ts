// Next Steps Slide — action items as bullet list

import type PptxGenJS from 'pptxgenjs';
import { COLORS, FONTS } from '../types';
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

  // Blue subtitle
  slide.addText('Recommended Actions', {
    x: 0.5, y: 0.47, w: 9.0, h: 0.35,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  // Explanatory paragraph
  slide.addText('The following steps outline the recommended path forward for progressing the migration from assessment to execution.', {
    x: 0.5, y: 0.77, w: 9.0, h: 0.4,
    fontSize: FONTS.smallSize,
    fontFace: FONTS.face,
    color: COLORS.darkGray,
  });

  addBulletList(slide, DEFAULT_NEXT_STEPS, {
    y: 1.15,
    h: 3.5,
    fontSize: 11,
  });

}
