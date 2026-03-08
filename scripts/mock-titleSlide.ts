// Mock title slide for preview scripts (no window.location in Node.js)
// Adds a simple text slide instead of fetching an image via HTTP

import type PptxGenJS from 'pptxgenjs';

export function addTitleSlide(pres: PptxGenJS, clientName?: string): void {
  const slide = pres.addSlide({ masterName: 'IMAGE' });
  slide.addText(clientName || 'Preview Client', {
    x: 1,
    y: 5,
    fontSize: 36,
    color: 'FFFFFF',
  });
}
