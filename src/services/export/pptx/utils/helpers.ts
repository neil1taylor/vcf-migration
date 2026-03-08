// PPTX shared helper functions

import type PptxGenJS from 'pptxgenjs';
import { BODY, FONTS, COLORS } from '../types';

/**
 * Add a title at the top of a CONTENT slide (dark gray text on white).
 */
export function addSlideTitle(slide: PptxGenJS.Slide, title: string): void {
  slide.addText(title, {
    x: 0.5,
    y: 0.15,
    w: 9.0,
    h: 0.6,
    fontSize: 20,
    fontFace: FONTS.face,
    color: COLORS.darkGray,
    bold: true,
    valign: 'middle',
  });
}

/**
 * Add a styled table to a slide.
 */
export function addTable(
  slide: PptxGenJS.Slide,
  headers: string[],
  rows: (string | number)[][],
  options: {
    x?: number;
    y?: number;
    w?: number;
    fontSize?: number;
    colW?: number[];
  } = {}
): void {
  const headerRow: PptxGenJS.TableRow = headers.map((h) => ({
    text: h,
    options: {
      bold: true,
      fill: { color: COLORS.ibmBlue },
      color: COLORS.white,
      fontSize: options.fontSize ?? FONTS.smallSize,
      fontFace: FONTS.face,
      valign: 'middle' as const,
      align: 'left' as const,
    },
  }));

  const dataRows: PptxGenJS.TableRow[] = rows.map((row, rowIdx) =>
    row.map((cell) => ({
      text: String(cell),
      options: {
        fontSize: options.fontSize ?? FONTS.smallSize,
        fontFace: FONTS.face,
        color: COLORS.darkGray,
        fill: { color: rowIdx % 2 === 0 ? COLORS.white : COLORS.lightGray },
        valign: 'middle' as const,
        align: 'left' as const,
      },
    }))
  );

  slide.addTable([headerRow, ...dataRows], {
    x: options.x ?? BODY.x,
    y: options.y ?? BODY.y,
    w: options.w ?? BODY.w,
    colW: options.colW,
    border: { type: 'solid', pt: 0.5, color: COLORS.mediumGray },
    autoPage: false,
  });
}

/**
 * Add a bullet list to a slide.
 */
export function addBulletList(
  slide: PptxGenJS.Slide,
  items: string[],
  options: {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    fontSize?: number;
  } = {}
): void {
  const textItems: PptxGenJS.TextProps[] = items.map((item) => ({
    text: item,
    options: {
      fontSize: options.fontSize ?? FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.darkGray,
      bullet: true,
      breakType: 'none' as const,
      paraSpaceAfter: 6,
    },
  }));

  slide.addText(textItems, {
    x: options.x ?? BODY.x,
    y: options.y ?? BODY.y,
    w: options.w ?? BODY.w,
    h: options.h ?? BODY.maxH,
    valign: 'top',
  });
}

/**
 * Add a large KPI number with a label.
 */
export function addKPINumber(
  slide: PptxGenJS.Slide,
  label: string,
  value: string | number,
  position: { x: number; y: number; w: number }
): void {
  slide.addText(String(value), {
    x: position.x,
    y: position.y,
    w: position.w,
    h: 0.7,
    fontSize: FONTS.kpiSize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
    align: 'center',
    valign: 'bottom',
  });
  slide.addText(label, {
    x: position.x,
    y: position.y + 0.7,
    w: position.w,
    h: 0.4,
    fontSize: FONTS.smallSize,
    fontFace: FONTS.face,
    color: COLORS.mediumGray,
    align: 'center',
    valign: 'top',
  });
}

/**
 * Add a footer line at the bottom of a slide.
 */
export function addFooter(slide: PptxGenJS.Slide, companyName: string): void {
  slide.addText(companyName, {
    x: 0.5,
    y: 5.2,
    w: 9.0,
    h: 0.3,
    fontSize: 8,
    fontFace: FONTS.face,
    color: COLORS.mediumGray,
    align: 'left',
    valign: 'bottom',
  });
}

/**
 * Format a number with commas.
 */
export function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Format currency (USD).
 */
export function fmtCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
