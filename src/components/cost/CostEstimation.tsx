// Cost Estimation Component
import { useMemo, useEffect } from 'react';
import {
  Tile,
  Select,
  SelectItem,
  Button,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  InlineNotification,
  Toggle,
  NumberInput,
  Accordion,
  AccordionItem,
  Tag,
} from '@carbon/react';
import { Download, Calculator } from '@carbon/icons-react';
import { MetricCard } from '@/components/common';
import { PricingRefresh } from '@/components/pricing';
import { ProfilesRefresh } from '@/components/profiles';
import { useDynamicPricing, useDynamicProfiles, useTargetLocation, useCostSettings } from '@/hooks';
import type { CostEstimate, RegionCode, DiscountType, ROKSSizingInput, VSISizingInput, DataQuality } from '@/services/costEstimation';
import { resolveRoksSolutionType } from '@/services/costEstimation';
import {
  calculateROKSCost,
  calculateVSICost,
  getRegions,
  getDiscountOptions,
  formatCurrency,
  formatCurrencyPrecise,
  getBareMetalProfiles,
} from '@/services/costEstimation';
import { downloadBOM, downloadVSIBOMExcel, downloadROKSBOMExcel } from '@/services/export';
import type { VMDetail, ROKSNodeDetail } from '@/services/export';
import { calculateOdfReservation } from '@/utils/odfCalculation';
import type { OdfTuningProfile, OdfCpuUnitMode } from '@/utils/odfCalculation';
import { calculateNodesForProfile } from '@/utils/nodeCalculation';
import { cacheBOMData } from '@/services/bomCache';
import type { ROKSSizing, VSIMapping } from '@/types/exportSizing';
import { sortProfileCosts, findBestValueProfileId } from './profileCostSort';
import './CostEstimation.scss';

interface CostEstimationProps {
  type: 'roks' | 'vsi';
  roksSizing?: ROKSSizingInput;
  vsiSizing?: VSISizingInput;
  vmDetails?: VMDetail[];
  roksNodeDetails?: ROKSNodeDetail[];
  title?: string;
  showPricingRefresh?: boolean;
  onProfileSelect?: (profileId: string) => void;
  onEstimateChange?: (totalMonthly: number | null) => void;
  onOdfTierChange?: (tier: 'advanced' | 'essentials') => void;
  onIncludeAcmChange?: (include: boolean) => void;
  roksVariant?: 'full' | 'rov';
  /** ROKS sizing summary for export cache — built by ROKSMigrationPage */
  roksSizingSummary?: ROKSSizing;
  /** VSI mapping summary for export cache — built by VSIMigrationPage */
  vsiMappingSummary?: VSIMapping[];
}

