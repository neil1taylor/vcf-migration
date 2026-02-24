// Reusable "Next Step" call-to-action banner for workflow pages
import { useNavigate } from 'react-router-dom';
import { ClickableTile } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import type { CarbonIconType } from '@carbon/icons-react';
import './NextStepBanner.scss';

interface NextStepBannerProps {
  title: string;
  description: string;
  route: string;
  icon: CarbonIconType;
}

export function NextStepBanner({ title, description, route, icon: Icon }: NextStepBannerProps) {
  const navigate = useNavigate();

  return (
    <ClickableTile
      className="next-step-banner"
      onClick={() => navigate(route)}
    >
      <div className="next-step-banner__icon">
        <Icon size={24} />
      </div>
      <div className="next-step-banner__content">
        <span className="next-step-banner__title">{title}</span>
        <span className="next-step-banner__description">{description}</span>
      </div>
      <ArrowRight size={20} className="next-step-banner__arrow" />
    </ClickableTile>
  );
}
