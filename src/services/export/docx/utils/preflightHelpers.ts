// Helpers for extracting human-readable issue labels from VMCheckResults

import { CHECK_DEFINITIONS, type VMCheckResults } from '@/services/preflightChecks';

/**
 * Extract human-readable issue labels from a VM's check results.
 * Returns short names for all failed/warned checks.
 */
export function getIssueLabels(result: VMCheckResults): string[] {
  return Object.entries(result.checks)
    .filter(([, cr]) => cr.status === 'fail' || cr.status === 'warn')
    .map(([checkId]) => {
      const def = CHECK_DEFINITIONS.find(d => d.id === checkId);
      return def?.shortName || def?.name || checkId;
    });
}

/**
 * Extract issue labels for blocker-severity checks only.
 */
export function getBlockerLabels(result: VMCheckResults): string[] {
  return Object.entries(result.checks)
    .filter(([checkId, cr]) => {
      if (cr.status !== 'fail') return false;
      const def = CHECK_DEFINITIONS.find(d => d.id === checkId);
      return def?.severity === 'blocker';
    })
    .map(([checkId]) => {
      const def = CHECK_DEFINITIONS.find(d => d.id === checkId);
      return def?.shortName || def?.name || checkId;
    });
}

/**
 * Extract issue labels for warning-severity checks only.
 */
export function getWarningLabels(result: VMCheckResults): string[] {
  return Object.entries(result.checks)
    .filter(([checkId, cr]) => {
      if (cr.status !== 'fail' && cr.status !== 'warn') return false;
      const def = CHECK_DEFINITIONS.find(d => d.id === checkId);
      return def?.severity === 'warning';
    })
    .map(([checkId]) => {
      const def = CHECK_DEFINITIONS.find(d => d.id === checkId);
      return def?.shortName || def?.name || checkId;
    });
}
