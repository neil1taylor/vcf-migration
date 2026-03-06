// Day 2 Operations Considerations Section

import { HeadingLevel } from 'docx';
import reportTemplates from '@/data/reportTemplates.json';
import { type DocumentContent } from '../types';
import { createHeading, createParagraph, createBulletList, createDocLink } from '../utils/helpers';
import { DOC_LINKS } from '../utils/docLinks';

// Map domain titles to relevant IBM Cloud doc links
const DOMAIN_LINKS: Record<string, Array<{ description: string; linkText: string; url: string }>> = {
  'Backup & Disaster Recovery': [
    { description: 'For OpenShift resiliency design guidance, see', linkText: 'OpenShift Resiliency Design', url: DOC_LINKS.roksResiliency },
    { description: 'For the Veeam Kasten backup tutorial, see', linkText: 'Backup with Veeam Kasten', url: DOC_LINKS.backupTutorial },
    { description: 'For VPC resiliency design guidance, see', linkText: 'VPC Resiliency Design', url: DOC_LINKS.vsiResiliency },
  ],
  'Monitoring & Observability': [
    { description: 'For OpenShift observability design guidance, see', linkText: 'OpenShift Observability Design', url: DOC_LINKS.roksObservability },
    { description: 'For VPC observability design guidance, see', linkText: 'VPC Observability Design', url: DOC_LINKS.vsiObservability },
  ],
  'Security & Compliance': [
    { description: 'For OpenShift security design guidance, see', linkText: 'OpenShift Security Design', url: DOC_LINKS.roksSecurity },
    { description: 'For VPC security design guidance, see', linkText: 'VPC Security Design', url: DOC_LINKS.vsiSecurity },
  ],
  'High Availability & Clustering': [
    { description: 'For OpenShift resiliency design guidance, see', linkText: 'OpenShift Resiliency Design', url: DOC_LINKS.roksResiliency },
    { description: 'For VPC resiliency design guidance, see', linkText: 'VPC Resiliency Design', url: DOC_LINKS.vsiResiliency },
  ],
};

// Type assertion for the day2Operations template
const templates = reportTemplates as typeof reportTemplates & {
  day2Operations: {
    title: string;
    introduction: string;
    domains: Array<{
      title: string;
      description: string;
      impact: string;
      ibmCloudAlternatives: string[];
      recommendations: string[];
    }>;
  };
};

export function buildDay2OperationsSection(): DocumentContent[] {
  const day2 = templates.day2Operations;

  const sections: DocumentContent[] = [
    createHeading('9. ' + day2.title, HeadingLevel.HEADING_1),
    createParagraph(day2.introduction),
  ];

  day2.domains.forEach((domain, index) => {
    sections.push(
      createHeading(`9.${index + 1} ${domain.title}`, HeadingLevel.HEADING_2),
      createParagraph(domain.description),
      createParagraph(domain.impact),
      createHeading('IBM Cloud Alternatives', HeadingLevel.HEADING_3),
      ...createBulletList(domain.ibmCloudAlternatives),
      createHeading('Recommendations', HeadingLevel.HEADING_3),
      ...createBulletList(domain.recommendations),
    );

    const links = DOMAIN_LINKS[domain.title];
    if (links) {
      sections.push(...links.map(link => createDocLink(link.description, link.linkText, link.url)));
    }
  });

  return sections;
}
