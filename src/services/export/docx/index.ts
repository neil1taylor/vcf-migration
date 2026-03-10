// Main DOCX Report Generator
// This orchestrates the modular section builders to generate the full report
// Section order: recommendation-led narrative (recommend → detail → execute)

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  AlignmentType,
  convertInchesToTwip,
  TableOfContents,
  HeadingLevel,
  PageBreak,
} from 'docx';
import type { RVToolsData } from '@/types/rvtools';
import reportTemplates from '@/data/reportTemplates.json';
import { type DocxExportOptions, type DocumentContent, FONT_FAMILY, STYLES } from './types';
import { calculateVMReadiness, calculateROKSSizing, calculateVSIMappings } from './utils/calculations';
import { resetCaptionCounters } from './utils/helpers';
import { createSectionCounter } from './utils/sectionCounter';
import {
  buildCoverPage,
  buildExecutiveSummary,
  buildAssumptionsAndScope,
  buildEnvironmentAnalysis,
  buildMigrationReadiness,
  buildMigrationOptions,
  buildMigrationStrategy,
  buildROKSOverview,
  buildVSIOverview,
  buildCostEstimation,
  buildDay2OperationsSection,
  buildNextSteps,
  buildAppendices,
  buildRiskAssessmentSection,
  buildTimelineSection,
  buildComplexityAssessment,
  buildOSCompatibilitySection,
  buildWorkloadClassification,
  buildPlatformRecommendation,
} from './sections';

// Re-export types for consumers
export type { DocxExportOptions, VMReadiness, ROKSSizing, VSIMapping } from './types';

/**
 * Generate a DOCX migration assessment report
 */
