// PPTX Theme — IBM Blue master slides

import PptxGenJS from 'pptxgenjs';
import { COLORS, FONTS } from '../types';

/**
 * Define master slide layouts for the presentation.
 */
export function defineMasterSlides(pres: PptxGenJS): void {
  // TITLE master — full blue background with centered white text
  pres.defineSlideMaster({
    title: 'TITLE',
    background: { color: COLORS.ibmBlue },
    objects: [
      {
        placeholder: {
          options: {
            name: 'title',
            type: 'title',
            x: 1.33,
            y: 3.2,
            w: 24.0,
            h: 4.0,
            fontSize: FONTS.titleSize,
            fontFace: FONTS.face,
            color: COLORS.white,
            bold: true,
            align: 'center',
            valign: 'bottom',
          },
          text: '',
        },
      },
      {
        placeholder: {
          options: {
            name: 'subtitle',
            type: 'body',
            x: 1.33,
            y: 7.47,
            w: 24.0,
            h: 2.67,
            fontSize: FONTS.subtitleSize,
            fontFace: FONTS.face,
            color: COLORS.white,
            align: 'center',
            valign: 'top',
          },
          text: '',
        },
      },
    ],
  });

  // CONTENT master — white background, slide number bottom-right
  pres.defineSlideMaster({
    title: 'CONTENT',
    background: { color: COLORS.white },
    slideNumber: {
      x: 24.27, y: 13.87, w: 1.33, h: 0.8,
      fontSize: 21, color: COLORS.mediumGray,
      fontFace: FONTS.face,
    },
    objects: [],
  });

  // CLOSING master — same as TITLE, with slide number
  pres.defineSlideMaster({
    title: 'CLOSING',
    background: { color: COLORS.ibmBlue },
    slideNumber: {
      x: 24.27, y: 13.87, w: 1.33, h: 0.8,
      fontSize: 21, color: COLORS.white,
      fontFace: FONTS.face,
    },
    objects: [],
  });

  // IMAGE master — blank, no background, no slide number (for full-bleed PNGs)
  pres.defineSlideMaster({
    title: 'IMAGE',
    background: { color: COLORS.white },
    objects: [],
  });
}
