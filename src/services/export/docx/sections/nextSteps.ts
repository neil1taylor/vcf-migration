// Next Steps Section

import { Paragraph, HeadingLevel } from 'docx';
import type { MigrationInsights } from '@/services/ai/types';
import reportTemplates from '@/data/reportTemplates.json';
import { type DocumentContent, type DocxExportOptions } from '../types';
import { createHeading, createParagraph, createBulletList, createAISection, createDocLink } from '../utils/helpers';
import { DOC_LINKS } from '../utils/docLinks';

// Map phase names to relevant doc links
const PHASE_LINKS: Record<string, Array<{ description: string; linkText: string; url: string }>> = {
  'Phase 1: Detailed Planning': [
    { description: 'For VMware requirements for MTV, see', linkText: 'VMware Requirements', url: DOC_LINKS.vmwareRequirements },
    { description: 'For pre-migration planning guidance, see', linkText: 'Pre-Migration Planning', url: DOC_LINKS.vsiPreMigration },
  ],
  'Phase 2: Environment Preparation': [
    { description: 'For the OpenShift Virtualization reference architecture, see', linkText: 'ROKS Reference Architecture', url: DOC_LINKS.roksArchitecture },
    { description: 'For the VPC VSI reference architecture, see', linkText: 'VPC VSI Reference Architecture', url: DOC_LINKS.vsiArchitecture },
  ],
  'Phase 3: Pilot Migration': [
    { description: 'For the MTV migration tutorial, see', linkText: 'MTV Migration Tutorial', url: DOC_LINKS.mtvTutorial },
    { description: 'For the VPC migration tutorial, see', linkText: 'VPC Migration Tutorial', url: DOC_LINKS.vsiMigrationTutorial },
  ],
  'Phase 4: Production Migration': [
    { description: 'For wave planning guidance, see', linkText: 'Wave Planning', url: DOC_LINKS.vsiWavePlanning },
    { description: 'For post-migration guidance, see', linkText: 'Post-Migration Steps', url: DOC_LINKS.vsiPostMigration },
  ],
};

export function buildNextSteps(options: Required<DocxExportOptions>, aiInsights?: MigrationInsights | null): DocumentContent[] {
  const templates = reportTemplates.nextSteps;
  const placeholders = reportTemplates.placeholders;

  const sections: DocumentContent[] = [
    createHeading('10. ' + templates.title, HeadingLevel.HEADING_1),
    createParagraph(templates.introduction),
  ];

  templates.steps.forEach((phase, index) => {
    sections.push(
      createHeading(`10.${index + 1} ${phase.phase}`, HeadingLevel.HEADING_2),
      ...createBulletList(phase.items)
    );

    const links = PHASE_LINKS[phase.phase];
    if (links) {
      sections.push(...links.map(link => createDocLink(link.description, link.linkText, link.url)));
    }
  });

  // Add AI recommendations if available
  if (aiInsights?.recommendations && aiInsights.recommendations.length > 0) {
    sections.push(
      ...createAISection(
        '10.5 AI Recommendations',
        aiInsights.recommendations,
        HeadingLevel.HEADING_2
      )
    );
  }

  sections.push(
    new Paragraph({ spacing: { before: 480 } }),
    createHeading('10.6 ' + templates.contact.title, HeadingLevel.HEADING_2),
    createParagraph(templates.contact.content),
    createParagraph(options.companyName || placeholders.companyName, { bold: true }),
    createParagraph(options.preparedBy || placeholders.preparedBy),
    createParagraph(placeholders.contactEmail),
    createParagraph(placeholders.contactPhone)
  );

  return sections;
}
