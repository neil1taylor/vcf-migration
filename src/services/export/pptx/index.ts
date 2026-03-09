// Main PPTX Report Generator
// Orchestrates section builders to generate a summary presentation deck

import PptxGenJS from 'pptxgenjs';
import type { RVToolsData } from '@/types/rvtools';
import reportTemplates from '@/data/reportTemplates.json';
import { type PptxExportOptions, SLIDE_WIDTH, SLIDE_HEIGHT, CUSTOM_LAYOUT_NAME } from './types';
import { calculateROKSSizing, calculateVSIMappings } from '../docx/utils/calculations';
import { defineMasterSlides, injectReferenceSlides } from './utils';
import {
  addTitleSlide,
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
  // filteredRawData: pre-filtered by exclusion model for target/migration sections
  const filteredRawData = options.filteredRawData ?? rawData;

  const finalOptions: Required<Omit<PptxExportOptions, 'filteredRawData'>> = {
    clientName: options.clientName || reportTemplates.placeholders.clientName,
    preparedBy: options.preparedBy || reportTemplates.placeholders.preparedBy,
    companyName: options.companyName || reportTemplates.placeholders.companyName,
    includeROKS: options.includeROKS ?? true,
    includeVSI: options.includeVSI ?? true,
    includeCosts: options.includeCosts ?? true,
    platformSelection: options.platformSelection ?? null,
    wavePlanningPreference: options.wavePlanningPreference ?? null,
    roksCostEstimate: options.roksCostEstimate ?? null,
    vsiCostEstimate: options.vsiCostEstimate ?? null,
    timelinePhases: options.timelinePhases ?? null,
    timelineStartDate: options.timelineStartDate,
  };

  // Create presentation
  const pres = new PptxGenJS();

  // Define custom wide layout matching IBM reference deck
  pres.defineLayout({ name: CUSTOM_LAYOUT_NAME, width: SLIDE_WIDTH, height: SLIDE_HEIGHT });
  pres.layout = CUSTOM_LAYOUT_NAME;

  pres.title = `VMware Migration Assessment - ${finalOptions.clientName}`;
  pres.author = finalOptions.preparedBy;
  pres.company = finalOptions.companyName;
  pres.subject = 'VMware to IBM Cloud Migration Assessment';

  // Define master slides (theme)
  defineMasterSlides(pres);

  // Calculate data using filtered data (target sections)
  const roksSizing = calculateROKSSizing(filteredRawData);
  const vsiMappings = calculateVSIMappings(filteredRawData);

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
  contentTitles.push('Migration Timeline');
  contentTitles.push('Migration Execution');
  contentTitles.push('Next Steps');

  // Slide 1: Title image
  addTitleSlide(pres);

  // Slide 2: Agenda
  addAgendaSlide(pres, contentTitles);

  // Slides 3-4: Placeholder slides (content replaced by reference XML post-processing)
  pres.addSlide({ masterName: 'CONTENT' });
  pres.addSlide({ masterName: 'CONTENT' });

  // Content slides — source sections use rawData, target sections use filteredRawData
  addExecutiveSummarySlide(pres, rawData);
  addMigrationStatsSlide(pres, filteredRawData, finalOptions.platformSelection?.score?.leaning ?? 'neutral');
  addExcludedVMsSlide(pres, rawData);
  addPlatformRecommendationSlide(pres, finalOptions);

  if (includeCosts) {
    addCostEstimationSlide(pres, roksSizing, vsiMappings, finalOptions, finalOptions.roksCostEstimate, finalOptions.vsiCostEstimate);
  }

  addWavePlanningSlide(pres, filteredRawData, finalOptions);
  addMigrationExecutionSlide(pres);
  addNextStepsSlide(pres);

  // Generate blob and inject reference slides
  const output = await pres.write({ outputType: 'blob' });
  const finalBlob = await injectReferenceSlides(output as Blob);
  return finalBlob;
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
