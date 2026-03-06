// Check result cell component for pre-flight report table
import { Toggletip, ToggletipButton, ToggletipContent } from '@carbon/react';
import { Checkmark, Close, WarningAlt, Subtract } from '@carbon/icons-react';
import type { CheckResult, CheckDefinition } from '@/services/preflightChecks';
import './CheckResultCell.scss';

interface CheckResultCellProps {
  result: CheckResult;
  checkDef: CheckDefinition;
  showLabel?: boolean;
}

export function CheckResultCell({ result, checkDef, showLabel }: CheckResultCellProps) {
  const getIcon = () => {
    switch (result.status) {
      case 'pass':
        return <Checkmark size={16} />;
      case 'fail':
        return <Close size={16} />;
      case 'warn':
        return <WarningAlt size={16} />;
      case 'na':
        return <Subtract size={16} />;
    }
  };

  const getSeverityLabel = () => {
    if (result.status === 'warn') return 'Warning';
    switch (checkDef.severity) {
      case 'blocker':
        return 'Blocker';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Info';
    }
  };

  if (showLabel) {
    const showMessage = result.message && (result.status === 'fail' || result.status === 'warn');
    return (
      <div className={`check-result-cell check-result-cell--with-label check-result-cell--${result.status}`}>
        <div className="check-result-cell__row">
          {getIcon()}
          <span className="check-result-cell__label">{checkDef.name}</span>
        </div>
        {showMessage && (
          <span className="check-result-cell__message">{result.message}</span>
        )}
      </div>
    );
  }

  const tooltipContent = (
    <div className="check-result-tooltip">
      <strong>{checkDef.name}</strong>
      <p className="check-result-tooltip__description">{checkDef.description}</p>
      <div className="check-result-tooltip__details">
        <span className="check-result-tooltip__severity">
          Severity: {getSeverityLabel()}
        </span>
        {result.value !== undefined && (
          <span className="check-result-tooltip__value">
            Value: {result.value}
          </span>
        )}
        {result.threshold !== undefined && (
          <span className="check-result-tooltip__threshold">
            Limit: {result.threshold}
          </span>
        )}
      </div>
      {result.message && (
        <p className="check-result-tooltip__message">{result.message}</p>
      )}
    </div>
  );

  return (
    <Toggletip align="bottom" autoAlign>
      <ToggletipButton label={checkDef.name}>
        <span className={`check-result-cell check-result-cell--${result.status}`}>
          {getIcon()}
        </span>
      </ToggletipButton>
      <ToggletipContent>
        {tooltipContent}
      </ToggletipContent>
    </Toggletip>
  );
}
