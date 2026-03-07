import { useMemo } from 'react';
import {
  Grid, Column, Tabs, TabList, Tab, TabPanels, TabPanel,
  Button, NumberInput, Table, TableHead, TableRow, TableHeader,
  TableBody, TableCell, Tag, UnorderedList, ListItem,
} from '@carbon/react';
import { Reset } from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData, useAllVMs, useVMOverrides, useAutoExclusion, useTargetAssignments, usePlatformSelection } from '@/hooks';
import { useTimelineConfig } from '@/hooks/useTimelineConfig';
import { useRiskAssessment } from '@/hooks/useRiskAssessment';
import { ROUTES } from '@/utils/constants';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { getVMWorkloadCategory } from '@/utils/workloadClassification';
import { getRecommendation } from '@/services/migration/targetClassification';
import { MetricCard } from '@/components/common';
import {
  RecommendationBanner,
  VMAssignmentTable,
  PlatformSelectionPanel,
} from '@/components/comparison';
import { GanttTimeline } from '@/components/charts/GanttTimeline';
import { GoNoGoBanner } from '@/components/risk/GoNoGoBanner';
import { RiskDomainCard } from '@/components/risk/RiskDomainCard';
import { RiskHeatMap } from '@/components/risk/RiskHeatMap';
import { EnvironmentSnapshotTile } from '@/components/risk/EnvironmentSnapshotTile';
import { PHASE_COLORS } from '@/types/timeline';
import type { TimelinePhaseType } from '@/types/timeline';
import type { RiskDomainId } from '@/types/riskAssessment';
import './MigrationPage.scss';

// Estimate wave count from network data or default
function estimateWaveCount(rawData: import('@/types/rvtools').RVToolsData | null): number {
  if (!rawData) return 3;
  const portGroups = new Set(rawData.vNetwork.map(n => n.networkName).filter(Boolean));
  return Math.max(1, Math.min(portGroups.size, 10));
}

const PHASE_TAG_TYPE: Record<TimelinePhaseType, 'blue' | 'purple' | 'teal' | 'magenta' | 'gray'> = {
  preparation: 'blue',
  pilot: 'purple',
  production: 'teal',
  validation: 'magenta',
  buffer: 'gray',
};

const DOMAIN_ORDER: RiskDomainId[] = ['cost', 'readiness', 'security', 'operational', 'compliance', 'timeline'];

