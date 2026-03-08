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
            x: 0.5,
            y: 1.2,
            w: 9.0,
            h: 1.5,
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
            x: 0.5,
            y: 2.8,
            w: 9.0,
            h: 1.0,
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

  // CONTENT master — white background, no title bar
  pres.defineSlideMaster({
    title: 'CONTENT',
    background: { color: COLORS.white },
    objects: [],
  });

  // CLOSING master — same as TITLE
  pres.defineSlideMaster({
    title: 'CLOSING',
    background: { color: COLORS.ibmBlue },
    objects: [],
  });

  // IMAGE master — blank, no background, no slide number (for full-bleed PNGs)
  pres.defineSlideMaster({
    title: 'IMAGE',
    background: { color: COLORS.white },
    objects: [],
  });
}
