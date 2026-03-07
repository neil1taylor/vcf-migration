import { useMemo } from 'react';
import { Grid, Column, Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData, useAllVMs, useVMOverrides, useAutoExclusion, useTargetAssignments, useComparisonData, usePlatformSelection } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { getVMIdentifier } from '@/utils/vmIdentifier';
import { getVMWorkloadCategory } from '@/utils/workloadClassification';
import { getRecommendation } from '@/services/migration/targetClassification';
import { MetricCard } from '@/components/common';
import {
  RecommendationBanner,
  VMAssignmentTable,
  CostComparisonPanel,
  ReadinessComparisonPanel,
  ArchitectureFitPanel,
  MigrationEffortPanel,
  PlatformSelectionPanel,
} from '@/components/comparison';
import './MigrationPage.scss';

export function MigrationComparisonPage() {
  const { rawData, calculatedCosts } = useData();
  const allVmsRaw = useAllVMs();
  const vmOverrides = useVMOverrides();
  const { getAutoExclusionById } = useAutoExclusion();
  const { answers, setAnswer, resetAll: resetPlatformSelection, score: platformScore } = usePlatformSelection();

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

  // Derive data
  const disks = useMemo(() => rawData?.vDisk ?? [], [rawData?.vDisk]);
  const networks = useMemo(() => rawData?.vNetwork ?? [], [rawData?.vNetwork]);
  const snapshots = useMemo(() => rawData?.vSnapshot ?? [], [rawData?.vSnapshot]);
  const tools = useMemo(() => rawData?.vTools ?? [], [rawData?.vTools]);

  // Comparison metrics
  const comparison = useComparisonData(assignments, vms, disks, networks, snapshots, tools);

  // Workload types map for Architecture Fit tab
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

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <div className="migration-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h2>Migration Comparison</h2>
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
            <TabList aria-label="Migration comparison tabs">
              <Tab>Platform Selection</Tab>
              <Tab>VM Assignments</Tab>
              <Tab>Cost Comparison</Tab>
              <Tab>Readiness</Tab>
              <Tab>Architecture Fit</Tab>
              <Tab>Migration Effort</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <PlatformSelectionPanel
                  answers={answers}
                  onAnswer={setAnswer}
                  onReset={resetPlatformSelection}
                  score={platformScore}
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
                <CostComparisonPanel
                  roksVMCount={roksCount}
                  vsiVMCount={vsiCount}
                  totalVMCount={vms.length}
                />
              </TabPanel>
              <TabPanel>
                <ReadinessComparisonPanel comparison={comparison} />
              </TabPanel>
              <TabPanel>
                <ArchitectureFitPanel
                  assignments={assignments}
                  workloadTypes={workloadTypes}
                />
              </TabPanel>
              <TabPanel>
                <MigrationEffortPanel comparison={comparison} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
