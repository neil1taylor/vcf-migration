import { useMemo } from 'react';
import {
  Grid, Column, Tabs, TabList, Tab, TabPanels, TabPanel,
  Button, NumberInput, Table, TableHead, TableRow, TableHeader,
  TableBody, TableCell,
} from '@carbon/react';
import { Reset } from '@carbon/icons-react';
import { Navigate } from 'react-router-dom';
import { useData, useAllVMs, useVMOverrides, useAutoExclusion, useTargetAssignments, usePlatformSelection, useMigrationAssessment, useWavePlanning } from '@/hooks';
import { useTimelineConfig } from '@/hooks/useTimelineConfig';
import { useRiskAssessment } from '@/hooks/useRiskAssessment';
import { ROUTES } from '@/utils/constants';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { getVMWorkloadCategory } from '@/utils/workloadClassification';
import { getRecommendation } from '@/services/migration/targetClassification';
import { MetricCard, SectionErrorBoundary } from '@/components/common';
import {
  RecommendationBanner,
  VMAssignmentTable,
  PlatformSelectionPanel,
} from '@/components/comparison';
import { WavePlanningPanel } from '@/components/migration';
import { GanttTimeline } from '@/components/charts/GanttTimeline';
import { AIWaveAnalysisPanel } from '@/components/ai/AIWaveAnalysisPanel';
import { isAIProxyConfigured } from '@/services/ai/aiProxyClient';
import type { WaveSuggestionInput } from '@/services/ai/types';
import { RiskTable } from '@/components/risk/RiskTable';
import { PHASE_COLORS } from '@/types/timeline';
import { formatNumber } from '@/utils/formatters';
import './MigrationPage.scss';

