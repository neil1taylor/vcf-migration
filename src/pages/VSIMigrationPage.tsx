// VSI (IBM Cloud VPC Virtual Server) Migration page - Refactored with shared hooks and components

import { useState, useMemo, lazy, Suspense } from 'react';
import { Grid, Column, Tile, Tabs, TabList, Tab, TabPanels, TabPanel, Loading, Tooltip } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { Information, Report } from '@carbon/icons-react';
import { useData, useAllVMs, useCustomProfiles, usePreflightChecks, useMigrationAssessment, useWavePlanning, useVMOverrides, useAIRightsizing, useAutoExclusion, useVSIPageData } from '@/hooks';
import { ROUTES, SNAPSHOT_WARNING_AGE_DAYS, SNAPSHOT_BLOCKER_AGE_DAYS } from '@/utils/constants';
import { formatNumber } from '@/utils/formatters';
import { getVMIdentifier, getEnvironmentFingerprint } from '@/utils/vmIdentifier';
import { MetricCard, NextStepBanner, SectionErrorBoundary } from '@/components/common';
import { CostEstimation } from '@/components/cost';
import { ComplexityAssessmentPanel, WavePlanningPanel, OSCompatibilityPanel, VSIPreFlightPanel, VSISizingPanel } from '@/components/migration';
import { AIInsightsPanel } from '@/components/ai/AIInsightsPanel';
import { AIWaveAnalysisPanel } from '@/components/ai/AIWaveAnalysisPanel';
import { AICostAnalysisPanel } from '@/components/ai/AICostAnalysisPanel';
import { getVSIProfiles } from '@/services/migration';

// Lazy load CustomProfileEditor - only loaded when user opens the modal
const CustomProfileEditor = lazy(() =>
  import('@/components/sizing/CustomProfileEditor').then(m => ({ default: m.CustomProfileEditor }))
);
import './MigrationPage.scss';

