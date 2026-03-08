// Main PPTX Report Generator
// Orchestrates section builders to generate a summary presentation deck

import PptxGenJS from 'pptxgenjs';
import type { RVToolsData } from '@/types/rvtools';
import reportTemplates from '@/data/reportTemplates.json';
import { type PptxExportOptions, SLIDE_LAYOUT } from './types';
import { calculateROKSSizing, calculateVSIMappings } from '../docx/utils/calculations';
import { defineMasterSlides } from './utils';
import {
  addTitleSlide,
  addImageSlide,
  addAgendaSlide,
  addExecutiveSummarySlide,
  addMigrationStatsSlide,
  addExcludedVMsSlide,
  addPlatformRecommendationSlide,
  addCostEstimationSlide,
  addWavePlanningSlide,
  addMigrationExecutionSlide,
  addNextStepsSlide,
} from './sections';

// Re-export types
export type { PptxExportOptions } from './types';

/**
 * Generate a PPTX summary presentation deck.
 */
export async function generatePptxReport(
  rawData: RVToolsData,
  options: PptxExportOptions = {}
): Promise<Blob> {
  const finalOptions: Required<PptxExportOptions> = {
    clientName: options.clientName || reportTemplates.placeholders.clientName,
    preparedBy: options.preparedBy || reportTemplates.placeholders.preparedBy,
    companyName: options.companyName || reportTemplates.placeholders.companyName,
    includeROKS: options.includeROKS ?? true,
    includeVSI: options.includeVSI ?? true,
    includeCosts: options.includeCosts ?? true,
    platformSelection: options.platformSelection ?? null,
    wavePlanningPreference: options.wavePlanningPreference ?? null,
  };

  // Create presentation
  const pres = new PptxGenJS();
  pres.layout = SLIDE_LAYOUT;
  pres.title = `VMware Migration Assessment - ${finalOptions.clientName}`;
  pres.author = finalOptions.preparedBy;
  pres.company = finalOptions.companyName;
  pres.subject = 'VMware to IBM Cloud Migration Assessment';

  // Define master slides (theme)
  defineMasterSlides(pres);

  // Calculate data (reuse from DOCX calculations)
  const roksSizing = calculateROKSSizing(rawData);
  const vsiMappings = calculateVSIMappings(rawData);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Build content titles for agenda (based on which slides are included)
  const contentTitles: string[] = [
    'Executive Summary',
    'Migration Readiness',
    'Excluded VMs',
    'Platform Recommendation',
  ];
  const includeCosts = finalOptions.includeCosts && (finalOptions.includeROKS || finalOptions.includeVSI);
  if (includeCosts) {
    contentTitles.push('Cost Estimation');
  }
  contentTitles.push('Migration Wave Planning');
  contentTitles.push('Migration Execution');
  contentTitles.push('Next Steps');

  // Slide 1: Title image
  addTitleSlide(pres);

  // Slide 2: Agenda
  addAgendaSlide(pres, contentTitles);

  // Slides 3-4: Section divider images
  addImageSlide(pres, `${baseUrl}/pptx/slide3.png`);
  addImageSlide(pres, `${baseUrl}/pptx/slide4.png`);

  // Content slides
  addExecutiveSummarySlide(pres, rawData);
  addMigrationStatsSlide(pres, rawData, finalOptions.platformSelection?.score?.leaning ?? 'neutral');
  addExcludedVMsSlide(pres, rawData);
  addPlatformRecommendationSlide(pres, finalOptions);

  if (includeCosts) {
    addCostEstimationSlide(pres, roksSizing, vsiMappings, finalOptions);
  }

  addWavePlanningSlide(pres, rawData, finalOptions);
  addMigrationExecutionSlide(pres);
  addNextStepsSlide(pres);

  // Generate blob
  const output = await pres.write({ outputType: 'blob' });
  return output as Blob;
}

/**
 * Generate and download a PPTX summary presentation.
 */
export async function downloadPptx(
  rawData: RVToolsData,
  options: PptxExportOptions = {},
  filename?: string
): Promise<void> {
  const blob = await generatePptxReport(rawData, options);

  const date = new Date().toISOString().split('T')[0];
  const clientName = options.clientName?.replace(/[^a-zA-Z0-9]/g, '-') || 'client';
  const finalFilename = filename || `migration-assessment_${clientName}_${date}.pptx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
