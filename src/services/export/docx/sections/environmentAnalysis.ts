// Environment Analysis Section

import { Paragraph, PageBreak, HeadingLevel, AlignmentType } from 'docx';
import type { RVToolsData, VirtualMachine, VNetworkInfo } from '@/types/rvtools';
import { mibToGiB, mibToTiB } from '@/utils/formatters';
import reportTemplates from '@/data/reportTemplates.json';
import { CHART_COLORS, type DocumentContent, type ChartData } from '../types';
import { createHeading, createParagraph, createStyledTable, createTableDescription, createTableLabel, createFigureDescription, createFigureLabel } from '../utils/helpers';
import { generatePieChart, createChartParagraph } from '../utils/charts';

// Type assertion for templates with table/figure descriptions
const templates = reportTemplates as typeof reportTemplates & {
  tableDescriptions: Record<string, { title: string; description: string }>;
  figureDescriptions: Record<string, { title: string; description: string }>;
};

export async function buildEnvironmentAnalysis(rawData: RVToolsData): Promise<DocumentContent[]> {
  const envTemplates = reportTemplates.environmentAnalysis;
  const vms = rawData.vInfo.filter((vm) => !vm.template);
  const poweredOnVMs = vms.filter((vm) => vm.powerState === 'poweredOn');

  const totalVCPUs = poweredOnVMs.reduce((sum, vm) => sum + vm.cpus, 0);
  const totalMemoryGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.memory), 0);
  const totalVMStorageGiB = poweredOnVMs.reduce((sum, vm) => sum + mibToGiB(vm.provisionedMiB), 0);
  const avgStoragePerVM = poweredOnVMs.length > 0 ? totalVMStorageGiB / poweredOnVMs.length : 0;

  const totalDatastoreCapacity = rawData.vDatastore.reduce((sum, ds) => sum + ds.capacityMiB, 0);
  const totalDatastoreUsed = rawData.vDatastore.reduce((sum, ds) => sum + ds.inUseMiB, 0);

  const totalNICs = rawData.vNetwork.length;
  const uniquePortGroups = new Set(rawData.vNetwork.map((n: VNetworkInfo) => n.networkName)).size;
  const uniqueSwitches = new Set(rawData.vNetwork.map((n: VNetworkInfo) => n.switchName)).size;

  // Generate vCPU distribution chart
  const vcpuBuckets = [
    { label: '1-2 vCPUs', min: 1, max: 2 },
    { label: '3-4 vCPUs', min: 3, max: 4 },
    { label: '5-8 vCPUs', min: 5, max: 8 },
    { label: '9-16 vCPUs', min: 9, max: 16 },
    { label: '17+ vCPUs', min: 17, max: Infinity },
  ];
  const vcpuData: ChartData[] = vcpuBuckets.map((bucket, index) => ({
    label: bucket.label,
    value: poweredOnVMs.filter(vm => vm.cpus >= bucket.min && vm.cpus <= bucket.max).length,
    color: CHART_COLORS[index % CHART_COLORS.length],
  })).filter(d => d.value > 0);

  const vcpuChart = await generatePieChart(vcpuData, 'vCPU Distribution');

  // Generate memory distribution chart
  const memBuckets = [
    { label: '0-4 GiB', min: 0, max: 4 },
    { label: '5-8 GiB', min: 5, max: 8 },
    { label: '9-16 GiB', min: 9, max: 16 },
    { label: '17-32 GiB', min: 17, max: 32 },
    { label: '33-64 GiB', min: 33, max: 64 },
    { label: '65+ GiB', min: 65, max: Infinity },
  ];
  const memData: ChartData[] = memBuckets.map((bucket, index) => {
    const memGiB = (vm: VirtualMachine) => mibToGiB(vm.memory);
    return {
      label: bucket.label,
      value: poweredOnVMs.filter(vm => memGiB(vm) >= bucket.min && memGiB(vm) <= bucket.max).length,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
  }).filter(d => d.value > 0);

  const memChart = await generatePieChart(memData, 'Memory Distribution');

  // Generate datastore type distribution chart
  const datastoreTypes = rawData.vDatastore.reduce((acc, ds) => {
    const type = ds.type || 'Other';
    acc[type] = (acc[type] || 0) + mibToGiB(ds.capacityMiB);
    return acc;
  }, {} as Record<string, number>);

  const dsTypeData: ChartData[] = Object.entries(datastoreTypes).map(([type, capacity], index) => ({
    label: type,
    value: Math.round(capacity),
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const dsTypeChart = await generatePieChart(dsTypeData, 'Storage by Type (GiB)');

  return [
    createHeading('2. ' + envTemplates.title, HeadingLevel.HEADING_1),
    createParagraph(envTemplates.introduction),

    createHeading('2.1 ' + envTemplates.sections.infrastructure.title, HeadingLevel.HEADING_2),
    createParagraph(envTemplates.sections.infrastructure.description),

    // Infrastructure table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.infrastructureOverview.title,
      templates.tableDescriptions.infrastructureOverview.description
    ),
    createStyledTable(
      ['Component', 'Count'],
      [
        ['vCenter Servers', `${rawData.vSource.length}`],
        ['Clusters', `${rawData.vCluster.length}`],
        ['ESXi Hosts', `${rawData.vHost.length}`],
        ['Virtual Machines', `${vms.length}`],
        ['Datastores', `${rawData.vDatastore.length}`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),
    createTableLabel(templates.tableDescriptions.infrastructureOverview.title),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.2 ' + envTemplates.sections.compute.title, HeadingLevel.HEADING_2),
    createParagraph(envTemplates.sections.compute.description),

    // Compute resources table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.computeResources.title,
      templates.tableDescriptions.computeResources.description
    ),
    createStyledTable(
      ['Resource', 'Value'],
      [
        ['Total vCPUs Allocated', `${totalVCPUs.toLocaleString()}`],
        ['Total Memory Allocated', `${(totalMemoryGiB / 1024).toFixed(1)} TiB`],
        ['Average vCPUs per VM', `${poweredOnVMs.length > 0 ? (totalVCPUs / poweredOnVMs.length).toFixed(1) : 0}`],
        ['Average Memory per VM', `${poweredOnVMs.length > 0 ? (totalMemoryGiB / poweredOnVMs.length).toFixed(0) : 0} GiB`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),
    createTableLabel(templates.tableDescriptions.computeResources.title),

    // vCPU distribution chart - description above, label below
    ...createFigureDescription(
      templates.figureDescriptions.vcpuDistribution.title,
      templates.figureDescriptions.vcpuDistribution.description
    ),
    createChartParagraph(vcpuChart, 480, 260),
    createFigureLabel(templates.figureDescriptions.vcpuDistribution.title),

    // Memory distribution chart - description above, label below
    ...createFigureDescription(
      templates.figureDescriptions.memoryDistribution.title,
      templates.figureDescriptions.memoryDistribution.description
    ),
    createChartParagraph(memChart, 480, 260),
    createFigureLabel(templates.figureDescriptions.memoryDistribution.title),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.3 ' + envTemplates.sections.storage.title, HeadingLevel.HEADING_2),
    createParagraph(envTemplates.sections.storage.description),

    // Storage metrics table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.storageMetrics.title,
      templates.tableDescriptions.storageMetrics.description
    ),
    createStyledTable(
      ['Metric', 'Value'],
      [
        ['Total Datastore Capacity', `${mibToTiB(totalDatastoreCapacity).toFixed(1)} TiB`],
        ['Total Datastore Used', `${mibToTiB(totalDatastoreUsed).toFixed(1)} TiB`],
        ['Datastore Utilization', `${totalDatastoreCapacity > 0 ? ((totalDatastoreUsed / totalDatastoreCapacity) * 100).toFixed(0) : 0}%`],
        ['Total VM Storage Provisioned', `${(totalVMStorageGiB / 1024).toFixed(1)} TiB`],
        ['Average Storage per VM', `${avgStoragePerVM.toFixed(0)} GiB`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),
    createTableLabel(templates.tableDescriptions.storageMetrics.title),

    // Storage by type chart - description above, label below
    ...createFigureDescription(
      templates.figureDescriptions.storageByType.title,
      templates.figureDescriptions.storageByType.description
    ),
    createChartParagraph(dsTypeChart, 480, 260),
    createFigureLabel(templates.figureDescriptions.storageByType.title),

    new Paragraph({ spacing: { before: 240 } }),
    createHeading('2.4 ' + envTemplates.sections.network.title, HeadingLevel.HEADING_2),
    createParagraph(envTemplates.sections.network.description),

    // Network components table - description above, label below
    ...createTableDescription(
      templates.tableDescriptions.networkComponents.title,
      templates.tableDescriptions.networkComponents.description
    ),
    createStyledTable(
      ['Component', 'Count'],
      [
        ['Total NICs', `${totalNICs}`],
        ['Port Groups', `${uniquePortGroups}`],
        ['Virtual Switches', `${uniqueSwitches}`],
      ],
      { columnAligns: [AlignmentType.LEFT, AlignmentType.RIGHT] }
    ),
    createTableLabel(templates.tableDescriptions.networkComponents.title),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}