export function CostEstimation({ type, roksSizing, vsiSizing, vmDetails, roksNodeDetails, title, showPricingRefresh = true, onProfileSelect, onEstimateChange, onOdfTierChange, onIncludeAcmChange, roksVariant = 'full', roksSizingSummary, vsiMappingSummary }: CostEstimationProps) {
  const { targetMzr } = useTargetLocation();

  // Initialize region from Discovery's MZR selection, validated against available regions
  const validRegionCodes = getRegions().data.map(r => r.code);
  const initialRegion = targetMzr && validRegionCodes.includes(targetMzr as RegionCode)
    ? (targetMzr as RegionCode)
    : undefined;

  // Persisted cost settings
  const { region, setRegion, discountType, setDiscountType, networkingOptions, setNetworkingOptions } = useCostSettings(initialRegion);
  const showDetails = true; // Always show details

  // Dynamic pricing hook
  const {
    pricing,
    isRefreshing,
    lastUpdated,
    source,
    refreshPricing,
    isApiAvailable,
    error: pricingError,
  } = useDynamicPricing();

  // Dynamic profiles hook
  const {
    isRefreshing: isRefreshingProfiles,
    lastUpdated: profilesLastUpdated,
    source: profilesSource,
    refreshProfiles,
    isApiAvailable: isProfilesApiAvailable,
    error: profilesError,
    profileCounts,
  } = useDynamicProfiles();

  const regionsResult = getRegions(pricing);
  const discountResult = getDiscountOptions(pricing);
  const regions = regionsResult.data;
  const discountOptions = discountResult.data;

  // Collect data quality warnings for display
  const pricingWarnings = [...regionsResult.warnings, ...discountResult.warnings];
  const worstQuality: DataQuality = regionsResult.quality === 'fallback' || discountResult.quality === 'fallback'
    ? 'fallback'
    : regionsResult.quality === 'static' || discountResult.quality === 'static'
      ? 'static'
      : 'live';

  const estimate = useMemo<CostEstimate | null>(() => {
    if (type === 'roks' && roksSizing) {
      return calculateROKSCost(roksSizing, region, discountType, pricing);
    } else if (type === 'vsi' && vsiSizing) {
      // Add networking options to the sizing input
      const sizingWithNetworking: VSISizingInput = {
        ...vsiSizing,
        networking: networkingOptions,
      };
      return calculateVSICost(sizingWithNetworking, region, discountType, pricing);
    }
    return null;
  }, [type, roksSizing, vsiSizing, region, discountType, pricing, networkingOptions]);

  // Compute ROV estimate alongside ROKS estimate
  const rovEstimate = useMemo<CostEstimate | null>(() => {
    if (type === 'roks' && roksSizing) {
      return calculateROKSCost(roksSizing, region, discountType, pricing, 'rov');
    }
    return null;
  }, [type, roksSizing, region, discountType, pricing]);

  // Sync region when Discovery MZR changes
  useEffect(() => {
    if (targetMzr && validRegionCodes.includes(targetMzr as RegionCode)) {
      setRegion(targetMzr as RegionCode); // eslint-disable-line react-hooks/set-state-in-effect -- sync region from external prop
    }
  }, [targetMzr]); // eslint-disable-line react-hooks/exhaustive-deps -- validRegionCodes is stable

  // Notify parent of estimate changes
  useEffect(() => {
    onEstimateChange?.(estimate?.totalMonthly ?? null);
  }, [estimate?.totalMonthly, onEstimateChange]);

  // Cache BOM data for Export page — use ROV estimate when platform selection indicates ROV
  useEffect(() => {
    const estimateToCache = type === 'roks' && roksVariant === 'rov' && rovEstimate ? rovEstimate : estimate;
    if (estimateToCache) {
      // Fill monthlyCost from the actual estimate (it's 0 when the summary is built pre-estimate)
      const sizingSummary = roksSizingSummary
        ? { ...roksSizingSummary, monthlyCost: estimateToCache.totalMonthly }
        : undefined;
      cacheBOMData(type, estimateToCache, vmDetails, roksNodeDetails, region, discountType, roksSizing?.solutionType, sizingSummary, vsiMappingSummary);
    }
  }, [estimate, rovEstimate, roksVariant, type, vmDetails, roksNodeDetails, region, discountType, roksSizing?.solutionType, roksSizingSummary, vsiMappingSummary]);

  // Calculate costs for all bare metal profiles (ROKS only)
  const allProfileCosts = useMemo(() => {
    if (type !== 'roks' || !roksSizing) return null;

    const profilesResult = getBareMetalProfiles(pricing);
    const profiles = profilesResult.data;
    // Filter profiles based on solution type
    const solutionType = roksSizing.solutionType ? resolveRoksSolutionType(roksSizing) : 'nvme-converged';
    const needsNvme = solutionType === 'nvme-converged' || solutionType === 'hybrid-vsi-odf';
    const filteredProfiles = profiles.filter(p => needsNvme ? p.hasNvme : !p.hasNvme);

    const costs = filteredProfiles.map(profile => {
      // Calculate per-profile node count if we have the workload params
      let nodeCount = roksSizing.computeNodes;
      if (roksSizing.nodeCalcParams) {
        nodeCount = calculateNodesForProfile(
          {
            physicalCores: profile.physicalCores,
            memoryGiB: profile.memoryGiB,
            hasNvme: profile.hasNvme,
            nvmeDisks: profile.nvmeDisks,
            totalNvmeGB: profile.totalNvmeGB,
          },
          { ...roksSizing.nodeCalcParams, solutionType },
        );
      }

      const profileSizing: ROKSSizingInput = {
        ...roksSizing,
        computeProfile: profile.id,
        computeNodes: nodeCount,
      };
      const cost = calculateROKSCost(profileSizing, region, discountType, pricing);
      const rovCost = calculateROKSCost(profileSizing, region, discountType, pricing, 'rov');

      // Check if ODF reservation exceeds this profile's CPU capacity
      let cpuViable = true;
      if (solutionType !== 'bm-block-csi' && solutionType !== 'bm-nfs-csi' && solutionType !== 'bm-disaggregated' && roksSizing.odfSettings) {
        const { odfTuningProfile, odfCpuUnitMode, htMultiplier, useHyperthreading, includeRgw, systemReservedCpu, cpuOvercommit } = roksSizing.odfSettings;
        // For bm-block-odf, use 1 OSD per node (block storage volumes); for NVMe, use actual disk count
        const osdCount = solutionType === 'bm-block-odf' ? 1 : (profile.nvmeDisks ?? 0);
        const odf = calculateOdfReservation(
          odfTuningProfile as OdfTuningProfile,
          osdCount,
          3,
          includeRgw,
          odfCpuUnitMode as OdfCpuUnitMode,
          htMultiplier,
          useHyperthreading,
        );
        // Check if workload CPU capacity would be zero
        let effectiveCores: number;
        if (odfCpuUnitMode === 'physical') {
          const availableCores = Math.max(0, profile.physicalCores - odf.totalCpu - systemReservedCpu);
          effectiveCores = useHyperthreading ? availableCores * htMultiplier : availableCores;
        } else {
          const totalVcpus = useHyperthreading ? profile.physicalCores * htMultiplier : profile.physicalCores;
          const systemReservedVcpu = useHyperthreading ? systemReservedCpu * htMultiplier : systemReservedCpu;
          effectiveCores = Math.max(0, totalVcpus - odf.totalCpu - systemReservedVcpu);
        }
        cpuViable = Math.floor(effectiveCores * cpuOvercommit) > 0;
      }

      return {
        profile,
        estimate: cost,
        rovEstimate: rovCost,
        isSelected: profile.id === roksSizing.computeProfile,
        cpuViable,
        nodeCount,
      };
    });

    const lowestCostProfileId = findBestValueProfileId(costs);

    return sortProfileCosts(
      costs.map(c => ({
        ...c,
        isBestValue: c.profile.id === lowestCostProfileId,
      }))
    );
  }, [type, roksSizing, region, discountType, pricing]);

  // Detect if the selected profile has no pricing (custom profile with $0 rates)
  const hasUnpriceableCompute = estimate?.lineItems.some(
    item => item.category === 'Compute' && item.notes === 'Custom profile - no pricing available'
  ) ?? false;

  if (!estimate) {
    return (
      <Tile className="cost-estimation cost-estimation--empty">
        <div className="cost-estimation__empty-state">
          <Calculator size={48} />
          <p>Configure sizing parameters to see cost estimates</p>
        </div>
      </Tile>
    );
  }

  const tableHeaders = [
    { key: 'category', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'details', header: 'Details' },
    { key: 'quantity', header: 'Qty' },
    { key: 'unitCost', header: 'Unit Cost' },
    { key: 'monthlyCost', header: 'Monthly' },
    { key: 'annualCost', header: 'Annual' },
  ];

  const tableRows = estimate.lineItems.map((item, idx) => {
    const isUnpriceable = item.notes === 'Custom profile - no pricing available';
    return {
      id: `item-${idx}`,
      category: item.category,
      description: item.description,
      details: item.notes || '',
      quantity: `${item.quantity.toLocaleString()} ${item.unit}`,
      unitCost: isUnpriceable ? 'N/A' : (item.unitCost < 1 ? formatCurrencyPrecise(item.unitCost) : formatCurrency(item.unitCost)),
      monthlyCost: isUnpriceable ? 'Unable to Price' : formatCurrency(item.monthlyCost),
      annualCost: isUnpriceable ? 'Unable to Price' : formatCurrency(item.annualCost),
      notes: item.notes,
    };
  });

  const handleExport = async (format: 'text' | 'json' | 'csv' | 'xlsx') => {
    if (format === 'xlsx') {
      // Use xlsx export for detailed BOM
      if (type === 'vsi' && vmDetails && vmDetails.length > 0) {
        await downloadVSIBOMExcel(vmDetails, estimate, 'Default VPC', region, discountType);
      } else if (type === 'roks' && roksNodeDetails && roksNodeDetails.length > 0) {
        await downloadROKSBOMExcel(estimate, roksNodeDetails, 'ROKS Cluster', region, discountType, undefined, roksSizing?.solutionType);
      } else {
        // Fallback to text BOM if no detailed data
        downloadBOM(estimate, 'text');
      }
    } else {
      downloadBOM(estimate, format);
    }
  };

  return (
    <div className="cost-estimation">
      <Tile className="cost-estimation__header">
        <div className="cost-estimation__title-row">
          <h3>{title || 'Cost Estimation'}</h3>
          <div className="cost-estimation__actions">
            {showPricingRefresh && (
              <>
                <PricingRefresh
                  lastUpdated={lastUpdated}
                  source={source}
                  isRefreshing={isRefreshing}
                  onRefresh={refreshPricing}
                  isApiAvailable={isApiAvailable}
                  error={pricingError}
                  compact
                />
                <ProfilesRefresh
                  lastUpdated={profilesLastUpdated}
                  source={profilesSource}
                  isRefreshing={isRefreshingProfiles}
                  onRefresh={refreshProfiles}
                  isApiAvailable={isProfilesApiAvailable}
                  error={profilesError}
                  profileCounts={profileCounts}
                  compact
                />
              </>
            )}
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Download}
              onClick={() => handleExport('xlsx')}
            >
              Export BOM
            </Button>
          </div>
        </div>

        {worstQuality === 'fallback' && pricingWarnings.length > 0 && (
          <InlineNotification
            kind="warning"
            title="Pricing data incomplete"
            subtitle={pricingWarnings.join('. ')}
            lowContrast
            hideCloseButton
          />
        )}

        <div className="cost-estimation__controls">
          <Select
            id="region-select"
            labelText="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionCode)}
          >
            {regions.map((r) => (
              <SelectItem
                key={r.code}
                value={r.code}
                text={r.name}
              />
            ))}
          </Select>

          <Select
            id="discount-select"
            labelText="Pricing"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
          >
            {discountOptions.map((d) => (
              <SelectItem
                key={d.id}
                value={d.id}
                text={`${d.name}${d.discountPct > 0 ? ` (-${d.discountPct}%)` : ''}`}
              />
            ))}
          </Select>
        </div>

        {/* ROKS Licensing Options */}
        {type === 'roks' && (
          <div className="cost-estimation__roks-options">
            {roksSizing?.solutionType !== 'bm-block-csi' && roksSizing?.solutionType !== 'bm-nfs-csi' && (
            <Select
              id="odf-tier-select"
              labelText="ODF Tier"
              value={roksSizing?.odfTier ?? 'advanced'}
              onChange={(e) => onOdfTierChange?.(e.target.value as 'advanced' | 'essentials')}
            >
              <SelectItem value="advanced" text="ODF Advanced ($681.82/node/mo)" />
              <SelectItem value="essentials" text="ODF Essentials ($545.46/node/mo)" />
            </Select>
            )}

            <Toggle
              id="acm-toggle"
              labelText="Advanced Cluster Management (ACM)"
              labelA="Off"
              labelB="On"
              toggled={roksSizing?.includeAcm ?? false}
              onToggle={(checked) => onIncludeAcmChange?.(checked)}
            />
            <span className="cost-estimation__networking-hint">Per-vCPU charge (~$21.75/vCPU/mo, estimated)</span>
          </div>
        )}

        {/* Networking Options (VSI only) */}
        {type === 'vsi' && (
          <Accordion className="cost-estimation__networking-accordion">
            <AccordionItem title="VPC Networking Options" open={false}>
              <div className="cost-estimation__networking-options">
                <div className="cost-estimation__networking-row">
                  <Toggle
                    id="vpn-toggle"
                    labelText="VPN Gateway"
                    labelA="Off"
                    labelB="On"
                    toggled={networkingOptions.includeVPN}
                    onToggle={(checked) => setNetworkingOptions(prev => ({ ...prev, includeVPN: checked }))}
                  />
                  {networkingOptions.includeVPN && (
                    <NumberInput
                      id="vpn-count"
                      label="Gateway count"
                      min={1}
                      max={10}
                      value={networkingOptions.vpnGatewayCount}
                      onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, vpnGatewayCount: value as number }))}
                      size="sm"
                      hideSteppers
                    />
                  )}
                  <span className="cost-estimation__networking-hint">Site-to-site VPN ($125/mo per gateway)</span>
                </div>

                <div className="cost-estimation__networking-row">
                  <Toggle
                    id="transit-gw-toggle"
                    labelText="Transit Gateway"
                    labelA="Off"
                    labelB="On"
                    toggled={networkingOptions.includeTransitGateway}
                    onToggle={(checked) => setNetworkingOptions(prev => ({ ...prev, includeTransitGateway: checked }))}
                  />
                  {networkingOptions.includeTransitGateway && (
                    <>
                      <NumberInput
                        id="transit-local"
                        label="Local connections"
                        min={0}
                        max={20}
                        value={networkingOptions.transitGatewayLocalConnections}
                        onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, transitGatewayLocalConnections: value as number }))}
                        size="sm"
                        hideSteppers
                      />
                      <NumberInput
                        id="transit-global"
                        label="Global connections"
                        min={0}
                        max={20}
                        value={networkingOptions.transitGatewayGlobalConnections}
                        onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, transitGatewayGlobalConnections: value as number }))}
                        size="sm"
                        hideSteppers
                      />
                    </>
                  )}
                  <span className="cost-estimation__networking-hint">VPC/Classic connectivity ($45/mo local, $170/mo global)</span>
                </div>

                <div className="cost-estimation__networking-row">
                  <Toggle
                    id="public-gw-toggle"
                    labelText="Public Gateway"
                    labelA="Off"
                    labelB="On"
                    toggled={networkingOptions.includePublicGateway}
                    onToggle={(checked) => setNetworkingOptions(prev => ({ ...prev, includePublicGateway: checked }))}
                  />
                  {networkingOptions.includePublicGateway && (
                    <NumberInput
                      id="public-gw-count"
                      label="Gateway count"
                      min={1}
                      max={10}
                      value={networkingOptions.publicGatewayCount}
                      onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, publicGatewayCount: value as number }))}
                      size="sm"
                      hideSteppers
                    />
                  )}
                  <span className="cost-estimation__networking-hint">Outbound internet access ($65/mo per gateway)</span>
                </div>

                <div className="cost-estimation__networking-row">
                  <NumberInput
                    id="lb-count"
                    label="Load Balancers"
                    min={0}
                    max={20}
                    value={networkingOptions.loadBalancerCount}
                    onChange={(_, { value }) => setNetworkingOptions(prev => ({ ...prev, loadBalancerCount: value as number }))}
                    size="sm"
                    hideSteppers
                  />
                  <span className="cost-estimation__networking-hint">Application Load Balancer ($35/mo each)</span>
                </div>
              </div>
            </AccordionItem>
          </Accordion>
        )}
      </Tile>

      {/* Cost Summary */}
      <div className="cost-estimation__summary">
        <MetricCard
          label={type === 'roks' ? 'ROKS Monthly' : 'Monthly Cost'}
          value={hasUnpriceableCompute ? 'Unable to Price' : formatCurrency(estimate.totalMonthly)}
          detail={hasUnpriceableCompute ? 'Custom profile has no pricing data' : (estimate.discountPct > 0 ? `${estimate.discountPct}% discount applied` : undefined)}
          variant={hasUnpriceableCompute ? 'warning' : 'primary'}
        />
        <MetricCard
          label={type === 'roks' ? 'ROKS Annual' : 'Annual Cost'}
          value={hasUnpriceableCompute ? 'Unable to Price' : formatCurrency(estimate.totalAnnual)}
          detail={hasUnpriceableCompute ? 'Custom profile has no pricing data' : undefined}
          variant={hasUnpriceableCompute ? 'warning' : 'info'}
        />
        {!hasUnpriceableCompute && estimate.discountPct > 0 && (
          <MetricCard
            label="Annual Savings"
            value={formatCurrency(estimate.discountAmountAnnual)}
            variant="success"
          />
        )}
        {type === 'roks' && rovEstimate && !hasUnpriceableCompute && (
          <>
            <MetricCard
              label="ROV Monthly"
              value={formatCurrency(rovEstimate.totalMonthly)}
              detail={`Save ${formatCurrency(estimate.totalMonthly - rovEstimate.totalMonthly)}/mo vs ROKS`}
              variant="teal"
            />
            <MetricCard
              label="ROV Annual"
              value={formatCurrency(rovEstimate.totalAnnual)}
              detail={`Save ${formatCurrency(estimate.totalAnnual - rovEstimate.totalAnnual)}/yr vs ROKS`}
              variant="teal"
            />
          </>
        )}
      </div>

      {/* Bare Metal Profile Comparison (ROKS only) */}
      {type === 'roks' && allProfileCosts && allProfileCosts.length > 0 && (
        <Tile className="cost-estimation__profile-comparison">
          <h4 className="cost-estimation__profile-comparison-title">
            Bare Metal Profile Cost Comparison
          </h4>
          <p className="cost-estimation__profile-comparison-subtitle">
            {roksSizing?.nodeCalcParams
              ? `Per-profile node counts for your workload with ${roksSizing?.useNvme ? 'NVMe storage' : 'block storage'}`
              : `Costs for ${roksSizing?.computeNodes || 0} nodes with ${roksSizing?.useNvme ? 'NVMe storage' : 'block storage'}`}
            {onProfileSelect && ' — click a profile to select it in the Sizing Calculator'}
          </p>
          <div className="cost-estimation__profile-grid">
            {allProfileCosts.map(({ profile, estimate: profileEstimate, rovEstimate: profileRovEstimate, isSelected, isBestValue, cpuViable, nodeCount }) => (
              <div
                key={profile.id}
                className={`cost-estimation__profile-card ${isSelected ? 'cost-estimation__profile-card--selected' : ''} ${isBestValue ? 'cost-estimation__profile-card--best-value' : ''} ${onProfileSelect ? 'cost-estimation__profile-card--clickable' : ''}`}
                onClick={onProfileSelect ? () => onProfileSelect(profile.id) : undefined}
                onKeyDown={onProfileSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onProfileSelect(profile.id); } } : undefined}
                role={onProfileSelect ? 'button' : undefined}
                tabIndex={onProfileSelect ? 0 : undefined}
                aria-label={onProfileSelect ? `Select ${profile.id} profile in Sizing Calculator` : undefined}
              >
                <div className="cost-estimation__profile-card-header">
                  <span className="cost-estimation__profile-name">{profile.id}</span>
                  <div className="cost-estimation__profile-tags">
                    {isBestValue && <Tag type="green" size="sm">Best Value</Tag>}
                    {isSelected && <Tag type="blue" size="sm">Selected</Tag>}
                    {!cpuViable && <Tag type="magenta" size="sm">ODF exceeds CPU</Tag>}
                    {profile.isCustom && profile.tag ? (
                      <Tag type="purple" size="sm">{profile.tag}</Tag>
                    ) : profile.roksSupported ? (
                      <Tag type="teal" size="sm">ROKS</Tag>
                    ) : (
                      <Tag type="gray" size="sm">VPC Only</Tag>
                    )}
                  </div>
                </div>
                <div className="cost-estimation__profile-specs">
                  <span>{nodeCount} nodes</span>
                  <span>{profile.physicalCores} cores</span>
                  <span>{profile.memoryGiB} GiB RAM</span>
                  {profile.hasNvme && profile.totalNvmeGB && (
                    <span>{Math.round(profile.totalNvmeGB / 1024)} TiB NVMe</span>
                  )}
                </div>
                <div className="cost-estimation__profile-family">
                  <Tag type="gray" size="sm">{profile.family}</Tag>
                </div>
                <div className="cost-estimation__profile-costs">
                  {profile.isCustom && (!profile.monthlyRate || profile.monthlyRate === 0) ? (
                    <div className="cost-estimation__profile-cost-row">
                      <span className="cost-estimation__profile-cost-value cost-estimation__profile-cost-value--unavailable">Unable to Price</span>
                    </div>
                  ) : (
                    <>
                      <div className="cost-estimation__profile-cost-row">
                        <span className="cost-estimation__profile-cost-label">ROKS Monthly</span>
                        <span className="cost-estimation__profile-cost-value">{formatCurrency(profileEstimate.totalMonthly)}</span>
                      </div>
                      <div className="cost-estimation__profile-cost-row">
                        <span className="cost-estimation__profile-cost-label">ROKS Annual</span>
                        <span className="cost-estimation__profile-cost-value cost-estimation__profile-cost-value--annual">{formatCurrency(profileEstimate.totalAnnual)}</span>
                      </div>
                      <div className="cost-estimation__profile-cost-row">
                        <span className="cost-estimation__profile-cost-label">ROV Monthly</span>
                        <span className="cost-estimation__profile-cost-value" style={{ color: '#009d9a' }}>{formatCurrency(profileRovEstimate.totalMonthly)}</span>
                      </div>
                      <div className="cost-estimation__profile-cost-row">
                        <span className="cost-estimation__profile-cost-label">ROV Annual</span>
                        <span className="cost-estimation__profile-cost-value cost-estimation__profile-cost-value--annual" style={{ color: '#009d9a' }}>{formatCurrency(profileRovEstimate.totalAnnual)}</span>
                      </div>
                    </>
                  )}
                </div>
                {isBestValue && !isSelected && !(profile.isCustom && (!profile.monthlyRate || profile.monthlyRate === 0)) && (
                  <div className="cost-estimation__profile-savings">
                    Save {formatCurrency((estimate.totalAnnual - profileEstimate.totalAnnual))}/year
                  </div>
                )}
              </div>
            ))}
          </div>
        </Tile>
      )}

      {/* Line Items Table */}
      {showDetails && (
        <Tile className="cost-estimation__details">
          <DataTable rows={tableRows} headers={tableHeaders} size="md">
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <Table {...getTableProps()} aria-label="Cost estimation line items">
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {/* Subtotal row */}
                  <TableRow className="cost-estimation__subtotal-row">
                    <TableCell colSpan={5}><strong>Subtotal</strong></TableCell>
                    <TableCell><strong>{hasUnpriceableCompute ? 'Unable to Price' : formatCurrency(estimate.subtotalMonthly)}</strong></TableCell>
                    <TableCell><strong>{hasUnpriceableCompute ? 'Unable to Price' : formatCurrency(estimate.subtotalAnnual)}</strong></TableCell>
                  </TableRow>
                  {/* Discount row */}
                  {!hasUnpriceableCompute && estimate.discountPct > 0 && (
                    <TableRow className="cost-estimation__discount-row">
                      <TableCell colSpan={5}>
                        <em>Discount ({estimate.discountPct}%)</em>
                      </TableCell>
                      <TableCell><em>-{formatCurrency(estimate.discountAmountMonthly)}</em></TableCell>
                      <TableCell><em>-{formatCurrency(estimate.discountAmountAnnual)}</em></TableCell>
                    </TableRow>
                  )}
                  {/* Total row */}
                  <TableRow className="cost-estimation__total-row">
                    <TableCell colSpan={5}><strong>Total</strong></TableCell>
                    <TableCell><strong>{hasUnpriceableCompute ? 'Unable to Price' : formatCurrency(estimate.totalMonthly)}</strong></TableCell>
                    <TableCell><strong>{hasUnpriceableCompute ? 'Unable to Price' : formatCurrency(estimate.totalAnnual)}</strong></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </DataTable>
        </Tile>
      )}

      {/* Notes */}
      <InlineNotification
        kind="info"
        title="Pricing Notes"
        subtitle={estimate.metadata.notes.join(' • ')}
        lowContrast
        hideCloseButton
        className="cost-estimation__notes"
      />

      <div className="cost-estimation__metadata">
        <span>Architecture: {estimate.architecture}</span>
        <span>Region: {estimate.regionName}</span>
        <span>Pricing Version: {estimate.metadata.pricingVersion}</span>
      </div>
    </div>
  );
}
