// Title Slide — full-page background PNG, no text overlay

import type PptxGenJS from 'pptxgenjs';
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '../types';

export function addTitleSlide(pres: PptxGenJS): void {
  const slide = pres.addSlide({ masterName: 'IMAGE' });

  slide.addImage({
    path: `${window.location.origin}/pptx/slide1.png`,
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: SLIDE_HEIGHT,
  });
}