export async function generateDocxReport(
  rawData: RVToolsData,
  options: DocxExportOptions = {}
): Promise<Blob> {
  const aiInsights = options.aiInsights ?? null;

  // filteredRawData: pre-filtered by exclusion model for target/migration sections
  // Falls back to rawData when not provided (backward compat)
  const filteredRawData = options.filteredRawData ?? rawData;

  const finalOptions: Required<Omit<DocxExportOptions, 'filteredRawData'>> = {
    clientName: options.clientName || reportTemplates.placeholders.clientName,
    preparedBy: options.preparedBy || reportTemplates.placeholders.preparedBy,
    companyName: options.companyName || reportTemplates.placeholders.companyName,
    includeROKS: options.includeROKS ?? true,
    includeVSI: options.includeVSI ?? true,
    includeCosts: options.includeCosts ?? true,
    maxIssueVMs: options.maxIssueVMs ?? 20,
    aiInsights: aiInsights,
    riskAssessment: options.riskAssessment ?? null,
    timelinePhases: options.timelinePhases ?? null,
    timelineStartDate: options.timelineStartDate ?? new Date(),
    vpcDesign: options.vpcDesign ?? null,
    wavePlanningPreference: options.wavePlanningPreference ?? null,
    platformSelection: options.platformSelection ?? null,
    includeAppendices: options.includeAppendices ?? true,
    targetAssignments: options.targetAssignments ?? null,
    workloadClassification: options.workloadClassification ?? null,
    sourceEnvironment: options.sourceEnvironment ?? null,
    roksCostEstimate: options.roksCostEstimate ?? null,
    vsiCostEstimate: options.vsiCostEstimate ?? null,
  };

  // Reset caption counters for fresh document
  resetCaptionCounters();

  // Calculate all data using filtered data (target sections)
  const readiness = calculateVMReadiness(filteredRawData, {
    includeROKS: finalOptions.includeROKS,
    includeVSI: finalOptions.includeVSI,
  });
  const roksSizing = calculateROKSSizing(filteredRawData);
  const vsiMappings = calculateVSIMappings(filteredRawData);

  // Section numbering counter — incremented for each H1 section
  const sec = createSectionCounter();

  // Build document sections (await async functions)
  // §1 Executive Summary (with recommendation banner when platform selection exists)
  const execNum = sec.next();
  const executiveSummary = await buildExecutiveSummary(
    rawData, readiness, aiInsights, execNum,
    finalOptions.platformSelection, finalOptions.workloadClassification,
  );

  // §2 Source Environment (enriched with vCenter, ESXi, overcommit, datastore details)
  const envNum = sec.next();
  const environmentAnalysis = await buildEnvironmentAnalysis(rawData, envNum, finalOptions.sourceEnvironment);

  // Build Table of Contents section
  const tableOfContents: DocumentContent[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: 'Table of Contents',
          bold: true,
          color: STYLES.primaryColor,
          font: FONT_FAMILY,
        }),
      ],
    }),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
      stylesWithLevels: [
        { level: 1, styleName: 'Heading1' },
        { level: 2, styleName: 'Heading2' },
        { level: 3, styleName: 'Heading3' },
      ],
    }),
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: 'Note: When opening this document, click "Yes" to update fields and populate the Table of Contents with correct page numbers.',
          size: 18,
          italics: true,
          color: STYLES.secondaryColor,
          font: FONT_FAMILY,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // Build document sections in recommendation-led order.
  // The counter auto-increments, so optional sections don't break numbering.
  const sections: DocumentContent[] = [
    ...buildCoverPage(finalOptions),
    ...tableOfContents,
    ...executiveSummary,                                                    // §1
    ...buildAssumptionsAndScope(execNum),                                   // §1.1
    ...environmentAnalysis,                                                 // §2 (enriched)
    ...buildMigrationReadiness(readiness, finalOptions.maxIssueVMs, aiInsights, { includeROKS: finalOptions.includeROKS, includeVSI: finalOptions.includeVSI }, sec.next()), // §3
    ...buildComplexityAssessment(filteredRawData, sec.next(), finalOptions.platformSelection?.score?.leaning),               // §4
  ];

  // §5 Workload Classification (NEW — conditional)
  if (finalOptions.workloadClassification) {
    sections.push(...buildWorkloadClassification(finalOptions.workloadClassification, sec.next()));
  }

  sections.push(
    ...buildOSCompatibilitySection(filteredRawData, { includeROKS: finalOptions.includeROKS, includeVSI: finalOptions.includeVSI }, sec.next()), // §6
    ...buildMigrationOptions(sec.next()),                                   // §7 (with PowerVS column)
  );

  // §8 Platform Recommendation (NEW — moved up, before platform deep-dives)
  if (finalOptions.platformSelection || finalOptions.targetAssignments) {
    sections.push(...buildPlatformRecommendation(
      finalOptions.platformSelection,
      finalOptions.targetAssignments,
      sec.next(),
    ));
  }

  // §9/§10 Platform deep-dives — recommended platform first, alternative second
  const leaning = finalOptions.platformSelection?.score?.leaning;
  if (leaning === 'vsi') {
    // VSI recommended — show VSI first
    if (finalOptions.includeVSI) {
      sections.push(...buildVSIOverview(
        vsiMappings, 20, filteredRawData,
        finalOptions.wavePlanningPreference, finalOptions.vpcDesign,
        sec.next(),
      ));
    }
    if (finalOptions.includeROKS) {
      sections.push(...buildROKSOverview(
        roksSizing, filteredRawData,
        finalOptions.wavePlanningPreference, finalOptions.platformSelection,
        sec.next(),
      ));
    }
  } else {
    // Default: ROKS first (recommended or neutral)
    if (finalOptions.includeROKS) {
      sections.push(...buildROKSOverview(
        roksSizing, filteredRawData,
        finalOptions.wavePlanningPreference, finalOptions.platformSelection,
        sec.next(),
      ));
    }
    if (finalOptions.includeVSI) {
      sections.push(...buildVSIOverview(
        vsiMappings, 20, filteredRawData,
        finalOptions.wavePlanningPreference, finalOptions.vpcDesign,
        sec.next(),
      ));
    }
  }

  // §11 Migration Strategy
  sections.push(...buildMigrationStrategy(filteredRawData, aiInsights, finalOptions.wavePlanningPreference, finalOptions.includeROKS, finalOptions.includeVSI, sec.next()));

  // §12 Cost Estimation
  if (finalOptions.includeCosts && (finalOptions.includeROKS || finalOptions.includeVSI)) {
    const roksVariant = finalOptions.platformSelection?.score?.roksVariant;
    sections.push(...buildCostEstimation(roksSizing, vsiMappings, aiInsights, sec.next(), finalOptions.roksCostEstimate, finalOptions.vsiCostEstimate, roksVariant));
  }

  // §13 Migration Timeline
  if (finalOptions.timelinePhases) {
    sections.push(...buildTimelineSection(finalOptions.timelinePhases, finalOptions.timelineStartDate, sec.next()));
  }

  // §14 Risk Assessment
  if (finalOptions.riskAssessment) {
    sections.push(...buildRiskAssessmentSection(finalOptions.riskAssessment, sec.next()));
  }

  // §15 Day 2 Operations
  sections.push(...buildDay2OperationsSection(sec.next()));

  // §16 Next Steps
  sections.push(...buildNextSteps(finalOptions, aiInsights, sec.next()));

  // Appendices
  sections.push(...buildAppendices(readiness, finalOptions.maxIssueVMs, filteredRawData, finalOptions.includeAppendices));

  // Create document with professional header/footer
  const doc = new Document({
    features: {
      updateFields: true,
    },
    creator: finalOptions.companyName,
    title: `VMware Migration Assessment - ${finalOptions.clientName}`,
    description: 'VMware to IBM Cloud Migration Assessment Report',
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.bodySize,
          },
        },
        heading1: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading1Size,
            bold: true,
            color: STYLES.primaryColor,
          },
          paragraph: {
            spacing: { before: 400, after: 200 },
          },
        },
        heading2: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading2Size,
            bold: true,
            color: STYLES.secondaryColor,
          },
          paragraph: {
            spacing: { before: 300, after: 150 },
          },
        },
        heading3: {
          run: {
            font: FONT_FAMILY,
            size: STYLES.heading3Size,
            bold: true,
          },
          paragraph: {
            spacing: { before: 200, after: 100 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'VMware Cloud Migration Assessment',
                    size: 18,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${finalOptions.companyName}`,
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    text: '  |  Page ',
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: STYLES.secondaryColor,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  // Generate blob
  return await Packer.toBlob(doc);
}

/**
 * Generate and download a DOCX migration assessment report
 */
export async function downloadDocx(
  rawData: RVToolsData,
  options: DocxExportOptions = {},
  filename?: string
): Promise<void> {
  const blob = await generateDocxReport(rawData, options);

  // Create download link
  const date = new Date().toISOString().split('T')[0];
  const clientName = options.clientName?.replace(/[^a-zA-Z0-9]/g, '-') || 'client';
  const finalFilename = filename || `migration-assessment_${clientName}_${date}.docx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
