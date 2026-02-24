// Guided tour modal slideshow for first-time user onboarding
import { Modal, Link } from '@carbon/react';
import {
  Upload,
  Dashboard,
  Search,
  LogoKubernetes,
  Report,
} from '@carbon/icons-react';
import type { UseTourReturn } from '@/hooks/useTour';
import './GuidedTour.scss';

interface TourStepContent {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  brief: string;
  detailed: string;
}

const TOUR_STEPS: TourStepContent[] = [
  {
    icon: Upload,
    label: 'Upload',
    brief: 'Upload your RVTools Excel export to begin analyzing your VMware environment.',
    detailed: 'Supports standard RVTools exports (.xlsx). The parser extracts VM, host, cluster, datastore, and partition data.',
  },
  {
    icon: Dashboard,
    label: 'Review',
    brief: 'The Dashboard gives you an executive summary: VMs, storage, clusters, and configuration insights.',
    detailed: 'Includes charts for resource utilization, storage breakdown, cluster overview, and optional AI-powered insights.',
  },
  {
    icon: Search,
    label: 'Prepare',
    brief: 'Classify workloads, exclude VMs that won\'t migrate, and map your network subnets.',
    detailed: 'VMs are auto-classified by workload type. You can override classifications, force-include/exclude VMs, and edit subnet mappings.',
  },
  {
    icon: LogoKubernetes,
    label: 'Migrate',
    brief: 'Run migration assessments for IBM Cloud ROKS and VPC Virtual Servers with cost estimates and wave planning.',
    detailed: 'Includes pre-flight checks, sizing calculator, cost estimation, OS compatibility, wave planning, and MTV workflow.',
  },
  {
    icon: Report,
    label: 'Export',
    brief: 'Generate comprehensive PDF, Excel, and Word reports for stakeholder review.',
    detailed: 'PDF includes visual charts, Excel has full data sheets, Word is editable. All reports optionally include AI insights.',
  },
];

interface GuidedTourProps {
  tour: UseTourReturn;
}

export function GuidedTour({ tour }: GuidedTourProps) {
  const { state, closeTour, nextStep, prevStep, goToStep, toggleMode, isFirstStep, isLastStep, totalSteps } = tour;
  const step = TOUR_STEPS[state.currentStep];

  if (!step) return null;

  const Icon = step.icon;

  return (
    <Modal
      open={state.isOpen}
      onRequestClose={closeTour}
      modalHeading="Getting Started"
      modalLabel={`Step ${state.currentStep + 1} of ${totalSteps}`}
      primaryButtonText={isLastStep ? 'Get Started' : 'Next'}
      secondaryButtonText={isFirstStep ? 'Skip' : 'Back'}
      onRequestSubmit={nextStep}
      onSecondarySubmit={isFirstStep ? closeTour : prevStep}
      size="sm"
      className="guided-tour"
    >
      <div className="guided-tour__body">
        <div className="guided-tour__icon-circle">
          <Icon size={32} />
        </div>
        <h3 className="guided-tour__step-label">{step.label}</h3>
        <p className="guided-tour__description">{step.brief}</p>

        {state.isDetailed && (
          <p className="guided-tour__detail">{step.detailed}</p>
        )}

        <Link
          className="guided-tour__toggle"
          onClick={toggleMode}
          role="button"
        >
          {state.isDetailed ? 'Show less' : 'Learn more'}
        </Link>

        <div className="guided-tour__dots">
          {Array.from({ length: totalSteps }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`guided-tour__dot ${i === state.currentStep ? 'guided-tour__dot--active' : ''}`}
              onClick={() => goToStep(i)}
              aria-label={`Go to step ${i + 1}: ${TOUR_STEPS[i].label}`}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
