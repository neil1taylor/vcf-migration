// Platform Recommendation Slide — questions & responses table

import type PptxGenJS from 'pptxgenjs';
import type { PptxExportOptions } from '../types';
import { COLORS, FONTS } from '../types';
import { addSlideTitle, addTable } from '../utils';
import platformSelectionFactors from '@/data/platformSelectionFactors.json';

const ANSWER_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  'not-sure': 'Not Sure',
  'no-preference': 'No Preference',
};

export function addPlatformRecommendationSlide(
  pres: PptxGenJS,
  options: PptxExportOptions
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Platform Recommendation');

  const ps = options.platformSelection;

  if (!ps) {
    slide.addText('Platform selection questionnaire has not been completed.\nComplete it on the Migration Comparison page to see recommendations here.', {
      x: 0.5,
      y: 1.5,
      w: 9.0,
      h: 2.0,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      align: 'center',
      valign: 'middle',
    });
    return;
  }

  const { score, answers } = ps;
  const leaningLabel =
    score.leaning === 'roks' ? 'ROKS (OpenShift)' :
    score.leaning === 'vsi' ? 'VPC VSI' : 'Neutral';

  // Blue subtitle
  slide.addText('IBM Cloud Target Platform Assessment', {
    x: 0.5, y: 0.85, w: 9.0, h: 0.35,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  // Explanatory paragraph
  slide.addText('Based on responses to the platform selection questionnaire, a target IBM Cloud platform is recommended. Each question evaluates factors such as workload type, operational preferences, and infrastructure requirements.', {
    x: 0.5, y: 1.2, w: 9.0, h: 0.6,
    fontSize: FONTS.smallSize,
    fontFace: FONTS.face,
    color: COLORS.darkGray,
  });

  // Recommendation text
  slide.addText([
    { text: 'Recommendation: ', options: { fontSize: FONTS.bodySize, fontFace: FONTS.face, color: COLORS.darkGray, bold: true } },
    { text: leaningLabel, options: { fontSize: FONTS.bodySize + 2, fontFace: FONTS.face, color: COLORS.ibmBlue, bold: true } },
  ], {
    x: 0.5,
    y: 1.75,
    w: 9.0,
    h: 0.4,
    valign: 'middle',
  });

  // Questions & responses table
  const rows: string[][] = platformSelectionFactors.factors.map((factor) => {
    const answer = answers[factor.id];
    const responseLabel = answer ? (ANSWER_LABELS[answer] || '—') : '—';
    return [factor.label, responseLabel];
  });

  addTable(
    slide,
    ['Question', 'Response'],
    rows,
    { y: 2.15, colW: [7.0, 1.5], fontSize: 7 }
  );

  // Cost comparison if available
  const costs: string[] = [];
  if (ps.roksMonthlyCost != null) costs.push(`ROKS: $${ps.roksMonthlyCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`);
  if (ps.vsiMonthlyCost != null) costs.push(`VSI: $${ps.vsiMonthlyCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`);
  if (ps.rovMonthlyCost != null) costs.push(`ROV: $${ps.rovMonthlyCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo`);

  if (costs.length > 0) {
    slide.addText(`Estimated costs: ${costs.join('  |  ')}`, {
      x: 0.5,
      y: 4.7,
      w: 9.0,
      h: 0.3,
      fontSize: FONTS.smallSize,
      fontFace: FONTS.face,
      color: COLORS.darkGray,
    });
  }

  // Answered count note
  slide.addText(`Based on ${score.answeredCount} answered question${score.answeredCount !== 1 ? 's' : ''} in the Platform Selection questionnaire.`, {
    x: 0.5,
    y: 5.1,
    w: 9.0,
    h: 0.3,
    fontSize: FONTS.smallSize,
    fontFace: FONTS.face,
    color: COLORS.mediumGray,
    italic: true,
  });
}
