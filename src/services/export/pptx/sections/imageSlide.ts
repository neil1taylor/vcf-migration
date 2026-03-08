// Image Slide — full-page background PNG, no text or overlays

import type PptxGenJS from 'pptxgenjs';
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '../types';

/**
 * Add a full-bleed image slide with no text, footer, or slide number.
 */
export function addImageSlide(pres: PptxGenJS, imagePath: string): void {
  const slide = pres.addSlide({ masterName: 'IMAGE' });

  slide.addImage({
    path: imagePath,
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: SLIDE_HEIGHT,
  });
}