function formatStorageGiB(gib: number): string {
  if (gib >= 1024) {
    return `${formatNumber(Math.round(gib / 1024))} TiB`;
  }
  return `${formatNumber(Math.round(gib))} GiB`;
}


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

  // Derive data from rawData for wave planning
  const snapshots = useMemo(() => rawData?.vSnapshot ?? [], [rawData?.vSnapshot]);
  const tools = useMemo(() => rawData?.vTools ?? [], [rawData?.vTools]);
  const disks = useMemo(() => rawData?.vDisk ?? [], [rawData?.vDisk]);
  const networks = useMemo(() => rawData?.vNetwork ?? [], [rawData?.vNetwork]);
  const poweredOnVMs = useMemo(() => vms.filter(vm => vm.powerState === 'poweredOn'), [vms]);

  // Migration assessment (needed for complexity scores)
  const { complexityScores } = useMigrationAssessment({
    mode: platformScore.leaning === 'vsi' ? 'vsi' : 'roks',
    vms: poweredOnVMs,
    disks,
    networks,
    blockerCount: 0,
    warningCount: 0,
  });

  // Wave planning
  const wavePlanning = useWavePlanning({
    mode: platformScore.leaning === 'vsi' ? 'vsi' : 'roks',
    vms: poweredOnVMs,
    complexityScores,
    disks,
    snapshots,
    tools,
    networks,
  });

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

  // Wave count derived from active waves; VM counts per wave for scaled timeline durations
  const waveCount = Math.max(0, wavePlanning.activeWaves.length - 1);
  const waveVmCounts = useMemo(() => wavePlanning.waveResources.map(w => w.vmCount), [wavePlanning.waveResources]);
  const waveNames = useMemo(() => wavePlanning.waveResources.map(w => w.name), [wavePlanning.waveResources]);
  const waveStorageGiB = useMemo(() => wavePlanning.waveResources.map(w => w.storageGiB), [wavePlanning.waveResources]);
  const { phases, totals, startDate, updatePhaseDuration, resetToDefaults } = useTimelineConfig(waveCount, waveVmCounts, waveNames, waveStorageGiB);

  // AI wave suggestion data
  const waveSuggestionData = useMemo<WaveSuggestionInput | null>(() => {
    if (!isAIProxyConfigured()) return null;
    const activeWaves = wavePlanning.wavePlanningMode === 'network'
      ? wavePlanning.networkWaves : wavePlanning.complexityWaves;
    if (!activeWaves || activeWaves.length === 0) return null;
    return {
      waves: wavePlanning.waveResources.map(w => ({
        name: w.name,
        vmCount: w.vmCount,
        totalVCPUs: w.vcpus,
        totalMemoryGiB: w.memoryGiB,
        totalStorageGiB: w.storageGiB,
        avgComplexity: 0,
        hasBlockers: w.hasBlockers,
        workloadTypes: [],
      })),
      totalVMs: poweredOnVMs.length,
      migrationTarget: platformScore.leaning === 'vsi' ? 'vsi' : 'roks',
    };
  }, [wavePlanning, poweredOnVMs.length, platformScore.leaning]);

  // Risk assessment hooks
  const { riskTable, updateRowStatus, updateRowMitigation, updateRowField, addUserRow, removeRow, clearAll } = useRiskAssessment(calculatedCosts);

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
          <RecommendationBanner recommendation={recommendation} platformScore={platformScore} roksVariant={platformScore.roksVariant} />
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
              <Tab>Migration Planning</Tab>
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
                  rovMonthlyCost={calculatedCosts?.rovMonthlyCost}
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
                {/* Section 1: Wave Planning */}
                <WavePlanningPanel
                  mode={platformScore.leaning === 'vsi' ? 'vsi' : 'roks'}
                  wavePlanningMode={wavePlanning.wavePlanningMode}
                  networkGroupBy={wavePlanning.networkGroupBy}
                  onWavePlanningModeChange={wavePlanning.setWavePlanningMode}
                  onNetworkGroupByChange={wavePlanning.setNetworkGroupBy}
                  networkWaves={wavePlanning.networkWaves}
                  complexityWaves={wavePlanning.complexityWaves}
                  waveChartData={wavePlanning.waveChartData}
                  waveResources={wavePlanning.waveResources}
                  platformLeaning={platformScore.leaning}
                />

                {/* Section 2: AI Wave Analysis */}
                <div style={{ marginTop: '1rem' }}>
                  <SectionErrorBoundary sectionName="AI Wave Analysis">
                    <AIWaveAnalysisPanel data={waveSuggestionData} title="AI Wave Analysis" />
                  </SectionErrorBoundary>
                </div>

                {/* Section 3: Migration Timeline */}
                <Grid condensed style={{ marginTop: '1.5rem' }}>
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
                    <h3 style={{ marginBottom: '0.25rem' }}>Phase Configuration</h3>
                    <p className="cds--label" style={{ marginBottom: '0.75rem' }}>
                      The pilot wave migrates a small set of test VMs to prove the migration process before production waves begin.
                      For this initial timeline, wave durations are auto-populated at 0.5 day per VM (rounded up to the nearest week) and can be adjusted.
                      The migration partner will revise and enhance the timeline after discovery and further planning.
                    </p>
                    <Table size="md">
                      <TableHead>
                        <TableRow>
                          <TableHeader>Phase</TableHeader>
                          <TableHeader>Source</TableHeader>
                          <TableHeader>VMs</TableHeader>
                          <TableHeader>Data</TableHeader>
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
                              {phase.waveSourceName || phase.type}
                            </TableCell>
                            <TableCell>
                              {phase.waveVmCount ?? '—'}
                            </TableCell>
                            <TableCell>
                              {phase.waveStorageGiB != null ? formatStorageGiB(phase.waveStorageGiB) : '—'}
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
                    <h3 style={{ marginBottom: '1rem' }}>Risk Assessment</h3>
                    <RiskTable
                      riskTable={riskTable}
                      onUpdateStatus={updateRowStatus}
                      onUpdateMitigation={updateRowMitigation}
                      onUpdateField={updateRowField}
                      onAddRow={addUserRow}
                      onRemoveRow={removeRow}
                      onClearAll={clearAll}
                    />
                  </Column>
                </Grid>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