export function MigrationComparisonPage() {
  const { rawData, calculatedCosts } = useData();
  const allVmsRaw = useAllVMs();
  const vmOverrides = useVMOverrides();
  const { getAutoExclusionById } = useAutoExclusion();
  const costData = useMemo(() => ({
    roksMonthlyCost: calculatedCosts?.roksMonthlyCost,
    vsiMonthlyCost: calculatedCosts?.vsiMonthlyCost,
  }), [calculatedCosts?.roksMonthlyCost, calculatedCosts?.vsiMonthlyCost]);
  const { answers, setAnswer, resetAll: resetPlatformSelection, score: platformScore } = usePlatformSelection(costData);

  // Filter excluded VMs (same pattern as VSIMigrationPage)
  const vms = useMemo(() => {
    return allVmsRaw.filter(vm => {
      const vmId = getVMIdentifier(vm);
      const autoResult = getAutoExclusionById(vmId);
      return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
    });
  }, [allVmsRaw, vmOverrides, getAutoExclusionById]);

  // Target assignments (use platform leaning as default)
  const {
    assignments, overrideTarget, overrideReason, resetOverride, resetAll,
    roksCount, vsiCount, powervsCount, overrideCount, overriddenVmIds,
  } = useTargetAssignments(platformScore.leaning);

  // Workload types map for VM Assignment table
  const workloadTypes = useMemo(() => {
    const map = new Map<string, string>();
    for (const vm of vms) {
      const vmId = getVMIdentifier(vm);
      const category = getVMWorkloadCategory(vm.vmName, vm.annotation ?? null);
      if (category) map.set(vmId, category);
    }
    return map;
  }, [vms]);

  // Recommendation
  const recommendation = useMemo(() => {
    const roksCost = calculatedCosts?.roksMonthlyCost ?? 0;
    const vsiCost = calculatedCosts?.vsiMonthlyCost ?? 0;
    const totalVMs = assignments.length;
    const splitCost = totalVMs > 0
      ? (roksCost * roksCount / totalVMs) + (vsiCost * vsiCount / totalVMs)
      : 0;
    return getRecommendation(assignments, roksCost, vsiCost, splitCost);
  }, [assignments, calculatedCosts, roksCount, vsiCount]);

  // Timeline hooks
  const waveCount = useMemo(() => estimateWaveCount(rawData), [rawData]);
  const { phases, totals, startDate, updatePhaseDuration, resetToDefaults } = useTimelineConfig(waveCount);

  // Risk assessment hooks
  const { assessment, setDomainOverride, setDomainNotes, currentMonthlyCost, setCurrentMonthlyCost, clearAll } = useRiskAssessment(calculatedCosts);

  const keyBlockers = useMemo(() => {
    return Object.values(assessment.domains)
      .flatMap(d => d.evidence.filter(e => e.severity === 'critical' || e.severity === 'high'))
      .slice(0, 10);
  }, [assessment]);

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const endDateStr = totals.estimatedEndDate
    ? totals.estimatedEndDate.toLocaleDateString()
    : startDate
      ? new Date(startDate.getTime() + totals.totalWeeks * 7 * 86400000).toLocaleDateString()
      : `${totals.totalWeeks} weeks from start`;

  return (
    <div className="migration-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h2>Migration Review</h2>
          <p style={{ marginBottom: '1rem', color: '#525252' }}>
            Compare ROKS (OpenShift Virtualization), VSI (Virtual Server), and PowerVS (Power Virtual Server) migration targets.
            Assign VMs to targets and evaluate costs, readiness, and migration effort.
          </p>
        </Column>

        <Column lg={16} md={8} sm={4} style={{ marginBottom: '1rem' }}>
          <RecommendationBanner recommendation={recommendation} platformScore={platformScore} />
        </Column>

        {/* Summary tiles */}
        <Column lg={3} md={2} sm={2} style={{ marginBottom: '1rem' }}>
          <MetricCard label="ROKS VMs" value={roksCount} variant="teal" tooltip="VMs assigned to ROKS target" />
        </Column>
        <Column lg={3} md={2} sm={2} style={{ marginBottom: '1rem' }}>
          <MetricCard label="VSI VMs" value={vsiCount} variant="primary" tooltip="VMs assigned to VSI target" />
        </Column>
        <Column lg={3} md={2} sm={2} style={{ marginBottom: '1rem' }}>
          <MetricCard label="PowerVS VMs" value={powervsCount} variant="purple" tooltip="VMs assigned to PowerVS target" />
        </Column>
        <Column lg={3} md={2} sm={2} style={{ marginBottom: '1rem' }}>
          <MetricCard label="Overrides" value={overrideCount} variant={overrideCount > 0 ? 'info' : 'default'} tooltip="User-overridden VM assignments" />
        </Column>
        <Column lg={4} md={2} sm={2} style={{ marginBottom: '1rem' }}>
          <MetricCard label="Total VMs" value={vms.length} variant="default" tooltip="Total included VMs" />
        </Column>

        {/* Tabs */}
        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Migration Review tabs">
              <Tab>Platform Selection</Tab>
              <Tab>VM Assignments</Tab>
              <Tab>Migration Timeline</Tab>
              <Tab>Risk Assessment</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <PlatformSelectionPanel
                  answers={answers}
                  onAnswer={setAnswer}
                  onReset={resetPlatformSelection}
                  score={platformScore}
                  roksMonthlyCost={calculatedCosts?.roksMonthlyCost}
                  vsiMonthlyCost={calculatedCosts?.vsiMonthlyCost}
                  totalVMCount={vms.length}
                />
              </TabPanel>
              <TabPanel>
                <VMAssignmentTable
                  assignments={assignments}
                  workloadTypes={workloadTypes}
                  overriddenVmIds={overriddenVmIds}
                  onOverride={overrideTarget}
                  onOverrideReason={overrideReason}
                  onReset={resetOverride}
                  onResetAll={resetAll}
                  overrideCount={overrideCount}
                />
              </TabPanel>
              <TabPanel>
                <Grid condensed>
                  <Column sm={4} md={8} lg={16}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3>Migration Timeline</h3>
                      <Button kind="ghost" size="sm" renderIcon={Reset} onClick={() => resetToDefaults(waveCount)}>
                        Reset to Defaults
                      </Button>
                    </div>
                  </Column>

                  <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
                    <MetricCard label="Total Duration" value={`${totals.totalWeeks} weeks`} variant="primary" />
                  </Column>
                  <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
                    <MetricCard label="Migration Waves" value={totals.waveCount} variant="teal" />
                  </Column>
                  <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
                    <MetricCard label="Total Phases" value={totals.phaseCount} variant="info" />
                  </Column>
                  <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
                    <MetricCard label="Est. End Date" value={endDateStr} variant="purple" />
                  </Column>

                  <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
                    <GanttTimeline
                      phases={phases}
                      subtitle={`${totals.totalWeeks} weeks total across ${totals.phaseCount} phases`}
                      height={120}
                    />
                  </Column>

                  <Column sm={4} md={8} lg={16}>
                    <h3 style={{ marginBottom: '0.5rem' }}>Phase Configuration</h3>
                    <Table size="md">
                      <TableHead>
                        <TableRow>
                          <TableHeader>Phase</TableHeader>
                          <TableHeader>Type</TableHeader>
                          <TableHeader>Duration (weeks)</TableHeader>
                          <TableHeader>Start Week</TableHeader>
                          <TableHeader>End Week</TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {phases.map(phase => (
                          <TableRow key={phase.id}>
                            <TableCell>
                              <span
                                style={{
                                  borderLeft: `4px solid ${phase.color || PHASE_COLORS[phase.type]}`,
                                  paddingLeft: '0.5rem',
                                }}
                              >
                                {phase.name}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Tag type={PHASE_TAG_TYPE[phase.type]} size="sm">
                                {phase.type}
                              </Tag>
                            </TableCell>
                            <TableCell>
                              <NumberInput
                                id={`duration-${phase.id}`}
                                label=""
                                hideLabel
                                min={1}
                                max={52}
                                value={phase.durationWeeks}
                                onChange={(_e: unknown, { value }: { value: string | number }) => {
                                  const v = typeof value === 'string' ? parseInt(value, 10) : value;
                                  if (!isNaN(v)) updatePhaseDuration(phase.id, v);
                                }}
                                size="sm"
                                style={{ maxWidth: '100px' }}
                              />
                            </TableCell>
                            <TableCell>{phase.startWeek}</TableCell>
                            <TableCell>{phase.endWeek}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Column>
                </Grid>
              </TabPanel>
              <TabPanel>
                <Grid condensed>
                  <Column sm={4} md={8} lg={16}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3>Risk Assessment</h3>
                      <Button kind="ghost" size="sm" renderIcon={Reset} onClick={clearAll}>
                        Reset Overrides
                      </Button>
                    </div>
                  </Column>

                  <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
                    <GoNoGoBanner decision={assessment.goNoGo} overallSeverity={assessment.overallSeverity} />
                  </Column>

                  <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
                    <EnvironmentSnapshotTile rawData={rawData} />
                  </Column>

                  <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
                    <h3 style={{ marginBottom: '0.5rem' }}>Risk Heat Map</h3>
                    <RiskHeatMap assessment={assessment} />
                  </Column>

                  <Column sm={4} md={8} lg={16}>
                    <Grid condensed>
                      {DOMAIN_ORDER.map(domainId => (
                        <Column key={domainId} sm={4} md={4} lg={8} style={{ marginBottom: '1rem' }}>
                          <RiskDomainCard
                            domain={assessment.domains[domainId]}
                            onOverrideSeverity={setDomainOverride}
                            onNotesChange={setDomainNotes}
                            currentMonthlyCost={domainId === 'cost' ? currentMonthlyCost : undefined}
                            onCurrentMonthlyCostChange={domainId === 'cost' ? setCurrentMonthlyCost : undefined}
                          />
                        </Column>
                      ))}
                    </Grid>
                  </Column>

                  {keyBlockers.length > 0 && (
                    <Column sm={4} md={8} lg={16} style={{ marginTop: '1rem' }}>
                      <h3 style={{ marginBottom: '0.5rem' }}>Key Blockers</h3>
                      <UnorderedList>
                        {keyBlockers.map((b, i) => (
                          <ListItem key={i}>
                            <strong>{b.label}:</strong> {b.detail}
                          </ListItem>
                        ))}
                      </UnorderedList>
                    </Column>
                  )}
                </Grid>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
