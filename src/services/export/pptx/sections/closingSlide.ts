// Closing Slide — partner info, contact details

import type PptxGenJS from 'pptxgenjs';
import type { PptxExportOptions } from '../types';
import { FONTS, COLORS } from '../types';

export function addClosingSlide(pres: PptxGenJS, options: PptxExportOptions): void {
  const slide = pres.addSlide({ masterName: 'CLOSING' });

  slide.addText('Thank You', {
    x: 1.33,
    y: 3.2,
    w: 24.0,
    h: 2.67,
    fontSize: FONTS.titleSize,
    fontFace: FONTS.face,
    color: COLORS.white,
    bold: true,
    align: 'center',
    valign: 'bottom',
  });

  const contactLines: string[] = [];
  if (options.companyName) contactLines.push(options.companyName);
  if (options.preparedBy) contactLines.push(`Prepared by: ${options.preparedBy}`);
  contactLines.push('IBM Cloud Migration Services');

  slide.addText(contactLines.join('\n'), {
    x: 1.33,
    y: 6.67,
    w: 24.0,
    h: 4.0,
    fontSize: FONTS.subtitleSize,
    fontFace: FONTS.face,
    color: COLORS.white,
    align: 'center',
    valign: 'top',
    lineSpacingMultiple: 1.5,
  });
}
