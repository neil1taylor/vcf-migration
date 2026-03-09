// Tutorial page - Step-by-step walkthrough of the complete tool flow
import { useState } from 'react';
import { Grid, Column, Tile, Button, ProgressIndicator, ProgressStep, Tag, UnorderedList, ListItem } from '@carbon/react';
import { ArrowRight, ArrowLeft, Launch } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/utils/constants';
import { TutorialStepIllustration } from '@/components/tutorial/TutorialStepIllustration';
import './TutorialPage.scss';

interface TutorialStep {
  title: string;
  route: string;
  routeLabel: string;
  description: string;
  details: string[];
  tips: string[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Upload Your Data',
    route: ROUTES.home,
    routeLabel: 'Upload page',
    description: 'Start by uploading an RVTools Excel export from your VMware environment. Drag and drop or browse to select a .xlsx file.',
    details: [
      'Supports standard RVTools exports (.xlsx format)',
      'Only the vInfo sheet is required — all other sheets are optional but recommended for full analysis',
      'Your data stays private — all processing happens in your browser, nothing is sent to a server',
      'Files up to 50 MB are supported',
    ],
    tips: [
      'Ask your VMware admin for a fresh RVTools export for the most accurate analysis',
      'Include all sheets when exporting for the richest analysis experience',
    ],
  },
  {
    title: 'Review Your Environment',
    route: ROUTES.dashboard,
    routeLabel: 'Dashboard',
    description: 'Get an instant overview of your VMware environment with summary metrics, charts, and health indicators.',
    details: [
      'Summary tiles show total VMs, vCPUs, memory, and storage at a glance',
      'Charts visualize OS distribution, power states, and resource allocation',
      'Filter by power state to focus on running VMs',
      'Toggle AI insights for intelligent analysis of your environment (requires AI to be enabled in Settings)',
    ],
    tips: [
      'Click on dashboard tiles to navigate to detailed analysis pages',
      'Powered-off VMs are shown but can be excluded later in the Discovery step',
    ],
  },
  {
    title: 'Explore Infrastructure',
    route: ROUTES.compute,
    routeLabel: 'Compute page',
    description: 'Dive deeper into your infrastructure details across compute, storage, network, clusters, and hosts.',
    details: [
      'Compute page shows CPU and memory utilization across VMs',
      'Storage page shows datastore capacity and usage (requires vDatastore or vDisk sheet)',
      'Network page maps port groups and NICs (requires vNetwork sheet)',
      'Clusters and Hosts pages show physical infrastructure details',
      'Pages are enabled/disabled based on which RVTools sheets are available',
    ],
    tips: [
      'These pages are optional — you can skip straight to Discovery if you prefer',
      'Greyed-out navigation items indicate missing RVTools sheets for that page',
    ],
  },
  {
    title: 'Prepare for Migration',
    route: ROUTES.discovery,
    routeLabel: 'Discovery page',
    description: 'Classify your workloads, set up your target environment, and configure migration exclusions across three tabs.',
    details: [
      'Infrastructure tab: Select your source datacenter and target IBM Cloud region (MZR)',
      'Workload tab: Review automatic workload classification, override categories, exclude VMs from migration',
      'Networks tab: Map VMware port groups to IBM Cloud VPC subnets with auto-guessed CIDRs',
      'Auto-exclusion rules filter out templates, powered-off VMs, and infrastructure VMs by default',
    ],
    tips: [
      'The nearest IBM Cloud MZR is auto-suggested based on your datacenter location',
      'Force-include VMs that were auto-excluded if they should be migrated',
      'Use AI classification for more accurate workload categorization',
    ],
  },
  {
    title: 'Run Pre-Flight Checks',
    route: ROUTES.preflightReport,
    routeLabel: 'Pre-Flight Report',
    description: 'Validate your environment\'s readiness for migration with automated compatibility checks.',
    details: [
      'MTV readiness checks hardware versions, VMware Tools, and snapshot status',
      'OS compatibility validates guest OS against IBM Cloud supported versions',
      'Complexity scoring rates each VM as simple, moderate, complex, or blocker',
      'Results highlight blockers that must be resolved before migration',
    ],
    tips: [
      'Address blockers (red items) before proceeding to sizing',
      'Warning items are advisory — they won\'t prevent migration but may need attention',
    ],
  },
  {
    title: 'Size Your Migration',
    route: ROUTES.roksMigration,
    routeLabel: 'ROKS Migration page',
    description: 'Calculate the right IBM Cloud infrastructure sizing and estimated costs for your workloads.',
    details: [
      'ROKS Migration: Size OpenShift worker nodes for containerized workloads',
      'VSI Migration: Match VMs to VPC Virtual Server Instance profiles',
      'Cost estimation shows monthly costs with hourly, monthly, and reserved pricing',
      'Network Design (VSI tab) maps port groups to VPC subnets across 3 availability zones',
    ],
    tips: [
      'Compare ROKS and VSI options to find the best fit for each workload type',
      'Adjust virtualization overhead percentages in the sizing calculator for more accurate estimates',
    ],
  },
  {
    title: 'Review & Plan',
    route: ROUTES.migrationComparison,
    routeLabel: 'Migration Review',
    description: 'Finalize your migration plan with platform selection, VM assignments, timeline, and risk assessment.',
    details: [
      'Platform Selection: Answer a questionnaire to get a recommended target platform (ROKS, VSI, or split)',
      'VM Assignments: Review and override per-VM target platform assignments',
      'Migration Timeline: Visualize migration phases with a Gantt chart, configure wave counts',
      'Risk Assessment: Review curated migration risks with RAG status and mitigation plans',
    ],
    tips: [
      'The platform recommendation considers your questionnaire answers and cost data',
      'SAP and Oracle VMs are automatically assigned to PowerVS when detected',
      'Add custom risks for environment-specific concerns',
    ],
  },
  {
    title: 'Export Reports',
    route: ROUTES.export,
    routeLabel: 'Export page',
    description: 'Download comprehensive reports in multiple formats to share with your team and stakeholders.',
    details: [
      'PDF: Executive summary with charts and key metrics',
      'Excel: Detailed data export with all analysis results in worksheets',
      'DOCX: Full migration report with sizing, timeline, risks, and recommendations',
      'PPTX: Presentation-ready slides for stakeholder briefings',
      'YAML: Machine-readable export for automation pipelines',
      'Handover file: Bundles your RVTools file with all settings for a colleague to continue',
    ],
    tips: [
      'Enable AI in Settings to include AI-generated narrative sections in reports',
      'The Handover file lets a colleague import your exact configuration and continue the analysis',
    ],
  },
];

