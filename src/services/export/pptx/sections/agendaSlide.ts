// Agenda Slide — auto-generated bullet list of content slide titles

import type PptxGenJS from 'pptxgenjs';
import { addSlideTitle, addBulletList } from '../utils';

/**
 * Add an agenda slide listing all content slide titles.
 */
export function addAgendaSlide(pres: PptxGenJS, contentTitles: string[]): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Agenda');

  addBulletList(slide, contentTitles, {
    y: 1.25,
    h: 11.2,
    fontSize: 43,
  });
}
