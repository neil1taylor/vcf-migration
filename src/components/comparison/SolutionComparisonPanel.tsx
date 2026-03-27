// Side-by-side comparison of all ROKS solution architectures
import { useMemo } from 'react';
import { Tile, Tag } from '@carbon/react';
import { calculateROKSCost } from '@/services/costEstimation';
import type { ROKSSizingInput, RoksSolutionType, CostEstimate } from '@/services/costEstimation';
import { useCostSettings } from '@/hooks';
import { useDynamicPricing } from '@/hooks';
import { getBareMetalProfiles } from '@/services/costEstimation';
import { calculateNodesForProfile, calculateStorageNodesForProfile } from '@/utils/nodeCalculation';
import { formatNumber } from '@/utils/formatters';

interface SolutionComparisonPanelProps {
  roksSizing: ROKSSizingInput;
  roksVariant?: 'full' | 'rov';
}

interface SolutionSummary {
  solutionType: RoksSolutionType;
  label: string;
  description: string;
  profileName: string;
  nodeCount: number;
  storageApproach: string;
  hasOdf: boolean;
  roksEstimate: CostEstimate;
  rovEstimate: CostEstimate;
}

const SOLUTION_META: Record<RoksSolutionType, { label: string; description: string; storageApproach: string; hasOdf: boolean }> = {
  'nvme-converged': {
    label: 'NVMe Converged',
    description: 'Bare metal with local NVMe, ODF on same nodes',
    storageApproach: 'Local NVMe + ODF',
    hasOdf: true,
  },
  'hybrid-vsi-odf': {
    label: 'Hybrid (BM+VSI)',
    description: 'BM compute + VSI storage nodes + block storage + ODF',
    storageApproach: 'VSI + Block Storage + ODF',
    hasOdf: true,
  },
  'bm-block-csi': {
    label: 'BM + Block Storage',
    description: 'Bare metal (no NVMe) + VPC Block Storage via CSI driver',
    storageApproach: 'VPC Block Storage (CSI)',
    hasOdf: false,
  },
  'bm-block-odf': {
    label: 'BM + Block + ODF',
    description: 'Bare metal (no NVMe) + VPC Block Storage backing ODF',
    storageApproach: 'VPC Block Storage + ODF',
    hasOdf: true,
  },
  'bm-disaggregated': {
    label: 'BM Disaggregated',
    description: 'Diskless BM compute + dedicated NVMe BM for ODF storage',
    storageApproach: 'Dedicated NVMe BM + ODF',
    hasOdf: true,
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function SolutionComparisonPanel({ roksSizing }: SolutionComparisonPanelProps) {
  const { region, discountType } = useCostSettings();
  const { pricing } = useDynamicPricing();

  const solutions = useMemo<SolutionSummary[]>(() => {
    const solutionTypes: RoksSolutionType[] = ['nvme-converged', 'hybrid-vsi-odf', 'bm-block-csi', 'bm-block-odf', 'bm-disaggregated'];
    const pricedProfiles = getBareMetalProfiles(pricing).data;

    return solutionTypes.map((st) => {
      const meta = SOLUTION_META[st];
      // bm-disaggregated compute uses diskless profiles
      const computeNeedsNvme = st === 'nvme-converged' || st === 'hybrid-vsi-odf';

      // Find best-value compute profile for this solution type
      const candidates = pricedProfiles.filter(p =>
        (computeNeedsNvme ? p.hasNvme : !p.hasNvme) && p.roksSupported && p.monthlyRate > 0
      );

      let bestProfile = candidates[0];
      let bestNodeCount = roksSizing.computeNodes;

      if (candidates.length > 0 && roksSizing.nodeCalcParams) {
        let bestCost = Infinity;
        for (const p of candidates) {
          const nodes = calculateNodesForProfile(
            { physicalCores: p.physicalCores, memoryGiB: p.memoryGiB, hasNvme: p.hasNvme, nvmeDisks: p.nvmeDisks, totalNvmeGB: p.totalNvmeGB },
            { ...roksSizing.nodeCalcParams, solutionType: st },
          );
          const totalCost = nodes * p.monthlyRate;
          if (totalCost < bestCost) {
            bestCost = totalCost;
            bestProfile = p;
            bestNodeCount = nodes;
          }
        }
      }

      const profileName = bestProfile?.id || roksSizing.computeProfile;

      // For bm-disaggregated: find best-value NVMe storage profile
      let storageNodes: number | undefined;
      let storageProfileName: string | undefined;
      if (st === 'bm-disaggregated' && roksSizing.nodeCalcParams) {
        const nvmeCandidates = pricedProfiles.filter(p => p.hasNvme && p.roksSupported && p.monthlyRate > 0);
        let bestStorageCost = Infinity;
        for (const p of nvmeCandidates) {
          const sNodes = calculateStorageNodesForProfile(
            { physicalCores: p.physicalCores, memoryGiB: p.memoryGiB, hasNvme: p.hasNvme, nvmeDisks: p.nvmeDisks, totalNvmeGB: p.totalNvmeGB },
            {
              totalStorageGiB: roksSizing.nodeCalcParams.totalStorageGiB,
              replicaFactor: roksSizing.nodeCalcParams.replicaFactor,
              cephOverhead: roksSizing.nodeCalcParams.cephOverhead,
              operationalCapacity: roksSizing.nodeCalcParams.operationalCapacity,
              nodeRedundancy: roksSizing.nodeCalcParams.nodeRedundancy,
              odfTuningProfile: roksSizing.nodeCalcParams.odfTuningProfile,
              odfCpuUnitMode: roksSizing.nodeCalcParams.odfCpuUnitMode,
              htMultiplier: roksSizing.nodeCalcParams.htMultiplier,
              useHyperthreading: roksSizing.nodeCalcParams.useHyperthreading,
              includeRgw: roksSizing.nodeCalcParams.includeRgw,
            },
          );
          const storageCost = sNodes * p.monthlyRate;
          if (storageCost < bestStorageCost) {
            bestStorageCost = storageCost;
            storageNodes = sNodes;
            storageProfileName = p.id;
          }
        }
      }

      // Build sizing input for this solution
      const input: ROKSSizingInput = {
        ...roksSizing,
        solutionType: st,
        computeProfile: profileName,
        computeNodes: bestNodeCount,
        useNvme: st === 'nvme-converged',
        ...(st === 'bm-disaggregated' && storageNodes && storageProfileName ? {
          storageNodes,
          storageProfile: storageProfileName,
        } : {}),
      };

      const roksEstimate = calculateROKSCost(input, region, discountType, pricing, 'full');
      const rovEstimate = calculateROKSCost(input, region, discountType, pricing, 'rov');

      return {
        solutionType: st,
        label: meta.label,
        description: meta.description,
        profileName,
        nodeCount: bestNodeCount,
        storageApproach: meta.storageApproach,
        hasOdf: meta.hasOdf,
        roksEstimate,
        rovEstimate,
      };
    });
  }, [roksSizing, region, discountType, pricing]);

  const cheapestMonthly = Math.min(...solutions.map(s => s.roksEstimate.totalMonthly));

  return (
    <Tile>
      <h3 style={{ marginBottom: '1rem' }}>Solution Architecture Comparison</h3>
      <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
        Side-by-side comparison of all ROKS deployment options using best-value profiles for each architecture.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {solutions.map((sol) => {
          const isCheapest = sol.roksEstimate.totalMonthly === cheapestMonthly;
          const delta = sol.roksEstimate.totalMonthly - cheapestMonthly;

          return (
            <Tile key={sol.solutionType} style={{ border: isCheapest ? '2px solid var(--cds-support-success)' : '1px solid var(--cds-border-subtle)', position: 'relative' }}>
              {isCheapest && (
                <Tag type="green" style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>Lowest Cost</Tag>
              )}
              <h4 style={{ marginBottom: '0.5rem' }}>{sol.label}</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem' }}>{sol.description}</p>

              <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Profile</span>
                  <strong>{sol.profileName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nodes</span>
                  <strong>{formatNumber(sol.nodeCount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Storage</span>
                  <strong>{sol.storageApproach}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ODF</span>
                  <Tag type={sol.hasOdf ? 'blue' : 'gray'} size="sm">{sol.hasOdf ? 'Yes' : 'No'}</Tag>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--cds-border-subtle)', margin: '0.5rem 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ROKS Monthly</span>
                  <strong>{formatCurrency(sol.roksEstimate.totalMonthly)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ROV Monthly</span>
                  <strong>{formatCurrency(sol.rovEstimate.totalMonthly)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>ROKS Annual</span>
                  <strong>{formatCurrency(sol.roksEstimate.totalAnnual)}</strong>
                </div>

                {!isCheapest && delta > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', textAlign: 'right' }}>
                    +{formatCurrency(delta)}/mo vs cheapest
                  </div>
                )}
              </div>
            </Tile>
          );
        })}
      </div>
    </Tile>
  );
}
