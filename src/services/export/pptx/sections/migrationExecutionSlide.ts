// Migration Execution Slide — 3-column layout with blue accent bars

import type PptxGenJS from 'pptxgenjs';
import { COLORS, FONTS } from '../types';
import { addSlideTitle } from '../utils';
import { MIGRATION_PHASES } from '@/data/migrationPhases';

export function addMigrationExecutionSlide(pres: PptxGenJS): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Migration Execution');

  // Blue subtitle
  slide.addText('Discover, Design & Configure, Migrate', {
    x: 1.33, y: 1.25, w: 24.0, h: 0.93,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  // Explanatory paragraph
  slide.addText('The migration follows a structured three-phase approach. Each phase builds on the outputs of the previous stage to ensure a controlled, repeatable migration.', {
    x: 1.33, y: 2.05, w: 24.0, h: 1.07,
    fontSize: FONTS.smallSize,
    fontFace: FONTS.face,
    color: COLORS.darkGray,
  });

  const colCount = 3;
  const totalWidth = 24.0;
  const gap = 0.67;
  const arrowW = 0.53;
  const colWidth = (totalWidth - gap * (colCount - 1)) / colCount;
  const startX = 1.33;
  const startY = 3.87;
  const accentH = 0.13;

  for (let i = 0; i < MIGRATION_PHASES.length; i++) {
    const phase = MIGRATION_PHASES[i];
    const colX = startX + i * (colWidth + gap);

    // Phase number label (e.g. "Phase 1")
    slide.addText(`Phase ${i + 1}`, {
      x: colX,
      y: startY - 0.53,
      w: colWidth,
      h: 0.53,
      fontSize: 24,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      bold: true,
      valign: 'bottom',
    });

    // Blue accent bar at top of column
    slide.addShape('rect' as PptxGenJS.ShapeType, {
      x: colX,
      y: startY,
      w: colWidth,
      h: accentH,
      fill: { color: COLORS.ibmBlue },
    });

    // Column heading (bold blue)
    slide.addText(phase.heading, {
      x: colX,
      y: startY + accentH + 0.13,
      w: colWidth,
      h: 0.93,
      fontSize: 37,
      fontFace: FONTS.face,
      color: COLORS.ibmBlue,
      bold: true,
      valign: 'top',
    });

    // Bullet list
    const bulletItems: PptxGenJS.TextProps[] = phase.bullets.map((bullet) => ({
      text: bullet,
      options: {
        fontSize: 21,
        fontFace: FONTS.face,
        color: COLORS.darkGray,
        bullet: true,
        breakType: 'none' as const,
        paraSpaceAfter: 11,
      },
    }));

    slide.addText(bulletItems, {
      x: colX,
      y: startY + accentH + 1.07,
      w: colWidth,
      h: 9.07,
      valign: 'top',
    });

    // Add flow arrow between columns (except after last)
    if (i < MIGRATION_PHASES.length - 1) {
      const arrowX = colX + colWidth + (gap / 2) - (arrowW / 2);
      // Arrow triangle pointing right
      slide.addShape('triangle' as PptxGenJS.ShapeType, {
        x: arrowX,
        y: startY + 0.27,
        w: arrowW,
        h: 0.53,
        fill: { color: COLORS.ibmBlue },
        rotate: 90,
      });
    }
  }
}