export function VSIMigrationPage() {
  const { rawData } = useData();
  const allVmsRaw = useAllVMs();
  const [showCustomProfileEditor, setShowCustomProfileEditor] = useState(false);

  // VM overrides for exclusions
  const vmOverrides = useVMOverrides();
  const { getAutoExclusionById } = useAutoExclusion();

  // Custom profiles state
  const {
    setProfileOverride,
    removeProfileOverride,
    clearAllOverrides,
    getEffectiveProfile,
    hasOverride,
    customProfiles,
    addCustomProfile,
    updateCustomProfile,
    removeCustomProfile,
  } = useCustomProfiles();

  // Filter out excluded VMs using unified three-tier exclusion
  const vms = useMemo(() => {
    return allVmsRaw.filter(vm => {
      const vmId = getVMIdentifier(vm);
      const autoResult = getAutoExclusionById(vmId);
      return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
    });
  }, [allVmsRaw, vmOverrides, getAutoExclusionById]);

  // AI rightsizing - environment fingerprint for cache scoping
  const envFingerprint = useMemo(() => {
    return rawData ? getEnvironmentFingerprint(rawData) : '';
  }, [rawData]);

  // Derive data from rawData - these are used by hooks below
  const snapshots = useMemo(() => rawData?.vSnapshot ?? [], [rawData?.vSnapshot]);
  const tools = useMemo(() => rawData?.vTools ?? [], [rawData?.vTools]);
  const disks = useMemo(() => rawData?.vDisk ?? [], [rawData?.vDisk]);
  const networks = useMemo(() => rawData?.vNetwork ?? [], [rawData?.vNetwork]);
  const poweredOnVMs = useMemo(() => vms.filter(vm => vm.powerState === 'poweredOn'), [vms]);

  // AI rightsizing inputs
  const aiRightsizingInputs = useMemo(() => {
    return poweredOnVMs.map(vm => ({
      vmName: vm.vmName,
      vCPUs: vm.cpus,
      memoryMB: vm.memory,
      storageMB: 0,
      guestOS: vm.guestOS || undefined,
      powerState: vm.powerState,
    }));
  }, [poweredOnVMs]);

  const aiProfileSummaries = useMemo(() => {
    const profiles = getVSIProfiles();
    const all = [...profiles.balanced, ...profiles.compute, ...profiles.memory];
    return all.map(p => ({
      name: p.name,
      vcpus: p.vcpus,
      memoryGiB: p.memoryGiB,
      family: p.name.split('-')[0] || 'balanced',
    }));
  }, []);

  const { recommendations: aiRecommendations } = useAIRightsizing(
    aiRightsizingInputs,
    aiProfileSummaries,
    envFingerprint
  );

  // ===== PRE-FLIGHT CHECKS (using hook) =====
  const {
    counts: preflightCounts,
    remediationItems,
    blockerCount,
    warningCount,
    hwVersionCounts,
  } = usePreflightChecks({
    mode: 'vsi',
    vms: poweredOnVMs,
    allVms: vms,
    disks: disks,
    snapshots: snapshots,
    tools: tools,
    networks: networks,
    includeAllChecks: true, // Show all VPC checks as dropdowns
  });

  // ===== MIGRATION ASSESSMENT (using hook) =====
  const {
    complexityScores,
    readinessScore,
    chartData: complexityChartData,
    topComplexVMs,
    osStatusCounts,
  } = useMigrationAssessment({
    mode: 'vsi',
    vms: poweredOnVMs,
    disks: disks,
    networks: networks,
    blockerCount,
    warningCount,
  });

  // ===== WAVE PLANNING (using hook) =====
  const wavePlanning = useWavePlanning({
    mode: 'vsi',
    vms: poweredOnVMs,
    complexityScores,
    disks: disks,
    snapshots: snapshots,
    tools: tools,
    networks: networks,
  });

  // Additional display-only counts
  const vmsWithSnapshots = new Set(snapshots.map(s => s.vmName)).size;
  const vmsWithWarningSnapshots = new Set(
    snapshots.filter(s => s.ageInDays > SNAPSHOT_WARNING_AGE_DAYS && s.ageInDays <= SNAPSHOT_BLOCKER_AGE_DAYS).map(s => s.vmName)
  ).size;
  const vmsWithToolsNotRunning = poweredOnVMs.filter(vm => {
    const tool = tools.find(t => t.vmName === vm.vmName);
    return tool && (tool.toolsStatus === 'toolsNotRunning' || tool.toolsStatus === 'guestToolsNotRunning');
  }).length;

  // ===== VPC VSI PAGE DATA (profile mapping, sizing, AI data builders) =====
  const {
    vmProfileMappings,
    topProfiles,
    familyChartData,
    totalVSIs,
    uniqueProfiles,
    vsiTotalVCPUs,
    vsiTotalMemory,
    overriddenVMCount,
    vsiSizing,
    insightsData,
    waveSuggestionData,
    costOptimizationData,
    remediationAIData,
    vmDetails,
  } = useVSIPageData({
    poweredOnVMs,
    allVmsRawLength: allVmsRaw.length,
    vmsLength: vms.length,
    disks,
    networks,
    rawData,
    customProfiles,
    getEffectiveProfile,
    hasOverride,
    complexityScores,
    blockerCount,
    warningCount,
    wavePlanning,
    remediationItems,
  });

  // Early return if no data - placed after all hooks
  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <div className="migration-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="migration-page__title">VSI Migration</h1>
          <p className="migration-page__subtitle">IBM Cloud VPC Virtual Server Instance migration assessment and sizing</p>
        </Column>

        {/* Readiness Score */}
        <Column lg={4} md={4} sm={4}>
          <Tile className="migration-page__score-tile">
            <div className="migration-page__score-header">
              <span className="migration-page__score-label">Readiness Score</span>
              <Tooltip
                label={
                  <span>
                    Measures migration readiness based on pre-flight check results.
                    <br /><br />
                    <strong>Scoring:</strong>
                    <br />• Blockers: -50 points per affected VM
                    <br />• Warnings: -30 points per affected VM
                    <br />• Unsupported OS: -20 points per VM
                    <br /><br />
                    <strong>Thresholds:</strong>
                    <br />• Green (≥80%): Ready for migration
                    <br />• Orange (60-79%): Preparation needed
                    <br />• Red (&lt;60%): Blockers must be resolved
                  </span>
                }
                align="bottom"
              >
                <button type="button" className="migration-page__score-info-button" aria-label="More information about Readiness Score">
                  <Information size={16} aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
            <span className={`migration-page__score-value migration-page__score-value--${readinessScore >= 80 ? 'good' : readinessScore >= 60 ? 'warning' : 'critical'}`}>
              {readinessScore}%
            </span>
            <span className="migration-page__score-detail">
              {blockerCount > 0 ? `${blockerCount} blocker${blockerCount !== 1 ? 's' : ''} found` : readinessScore >= 80 ? 'Ready for migration' : 'Preparation needed'}
            </span>
          </Tile>
        </Column>

        {/* Quick Stats */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard label="VMs to Migrate" value={formatNumber(poweredOnVMs.length)} variant="primary" tooltip="Total powered-on VMs eligible for migration." />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard label="Blockers" value={formatNumber(blockerCount)} variant={blockerCount > 0 ? 'error' : 'success'} tooltip="Critical issues that prevent migration." />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard label="Warnings" value={formatNumber(warningCount)} variant={warningCount > 0 ? 'warning' : 'success'} tooltip="Non-blocking issues to review." />
        </Column>

        {/* Tabs */}
        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="VSI migration tabs">
              <Tab>Pre-Flight Checks</Tab>
              <Tab>Sizing</Tab>
              <Tab>Cost Estimation</Tab>
              <Tab>Wave Planning</Tab>
              <Tab>OS Compatibility</Tab>
              <Tab>Complexity</Tab>
              <Tab>AI Insights</Tab>
            </TabList>
            <TabPanels>
              {/* Pre-Flight Checks Panel */}
              <TabPanel>
                <VSIPreFlightPanel
                  preflightCounts={preflightCounts}
                  vmsWithSnapshots={vmsWithSnapshots}
                  vmsWithWarningSnapshots={vmsWithWarningSnapshots}
                  vmsWithToolsNotRunning={vmsWithToolsNotRunning}
                  hwVersionCounts={hwVersionCounts}
                  remediationItems={remediationItems}
                  remediationAIData={remediationAIData}
                />
              </TabPanel>

              {/* Sizing Panel */}
              <TabPanel>
                <VSISizingPanel
                  totalVSIs={totalVSIs}
                  uniqueProfiles={uniqueProfiles}
                  vsiTotalVCPUs={vsiTotalVCPUs}
                  vsiTotalMemory={vsiTotalMemory}
                  overriddenVMCount={overriddenVMCount}
                  familyChartData={familyChartData}
                  topProfiles={topProfiles}
                  vmProfileMappings={vmProfileMappings}
                  customProfiles={customProfiles}
                  showCustomProfileEditor={showCustomProfileEditor}
                  setShowCustomProfileEditor={setShowCustomProfileEditor}
                  clearAllOverrides={clearAllOverrides}
                  setProfileOverride={setProfileOverride}
                  removeProfileOverride={removeProfileOverride}
                  aiRecommendations={aiRecommendations}
                />
              </TabPanel>

              {/* Cost Estimation Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <CostEstimation type="vsi" vsiSizing={vsiSizing} vmDetails={vmDetails} title="VPC VSI Cost Estimation" />
                  </Column>
                  <Column lg={16} md={8} sm={4}>
                    <SectionErrorBoundary sectionName="AI Cost Optimization">
                      <AICostAnalysisPanel data={costOptimizationData} title="AI Cost Optimization (VSI)" />
                    </SectionErrorBoundary>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Wave Planning Panel - Using shared component */}
              <TabPanel>
                <WavePlanningPanel
                  mode="vsi"
                  wavePlanningMode={wavePlanning.wavePlanningMode}
                  networkGroupBy={wavePlanning.networkGroupBy}
                  onWavePlanningModeChange={wavePlanning.setWavePlanningMode}
                  onNetworkGroupByChange={wavePlanning.setNetworkGroupBy}
                  networkWaves={wavePlanning.networkWaves}
                  complexityWaves={wavePlanning.complexityWaves}
                  waveChartData={wavePlanning.waveChartData}
                  waveResources={wavePlanning.waveResources}
                  vmDetails={vmDetails}
                />
                <div style={{ marginTop: '1rem' }}>
                  <SectionErrorBoundary sectionName="AI Wave Analysis">
                    <AIWaveAnalysisPanel data={waveSuggestionData} title="AI Wave Analysis (VSI)" />
                  </SectionErrorBoundary>
                </div>
              </TabPanel>

              {/* OS Compatibility Panel - Using shared component */}
              <TabPanel>
                <OSCompatibilityPanel mode="vsi" osStatusCounts={osStatusCounts} vms={poweredOnVMs} />
              </TabPanel>

              {/* Complexity Panel - Using shared component */}
              <TabPanel>
                <ComplexityAssessmentPanel
                  mode="vsi"
                  complexityScores={complexityScores}
                  chartData={complexityChartData}
                  topComplexVMs={topComplexVMs}
                />
              </TabPanel>

              {/* AI Insights Panel */}
              <TabPanel>
                <Grid className="migration-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <SectionErrorBoundary sectionName="AI Migration Insights">
                      <AIInsightsPanel data={insightsData} title="AI Migration Insights (VSI)" />
                    </SectionErrorBoundary>
                  </Column>
                </Grid>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>

        {/* Next Step Banner */}
        <Column lg={16} md={8} sm={4}>
          <NextStepBanner
            title="Next: Export reports and deliverables"
            description="Generate PDF, Excel, DOCX, and BOM reports for stakeholder review and migration planning."
            route={ROUTES.export}
            icon={Report}
          />
        </Column>
      </Grid>

      {/* Custom Profile Editor Modal - Lazy loaded */}
      {showCustomProfileEditor && (
        <Suspense fallback={<Loading description="Loading profile editor..." withOverlay />}>
          <CustomProfileEditor
            isOpen={showCustomProfileEditor}
            onClose={() => setShowCustomProfileEditor(false)}
            customProfiles={customProfiles}
            onAddProfile={addCustomProfile}
            onUpdateProfile={updateCustomProfile}
            onRemoveProfile={removeCustomProfile}
          />
        </Suspense>
      )}
    </div>
  );
}