export function TutorialPage() {
  const [activeStep, setActiveStep] = useState(0);
  const navigate = useNavigate();

  const currentStep = TUTORIAL_STEPS[activeStep];

  return (
    <div className="tutorial-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="tutorial-page__title">Getting Started Tutorial</h1>
          <p className="tutorial-page__subtitle">
            Follow these 8 steps to go from RVTools upload to migration-ready reports
          </p>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="tutorial-page__stepper">
            <ProgressIndicator
              currentIndex={activeStep}
              spaceEqually
              onChange={(index: number) => setActiveStep(index)}
            >
              {TUTORIAL_STEPS.map((step, i) => (
                <ProgressStep
                  key={i}
                  label={step.title}
                  secondaryLabel={`Step ${i + 1}`}
                  complete={i < activeStep}
                  current={i === activeStep}
                />
              ))}
            </ProgressIndicator>
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="tutorial-page__content">
            <Grid>
              <Column lg={7} md={4} sm={4}>
                <Tile className="tutorial-page__illustration">
                  <TutorialStepIllustration step={activeStep + 1} />
                </Tile>
              </Column>

              <Column lg={9} md={4} sm={4}>
                <div className="tutorial-page__details">
                  <div className="tutorial-page__step-header">
                    <Tag type="blue" size="sm">Step {activeStep + 1} of {TUTORIAL_STEPS.length}</Tag>
                    <h2>{currentStep.title}</h2>
                  </div>

                  <p className="tutorial-page__description">{currentStep.description}</p>

                  <UnorderedList>
                    {currentStep.details.map((detail, i) => (
                      <ListItem key={i}>{detail}</ListItem>
                    ))}
                  </UnorderedList>

                  <Tile className="tutorial-page__tips">
                    <h4>Tips</h4>
                    <UnorderedList>
                      {currentStep.tips.map((tip, i) => (
                        <ListItem key={i}>{tip}</ListItem>
                      ))}
                    </UnorderedList>
                  </Tile>

                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Launch}
                    onClick={() => navigate(currentStep.route)}
                    className="tutorial-page__try-it"
                  >
                    Go to {currentStep.routeLabel}
                  </Button>
                </div>
              </Column>
            </Grid>
          </div>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <div className="tutorial-page__navigation">
            <Button
              kind="secondary"
              renderIcon={ArrowLeft}
              disabled={activeStep === 0}
              onClick={() => setActiveStep(prev => prev - 1)}
            >
              Previous
            </Button>
            <Button
              kind="primary"
              renderIcon={ArrowRight}
              disabled={activeStep === TUTORIAL_STEPS.length - 1}
              onClick={() => setActiveStep(prev => prev + 1)}
            >
              Next
            </Button>
          </div>
        </Column>
      </Grid>
    </div>
  );
}
