// Horizontal workflow progress indicator for guided migration flow
import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressIndicator, ProgressStep } from '@carbon/react';
import { useWorkflowProgress } from '@/hooks/useWorkflowProgress';
import { ROUTES } from '@/utils/constants';
import './WorkflowStepper.scss';

const STEPS = [
  { label: 'Upload', route: ROUTES.home, description: 'Upload an RVTools Excel export' },
  { label: 'Review', route: ROUTES.dashboard, description: 'Review your environment summary on the Dashboard' },
  { label: 'Prepare', route: ROUTES.discovery, description: 'Classify workloads, exclude VMs, and map networks' },
  { label: 'Migrate', route: ROUTES.roksMigration, description: 'Run ROKS and VSI migration assessments' },
  { label: 'Export', route: ROUTES.export, description: 'Generate PDF, Excel, and DOCX reports' },
] as const;

export function WorkflowStepper() {
  const navigate = useNavigate();
  const { progress, currentStep, hasData } = useWorkflowProgress();
  const stepperRef = useRef<HTMLDivElement>(null);

  // Set data-tooltip attributes on rendered <li> elements post-render
  // so CSS ::after can display tooltips without wrapper elements
  useEffect(() => {
    if (!stepperRef.current) return;
    const steps = stepperRef.current.querySelectorAll('.cds--progress-step');
    steps.forEach((el, i) => {
      if (STEPS[i]) {
        (el as HTMLElement).dataset.tooltip = STEPS[i].description;
      }
    });
  });

  if (!hasData) return null;

  const progressKeys: (keyof typeof progress)[] = ['upload', 'review', 'prepare', 'migrate', 'export'];

  return (
    <div className="workflow-stepper" ref={stepperRef}>
      <ProgressIndicator
        currentIndex={currentStep >= 0 ? currentStep : undefined}
        spaceEqually
        className="workflow-stepper__indicator"
      >
        {STEPS.map((step, i) => {
          const isComplete = progress[progressKeys[i]];
          const isCurrent = currentStep === i;
          return (
            <ProgressStep
              key={step.label}
              label={step.label}
              description={step.description}
              complete={isComplete && !isCurrent}
              current={isCurrent}
              onClick={() => navigate(step.route)}
              className="workflow-stepper__step"
            />
          );
        })}
      </ProgressIndicator>
    </div>
  );
}
