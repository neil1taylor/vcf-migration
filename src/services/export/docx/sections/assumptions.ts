// Assumptions and Scope Section

import { Paragraph, HeadingLevel } from 'docx';
import { MIGRATION_THROUGHPUT_GB_PER_DAY, MIN_DAYS_PER_VM, WORKING_DAYS_PER_WEEK } from '@/services/migration/timelineEstimation';
import { type DocumentContent } from '../types';
import { createHeading, createParagraph, createBulletList } from '../utils/helpers';

export function buildAssumptionsAndScope(): DocumentContent[] {
  return [
    createHeading('1.1 Assessment Assumptions & Scope', HeadingLevel.HEADING_2),
    createParagraph(
      'This assessment is based on the following assumptions and scope limitations. These should be considered when reviewing the recommendations and cost estimates.',
      { spacing: { after: 200 } }
    ),

    createParagraph('Data Source', { bold: true }),
    createParagraph(
      'Analysis is based on a point-in-time RVTools export from the VMware vSphere environment. Results reflect the environment state at the time of data collection.'
    ),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Scope Limitations', { bold: true }),
    ...createBulletList([
      'No application dependency mapping - workload dependencies between VMs have not been analyzed',
      'No performance benchmarking - actual CPU, memory, and storage utilization patterns are not assessed',
      'No licensing optimization - existing software licenses and cloud licensing options are not evaluated',
      'No network traffic analysis - bandwidth requirements between workloads are not measured',
      'No security or compliance review - regulatory requirements are not assessed in this report',
    ]),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Cost Estimate Assumptions', { bold: true }),
    ...createBulletList([
      'List pricing without enterprise discounts or committed use agreements',
      'US South region pricing, unless otherwise stated (actual costs may vary by region)',
      'Standard support tier included',
      'Network egress and data transfer costs not included',
      'No operating system licensing is included as the migration assumes you are migrating from a BYOS to a BYOS model. ROKS does include RHEL licensing in its subscription model. It may be possible to move from a BYOS to an IBM Cloud provided OS license for VPC VSI migrations',
    ]),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Migration Timeline Assumptions', { bold: true }),
    ...createBulletList([
      `Migration data throughput: ${MIGRATION_THROUGHPUT_GB_PER_DAY} GB/day per wave (single-stream)`,
      `Minimum VM overhead: ${MIN_DAYS_PER_VM} days per VM for setup, validation, and cutover`,
      `Working days: ${WORKING_DAYS_PER_WEEK} per week (duration estimates exclude weekends)`,
      'Wave durations are the greater of data transfer time or VM overhead time',
    ]),

    new Paragraph({ spacing: { before: 120 } }),
    createParagraph('Recommendations', { bold: true }),
    createParagraph(
      'For a comprehensive migration plan, consider conducting an internal application discovery, dependency mapping, and performance analysis to refine the sizing recommendations and identify optimal migration waves.'
    ),
    createParagraph(
      'This assessment is designed as input, along with your internal application discovery, to the migration partner engagement. All findings, sizing recommendations, and cost estimates will be validated, refined, and enhanced by the migration partner based on detailed discovery, application dependency mapping, and your specific business requirements.'
    ),

    new Paragraph({ spacing: { before: 200 } }),
  ];
}
