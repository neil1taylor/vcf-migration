// Main DOCX Report Generator
// This orchestrates the modular section builders to generate the full report

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
  buildPlatformSelectionSection,
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

  const finalOptions: Required<DocxExportOptions> = {
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
  };

  // Reset caption counters for fresh document
  resetCaptionCounters();

  // Calculate all data
  const readiness = calculateVMReadiness(rawData);
  const roksSizing = calculateROKSSizing(rawData);
  const vsiMappings = calculateVSIMappings(rawData);

  // Build document sections (await async functions)
  const executiveSummary = await buildExecutiveSummary(rawData, readiness, aiInsights);
  const environmentAnalysis = await buildEnvironmentAnalysis(rawData);

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

  // Build document sections in new order:
  // 1. Cover Page, 2. ToC, 3. Executive Summary, 4. Assumptions, 5. Environment,
  // 6. Readiness, 7. Migration Options, 8. Migration Strategy (generic),
  // 9. ROKS/ROV, 10. VSI (with network design), 11. Comparison (platform selection + costs),
  // 12. Timeline, 13. Risk, 14. Day 2, 15. Next Steps, 16. Appendices
  const sections: DocumentContent[] = [
    ...buildCoverPage(finalOptions),
    ...tableOfContents,
    ...executiveSummary,
    ...buildAssumptionsAndScope(),
    ...environmentAnalysis,
    ...buildMigrationReadiness(readiness, finalOptions.maxIssueVMs, aiInsights, { includeROKS: finalOptions.includeROKS, includeVSI: finalOptions.includeVSI }),
    ...buildMigrationOptions(),
    ...buildMigrationStrategy(rawData, aiInsights, finalOptions.wavePlanningPreference, finalOptions.includeROKS, finalOptions.includeVSI),
  ];

  // ROKS/ROV section (with wave summary and migration considerations)
  if (finalOptions.includeROKS) {
    sections.push(...buildROKSOverview(
      roksSizing,
      rawData,
      finalOptions.wavePlanningPreference,
      finalOptions.platformSelection,
    ));
  }

  // VSI section (with network design, wave summary, and migration considerations)
  if (finalOptions.includeVSI) {
    sections.push(...buildVSIOverview(
      vsiMappings,
      20,
      rawData,
      finalOptions.wavePlanningPreference,
      finalOptions.vpcDesign,
    ));
  }

  // Comparison & Recommendations (platform selection + costs)
  if (finalOptions.platformSelection) {
    sections.push(...buildPlatformSelectionSection(finalOptions.platformSelection));
  }

  if (finalOptions.includeCosts && (finalOptions.includeROKS || finalOptions.includeVSI)) {
    sections.push(...buildCostEstimation(roksSizing, vsiMappings, aiInsights));
  }

  // Timeline and Risk (combined, after comparison)
  if (finalOptions.timelinePhases) {
    sections.push(...buildTimelineSection(finalOptions.timelinePhases, finalOptions.timelineStartDate));
  }

  if (finalOptions.riskAssessment) {
    sections.push(...buildRiskAssessmentSection(finalOptions.riskAssessment));
  }

  sections.push(...buildDay2OperationsSection());
  sections.push(...buildNextSteps(finalOptions, aiInsights));

  // Add appendices if there are more VMs than shown in main body
  sections.push(...buildAppendices(readiness, finalOptions.maxIssueVMs));

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
