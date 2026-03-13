#!/usr/bin/env npx tsx
/**
 * Script to update ibmCloudConfig.json with fresh pricing data from IBM Cloud Global Catalog API
 *
 * Usage:
 *   npm run update-pricing
 *
 * No API key required — uses unauthenticated Global Catalog API calls (list prices).
 *
 * What it does:
 *   1. Fetches VSI profile pricing from Global Catalog API for all regions
 *   2. Fetches Bare Metal profile pricing from Global Catalog API for all regions
 *   3. Computes hourly/monthly rates per region (vCPU rate × vCPUs + memory rate × GB)
 *   4. Updates pricing in src/data/ibmCloudConfig.json (us-south for backward compat + per-region)
 *   5. Preserves all other configuration (profiles, storage tiers, networking, etc.)
 *
 * Pricing model:
 *   IBM Cloud VPC pricing is component-based, not flat per-profile. Each profile's catalog
 *   entry contains a plan ID in metadata.other.profile.measures. The plan's deployment-level
 *   pricing provides per-vCPU-hour and per-GB-memory-hour rates. The profile's hourly rate
 *   is computed as: (cpuRate × vCPUs) + (memRate × memoryGB) + (storageRate × instanceStorageGB).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GLOBAL_CATALOG_BASE_URL = 'https://globalcatalog.cloud.ibm.com/api/v1';
const DEFAULT_REGION = 'us-south';
const HOURS_PER_MONTH = 730; // IBM Cloud uses 730 hours/month for pricing

const CONFIG_PATH = path.join(__dirname, '..', 'src', 'data', 'ibmCloudConfig.json');

// Types
interface PricingMetric {
  metric_id: string;
  tier_model?: string;
  resource_display_name?: string;
  charge_unit_display_name?: string;
  charge_unit_name?: string;
  charge_unit?: string;
  charge_unit_quantity?: number;
  amounts?: Array<{
    country: string;
    currency: string;
    prices: Array<{
      quantity_tier: number;
      price: number;
    }>;
  }>;
}

interface PricingDeploymentEntry {
  deployment_id: string;
  deployment_location: string;
  deployment_region?: string;
  metrics: PricingMetric[] | null;
}

interface PricingDeploymentResponse {
  offset: number;
  limit: number;
  count: number;
  resource_count: number;
  resources: PricingDeploymentEntry[];
}

interface CatalogEntry {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  disabled: boolean;
  metadata?: {
    other?: {
      profile?: {
        measures?: Array<{
          component: string;
          deployments?: Array<{
            type: string;
            plan: string;
            meters?: Array<{
              quantity: string;
              unit: string;
            }>;
          }>;
        }>;
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

interface CatalogSearchResponse {
  offset: number;
  limit: number;
  count: number;
  resource_count: number;
  resources: CatalogEntry[];
}

// Per-unit pricing rates from a plan's deployment (gen2 component-based model)
interface PlanRates {
  cpuPerHour: number;    // per vCPU-hour
  memPerHour: number;    // per GB-hour
  storagePerHour: number; // per GB-hour (instance storage)
}

// Flat per-profile hourly rate (gen3+ model)
interface FlatRate {
  hourlyRate: number;
}

// Profile info extracted from catalog metadata
interface ProfileMeasures {
  planId: string;
  vcpus: number;
  memoryGB: number;
}

// Rate-limit delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch a catalog entry by ID with metadata
async function fetchCatalogEntry(id: string): Promise<CatalogEntry | null> {
  const url = `${GLOBAL_CATALOG_BASE_URL}/${encodeURIComponent(id)}?include=metadata`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) return null;
  return response.json() as Promise<CatalogEntry>;
}

// Search the Global Catalog with metadata
async function searchCatalogWithMetadata(query: string, limit = 200): Promise<CatalogSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    include: 'metadata',
    _limit: limit.toString(),
  });
  const url = `${GLOBAL_CATALOG_BASE_URL}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Catalog search failed: ${response.status} - ${text}`);
  }
  return response.json() as Promise<CatalogSearchResponse>;
}

// Fetch plan pricing deployments with pagination
async function fetchPlanPricingDeployments(
  planId: string
): Promise<PricingDeploymentEntry[]> {
  const allEntries: PricingDeploymentEntry[] = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const url = `${GLOBAL_CATALOG_BASE_URL}/${encodeURIComponent(planId)}/pricing/deployment?_offset=${offset}&_limit=${limit}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) break;

    const data = await response.json() as PricingDeploymentResponse;
    allEntries.push(...(data.resources || []));
    if ((data.resources || []).length < limit) break;
    offset += limit;
  }

  return allEntries;
}

// Extract pricing from ALL deployments (all regions).
// Returns a map of region → { rates?, flatRate? }
function extractAllRegionPricing(
  deployments: PricingDeploymentEntry[]
): Record<string, { rates?: PlanRates; flatRate?: FlatRate }> {
  const result: Record<string, { rates?: PlanRates; flatRate?: FlatRate }> = {};

  for (const deployment of deployments) {
    const region = deployment.deployment_location || deployment.deployment_region || '';
    if (!region || !deployment.metrics) continue;

    let cpuPerHour = 0;
    let memPerHour = 0;
    let storagePerHour = 0;
    let flatHourlyRate = 0;

    for (const metric of deployment.metrics) {
      const usdAmount = metric.amounts?.find(a => a.country === 'USA' && a.currency === 'USD');
      const price = usdAmount?.prices?.find(p => p.quantity_tier === 1)?.price
        ?? usdAmount?.prices?.[0]?.price;
      if (price === undefined || price === null || price === 0) continue;

      const qty = metric.charge_unit_quantity || 1;
      const perUnit = price / qty;

      // Gen2 component-based pricing (VSI)
      if (metric.metric_id === 'part-is.cpu-hours' || metric.charge_unit_name === 'VCPU_HOURS') {
        cpuPerHour = perUnit;
      } else if (metric.metric_id === 'part-is.ram-hours' || metric.charge_unit_name === 'MEMORY_HOURS') {
        memPerHour = perUnit;
      } else if (metric.metric_id === 'part-is.instance-storage-hours' || metric.charge_unit_name === 'IS_STORAGE_GIGABYTE_HOURS') {
        storagePerHour = perUnit;
      }
      // Z-series (LinuxONE) component-based pricing
      else if (metric.charge_unit_name === 'SECUREEXECUTION_VCPU_HOURS' || metric.metric_id === 'part-is.zvsi.SE-cpu-hours') {
        cpuPerHour = perUnit;
      } else if (metric.charge_unit_name === 'SECUREEXECUTION_MEMORY_HOURS' || metric.metric_id === 'part-is.zvsi.SE-ram-hours') {
        memPerHour = perUnit;
      }
      // Gen3+ flat per-profile pricing (metric_id like "part-is.instance-hours-bx3d-16x80")
      else if (metric.charge_unit_name === 'INSTANCE_HOURS_MULTI_TENANT' ||
               (metric.metric_id?.startsWith('part-is.instance-hours') && !metric.metric_id.includes('-dh-'))) {
        flatHourlyRate = price;
      }
      // Bare metal flat per-server pricing
      else if (metric.charge_unit_name === 'BARE_METAL_SERVER_HOURS') {
        flatHourlyRate = price;
      }
    }

    const entry: { rates?: PlanRates; flatRate?: FlatRate } = {};
    if (cpuPerHour > 0 && memPerHour > 0) {
      entry.rates = { cpuPerHour, memPerHour, storagePerHour };
    }
    if (flatHourlyRate > 0) {
      entry.flatRate = { hourlyRate: flatHourlyRate };
    }
    if (entry.rates || entry.flatRate) {
      result[region] = entry;
    }
  }

  return result;
}

// Extract profile measures (plan ID, vCPUs, memory) from catalog metadata
function extractProfileMeasures(entry: CatalogEntry): ProfileMeasures | null {
  const measures = entry.metadata?.other?.profile?.measures;
  if (!measures) return null;

  // VSI profiles use component 'instance', bare metal uses 'BareMetalServer'
  const instanceMeasure = measures.find(m => m.component === 'instance')
    || measures.find(m => m.component === 'BareMetalServer');
  if (!instanceMeasure?.deployments) return null;

  // VSI: prefer multi-tenant; Bare metal: use single-tenant
  const deployment = instanceMeasure.deployments.find(d => d.type === 'multi-tenant')
    || instanceMeasure.deployments.find(d => d.type === 'single-tenant')
    || instanceMeasure.deployments[0];
  if (!deployment?.plan) return null;

  const meters = deployment.meters || [];
  const vcpus = parseInt(meters.find(m => m.unit === 'VCPU')?.quantity || '0', 10);
  const memoryGB = parseInt(meters.find(m => m.unit === 'MEMORY')?.quantity || '0', 10);

  // Bare metal profiles may not have VCPU/MEMORY meters — that's OK, we'll use flat pricing
  return { planId: deployment.plan, vcpus, memoryGB };
}

// Parse vCPUs and memory from profile name (e.g., "bx2-16x64" → 16 vCPUs, 64 GB)
function parseProfileName(name: string): { vcpus: number; memoryGB: number } | null {
  // Match patterns like bx2-16x64, cx3d-8x20, mx2d-metal-96x768
  const match = name.match(/(\d+)x(\d+)(?:x\d+)?$/);
  if (!match) return null;
  return { vcpus: parseInt(match[1], 10), memoryGB: parseInt(match[2], 10) };
}

// Compute hourly rate for a profile given plan rates and profile specs
function computeHourlyRate(rates: PlanRates, vcpus: number, memoryGB: number): number {
  return rates.cpuPerHour * vcpus + rates.memPerHour * memoryGB;
}

// Result type for fetchComponentPricing — includes both us-south (backward compat) and all-region data
interface ComponentPricingResult {
  pricing: Map<string, { hourlyRate: number; monthlyRate: number }>;  // us-south rates
  regionalPricing: Map<string, Record<string, { hourlyRate: number; monthlyRate: number }>>; // profile → region → rates
}

// Fetch pricing for a set of profiles using the component-based pricing model
async function fetchComponentPricing(
  serviceQuery: string,
  profileKind: string,
  configProfileNames: string[]
): Promise<ComponentPricingResult> {
  const pricing = new Map<string, { hourlyRate: number; monthlyRate: number }>();
  const regionalPricing = new Map<string, Record<string, { hourlyRate: number; monthlyRate: number }>>();

  // Step 1: Fetch all catalog profile entries to get plan IDs and vCPU/memory specs
  console.log('  Step 1: Fetching profile metadata from catalog...');
  const catalogResponse = await searchCatalogWithMetadata(serviceQuery);
  const catalogProfiles = catalogResponse.resources.filter(
    r => r.active && !r.disabled && r.kind === profileKind
  );
  console.log(`    Found ${catalogProfiles.length} profiles in catalog bulk search`);

  // Build profile-to-measures map from catalog results
  const profileMeasuresMap = new Map<string, ProfileMeasures>();
  for (const entry of catalogProfiles) {
    const measures = extractProfileMeasures(entry);
    if (measures) {
      profileMeasuresMap.set(entry.name, measures);
    }
  }
  console.log(`    ${profileMeasuresMap.size} profiles have plan metadata`);

  // Step 2: For config profiles not found in bulk search, do individual lookups
  const missingFromBulk = configProfileNames.filter(name => !profileMeasuresMap.has(name));
  if (missingFromBulk.length > 0) {
    console.log(`  Step 2: Individual catalog lookups for ${missingFromBulk.length} remaining profiles...`);
    let found = 0;
    for (let i = 0; i < missingFromBulk.length; i++) {
      const name = missingFromBulk[i];

      // Try direct lookup first (works for VSI profiles)
      const entry = await fetchCatalogEntry(name);
      let measures = entry ? extractProfileMeasures(entry) : null;

      // If direct lookup didn't get measures, try search (needed for bare metal)
      if (!measures) {
        const searchResult = await searchCatalogWithMetadata(name, 5);
        const match = searchResult.resources.find(r => r.name === name && r.active && !r.disabled);
        if (match) {
          measures = extractProfileMeasures(match);
        }
      }

      if (measures) {
        profileMeasuresMap.set(name, measures);
        found++;
      }

      if (i < missingFromBulk.length - 1) await delay(50);
      if ((i + 1) % 20 === 0) {
        console.log(`    Processed ${i + 1}/${missingFromBulk.length}...`);
      }
    }
    console.log(`    Found ${found} additional profiles with plan metadata`);
  } else {
    console.log('  Step 2: All config profiles found in bulk search');
  }

  // Step 3: Collect unique plan IDs and fetch their pricing (all regions)
  console.log('  Step 3: Fetching plan pricing rates (all regions)...');
  const uniquePlanIds = new Set<string>();
  for (const name of configProfileNames) {
    const measures = profileMeasuresMap.get(name);
    if (measures) uniquePlanIds.add(measures.planId);
  }
  console.log(`    ${uniquePlanIds.size} unique plans to fetch pricing for`);

  // planId → region → { rates?, flatRate? }
  const planRegionalRatesMap = new Map<string, Record<string, { rates?: PlanRates; flatRate?: FlatRate }>>();
  let plansFetched = 0;
  let plansWithPricing = 0;
  for (const planId of uniquePlanIds) {
    const deployments = await fetchPlanPricingDeployments(planId);
    const allRegionRates = extractAllRegionPricing(deployments);
    if (Object.keys(allRegionRates).length > 0) {
      planRegionalRatesMap.set(planId, allRegionRates);
      plansWithPricing++;
    }
    plansFetched++;
    if (plansFetched % 20 === 0) {
      console.log(`    Fetched ${plansFetched}/${uniquePlanIds.size} plan prices...`);
    }
    await delay(50);
  }
  console.log(`    ${plansWithPricing} plans with valid pricing across regions`);

  // Step 4: Compute per-profile pricing for ALL regions
  console.log('  Step 4: Computing per-profile pricing (all regions)...');
  for (const name of configProfileNames) {
    const measures = profileMeasuresMap.get(name);
    if (!measures) continue;

    const regionRates = planRegionalRatesMap.get(measures.planId);
    if (!regionRates) continue;

    const profileRegionalPricing: Record<string, { hourlyRate: number; monthlyRate: number }> = {};

    for (const [region, { rates, flatRate }] of Object.entries(regionRates)) {
      let hourlyRate = 0;

      // Prefer flat rate (gen3+), fall back to component-based (gen2)
      if (flatRate) {
        hourlyRate = flatRate.hourlyRate;
      } else if (rates) {
        hourlyRate = computeHourlyRate(rates, measures.vcpus, measures.memoryGB);
      }

      if (hourlyRate > 0) {
        const rounded = {
          hourlyRate: Math.round(hourlyRate * 10000) / 10000,
          monthlyRate: Math.round(hourlyRate * HOURS_PER_MONTH * 100) / 100,
        };
        profileRegionalPricing[region] = rounded;

        // Store us-south in the backward-compat pricing map
        if (region === DEFAULT_REGION) {
          pricing.set(name, rounded);
        }
      }
    }

    if (Object.keys(profileRegionalPricing).length > 0) {
      regionalPricing.set(name, profileRegionalPricing);
    }
  }

  // Step 5: For any profiles still missing us-south pricing, try to use component rates from the same family
  const stillMissing = configProfileNames.filter(name => !pricing.has(name));
  if (stillMissing.length > 0) {
    console.log(`  Step 5: Fallback estimation for ${stillMissing.length} profiles without plan pricing...`);
    // Group component rates by family prefix (e.g., "bx2", "cx3d") — us-south only for fallback
    const familyRates = new Map<string, PlanRates>();
    for (const [name, measures] of profileMeasuresMap) {
      const regionRates = planRegionalRatesMap.get(measures.planId);
      const usSouthRates = regionRates?.[DEFAULT_REGION]?.rates;
      if (!usSouthRates) continue;
      const familyMatch = name.match(/^([a-z]+\d+[a-z]*)/);
      if (familyMatch) {
        familyRates.set(familyMatch[1], usSouthRates);
      }
    }

    let fallbackCount = 0;
    for (const name of stillMissing) {
      const familyMatch = name.match(/^([a-z]+\d+[a-z]*)/);
      if (!familyMatch) continue;

      const rates = familyRates.get(familyMatch[1]);
      if (!rates) continue;

      const parsed = parseProfileName(name);
      if (!parsed) continue;

      const hourlyRate = computeHourlyRate(rates, parsed.vcpus, parsed.memoryGB);
      if (hourlyRate > 0) {
        pricing.set(name, {
          hourlyRate: Math.round(hourlyRate * 10000) / 10000,
          monthlyRate: Math.round(hourlyRate * HOURS_PER_MONTH * 100) / 100,
        });
        fallbackCount++;
      }
    }
    if (fallbackCount > 0) {
      console.log(`    Estimated ${fallbackCount} profiles using family rates`);
    }
  }

  // Count regions found
  const allRegions = new Set<string>();
  for (const regionMap of regionalPricing.values()) {
    for (const region of Object.keys(regionMap)) {
      allRegions.add(region);
    }
  }

  console.log(`  Total: ${pricing.size}/${configProfileNames.length} profiles with us-south pricing`);
  console.log(`  Regional: ${regionalPricing.size} profiles with pricing across ${allRegions.size} regions`);
  return { pricing, regionalPricing };
}

// Fetch VSI pricing
async function fetchVSIPricing(
  configProfileNames: string[]
): Promise<ComponentPricingResult> {
  console.log('');
  console.log('--- VSI Pricing ---');
  return fetchComponentPricing('is.instance', 'instance.profile', configProfileNames);
}

// Fetch Bare Metal pricing
async function fetchBareMetalPricing(
  configProfileNames: string[]
): Promise<ComponentPricingResult> {
  console.log('');
  console.log('--- Bare Metal Pricing ---');
  return fetchComponentPricing('is.bare-metal-server', 'bare_metal_server.profile', configProfileNames);
}

// ROKS pricing rates
interface ROKSPricingRates {
  ocpLicense: {
    perVCPUHourly: number;
    perVCPUMonthly: number;
    description: string;
  };
  odf: {
    advanced: {
      bareMetalPerNodeMonthly: number;
      vsiPerVCPUHourly: number;
      description: string;
    };
    essentials: {
      bareMetalPerNodeMonthly: number;
      vsiPerVCPUHourly: number;
      description: string;
    };
  };
  clusterManagement: {
    perClusterMonthly: number;
    description: string;
  };
  workerRates?: {
    bareMetal?: Record<string, { hourlyRate: number; monthlyRate: number }>;
    vsi?: Record<string, { hourlyRate: number; monthlyRate: number }>;
  };
}

// Per-region ROKS worker rates
interface RegionalROKSWorkerRates {
  bareMetal: Record<string, { hourlyRate: number; monthlyRate: number }>;
  vsi: Record<string, { hourlyRate: number; monthlyRate: number }>;
}

// Fetch ROKS per-profile worker node compute rates from Global Catalog
// ROKS workers have separate pricing plans that differ from standalone VPC VSI/bare metal rates.
// Plan pattern: containers.kubernetes.vpc.{profile-with-dots}.roks
// Metric: part-roks.vpc.{profile} (INSTANCE_HOURS)
async function fetchROKSWorkerRates(): Promise<{
  usSouth: RegionalROKSWorkerRates;
  regional: Record<string, RegionalROKSWorkerRates>;
}> {
  console.log('');
  console.log('--- ROKS Worker Node Rates ---');

  const usSouth: RegionalROKSWorkerRates = { bareMetal: {}, vsi: {} };
  const regional: Record<string, RegionalROKSWorkerRates> = {};

  try {
    // Paginate through all containers-kubernetes catalog entries
    let offset = 0;
    const limit = 200;
    const allPlans: CatalogEntry[] = [];

    while (true) {
      const params = new URLSearchParams({
        q: 'containers-kubernetes',
        include: 'metadata',
        _limit: limit.toString(),
        _offset: offset.toString(),
      });
      const url = `${GLOBAL_CATALOG_BASE_URL}?${params.toString()}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) break;

      const data = await response.json() as CatalogSearchResponse;
      const plans = (data.resources || []).filter(
        r => r.active && !r.disabled && r.kind === 'plan' && r.name?.includes('roks')
      );
      allPlans.push(...plans);

      if ((data.resources || []).length < limit) break;
      offset += limit;
      await delay(100);
    }

    // Filter to per-profile worker plans
    // Pattern: containers.kubernetes.vpc.{profile}.roks
    // Exclude: gen2, reserved, cluster-level, odf plans
    const excludePatterns = ['gen2', 'reserved', 'cluster', 'odf', 'rhoai'];
    const workerPlans = allPlans.filter(plan => {
      const name = plan.name || '';
      // Must match vpc worker pattern
      if (!name.includes('vpc') || !name.includes('roks')) return false;
      // Exclude non-profile plans
      if (excludePatterns.some(p => name.includes(p))) return false;
      // Must have a profile segment (e.g., bx3d.16x80)
      const parts = name.split('.');
      // Expected: containers.kubernetes.vpc.{family}.{spec}.roks or similar
      return parts.length >= 5;
    });

    console.log(`  Found ${workerPlans.length} ROKS worker profile plans`);

    let fetchedCount = 0;
    for (const plan of workerPlans) {
      const deployments = await fetchPlanPricingDeployments(plan.id);

      for (const deployment of deployments) {
        const region = deployment.deployment_location || deployment.deployment_region || '';
        if (!region || !deployment.metrics) continue;

        for (const metric of deployment.metrics) {
          // Look for the instance-hours metric: part-roks.vpc.{profile}
          if (!metric.metric_id?.startsWith('part-roks.vpc.')) continue;
          if (metric.metric_id?.includes('ocp') || metric.metric_id?.includes('disk') || metric.metric_id?.includes('rhoai')) continue;

          const usdAmount = metric.amounts?.find(a => a.country === 'USA' && a.currency === 'USD');
          const price = usdAmount?.prices?.find(p => p.quantity_tier === 1)?.price
            ?? usdAmount?.prices?.[0]?.price;
          if (!price || price === 0) continue;

          const qty = metric.charge_unit_quantity || 1;
          const hourlyRate = Math.round((price / qty) * 100000) / 100000;
          const monthlyRate = Math.round(hourlyRate * HOURS_PER_MONTH * 100) / 100;

          // Extract profile name from metric_id: part-roks.vpc.{profile-with-dots}
          // Convert dots to hyphens: bx3d.16x80 → bx3d-16x80
          const profileDotted = metric.metric_id.replace('part-roks.vpc.', '');
          const profileName = profileDotted.replace(/\./g, '-');

          const isBM = profileName.includes('metal');

          // Store in us-south backward-compat map
          if (region === DEFAULT_REGION) {
            if (isBM) {
              usSouth.bareMetal[profileName] = { hourlyRate, monthlyRate };
            } else {
              usSouth.vsi[profileName] = { hourlyRate, monthlyRate };
            }
          }

          // Store in regional map
          if (!regional[region]) {
            regional[region] = { bareMetal: {}, vsi: {} };
          }
          if (isBM) {
            regional[region].bareMetal[profileName] = { hourlyRate, monthlyRate };
          } else {
            regional[region].vsi[profileName] = { hourlyRate, monthlyRate };
          }

          fetchedCount++;
        }
      }
      await delay(50);
    }

    const regionCount = Object.keys(regional).length;
    console.log(`  Fetched rates for ${fetchedCount} profile-region combinations across ${regionCount} regions`);
    console.log(`  us-south: ${Object.keys(usSouth.bareMetal).length} bare metal, ${Object.keys(usSouth.vsi).length} VSI`);
    if (Object.keys(usSouth.vsi).length > 0) {
      const sample = Object.entries(usSouth.vsi)[0];
      console.log(`  Sample VSI rate (us-south): ${sample[0]} = $${sample[1].hourlyRate}/hr ($${sample[1].monthlyRate}/mo)`);
    }
    if (Object.keys(usSouth.bareMetal).length > 0) {
      const sample = Object.entries(usSouth.bareMetal)[0];
      console.log(`  Sample BM rate (us-south): ${sample[0]} = $${sample[1].hourlyRate}/hr ($${sample[1].monthlyRate}/mo)`);
    }
  } catch (error) {
    console.warn('  Warning: Failed to fetch ROKS worker rates, continuing without them');
    console.warn('  Error:', error instanceof Error ? error.message : error);
  }

  return { usSouth, regional };
}

// Per-region ROKS pricing (OCP license + ODF)
interface RegionalROKSRates {
  ocpLicense?: { perVCPUHourly: number; perVCPUMonthly: number };
  odf?: {
    advanced?: { bareMetalPerNodeMonthly: number; vsiPerVCPUHourly: number };
    essentials?: { bareMetalPerNodeMonthly: number; vsiPerVCPUHourly: number };
  };
}

// Fetch ROKS pricing (OCP license + ODF) from Global Catalog
// NOTE: ACM (Red Hat Advanced Cluster Management) pricing is NOT in Global Catalog.
// ACM rates are manually maintained in ibmCloudConfig.json under roks.acm.
// Current rates derived from CDW reseller pricing (~$0.0298/vCPU-hr premium).
async function fetchROKSPricing(): Promise<{
  usSouth: ROKSPricingRates;
  regional: Record<string, RegionalROKSRates>;
} | null> {
  console.log('');
  console.log('--- ROKS Pricing (OCP License + ODF) ---');

  const result: ROKSPricingRates = {
    ocpLicense: {
      perVCPUHourly: 0.04275,
      perVCPUMonthly: 31.21,
      description: 'OpenShift Container Platform license per vCPU-hour',
    },
    odf: {
      advanced: {
        bareMetalPerNodeMonthly: 681.818,
        vsiPerVCPUHourly: 0.00725,
        description: 'ODF Advanced',
      },
      essentials: {
        bareMetalPerNodeMonthly: 545.455,
        vsiPerVCPUHourly: 0.00575,
        description: 'ODF Essentials',
      },
    },
    clusterManagement: {
      perClusterMonthly: 0,
      description: 'ROKS cluster management fee (included)',
    },
  };

  const regional: Record<string, RegionalROKSRates> = {};

  try {
    // Fetch OCP license rate from containers-kubernetes ROKS plan
    console.log('  Fetching OCP license rate (all regions)...');
    const roksSearch = await searchCatalogWithMetadata('containers-kubernetes', 50);
    const roksPlans = roksSearch.resources.filter(
      r => r.active && !r.disabled && r.kind === 'plan' && r.name?.includes('roks')
    );

    for (const plan of roksPlans) {
      const deployments = await fetchPlanPricingDeployments(plan.id);

      for (const deployment of deployments) {
        const region = deployment.deployment_location || deployment.deployment_region || '';
        if (!region || !deployment.metrics) continue;

        for (const metric of deployment.metrics) {
          const usdAmount = metric.amounts?.find(a => a.country === 'USA' && a.currency === 'USD');
          const price = usdAmount?.prices?.find(p => p.quantity_tier === 1)?.price
            ?? usdAmount?.prices?.[0]?.price;
          if (!price || price === 0) continue;

          const qty = metric.charge_unit_quantity || 1;
          const perUnit = price / qty;

          // OCP license per vCPU-hour
          if (metric.metric_id?.includes('ocp') && metric.metric_id?.includes('vcpu')) {
            const hourly = Math.round(perUnit * 100000) / 100000;
            const monthly = Math.round(perUnit * HOURS_PER_MONTH * 100) / 100;

            if (region === DEFAULT_REGION) {
              result.ocpLicense.perVCPUHourly = hourly;
              result.ocpLicense.perVCPUMonthly = monthly;
              console.log(`    OCP license (us-south): $${hourly}/vCPU-hr ($${monthly}/vCPU/mo)`);
            }

            if (!regional[region]) regional[region] = {};
            regional[region].ocpLicense = { perVCPUHourly: hourly, perVCPUMonthly: monthly };
          }
        }
      }
      await delay(50);
    }

    // Fetch ODF pricing
    console.log('  Fetching ODF pricing (all regions)...');
    const odfSearch = await searchCatalogWithMetadata('roks odf', 50);
    const odfPlans = odfSearch.resources.filter(
      r => r.active && !r.disabled && r.kind === 'plan' && r.name?.includes('odf')
    );

    for (const plan of odfPlans) {
      const isAdvanced = plan.name?.includes('advanced');
      const isEssentials = plan.name?.includes('essentials');
      if (!isAdvanced && !isEssentials) continue;

      const tier = isAdvanced ? 'advanced' : 'essentials';
      const deployments = await fetchPlanPricingDeployments(plan.id);

      for (const deployment of deployments) {
        const region = deployment.deployment_location || deployment.deployment_region || '';
        if (!region || !deployment.metrics) continue;

        for (const metric of deployment.metrics) {
          const usdAmount = metric.amounts?.find(a => a.country === 'USA' && a.currency === 'USD');
          const price = usdAmount?.prices?.find(p => p.quantity_tier === 1)?.price
            ?? usdAmount?.prices?.[0]?.price;
          if (!price || price === 0) continue;

          const qty = metric.charge_unit_quantity || 1;
          const perUnit = price / qty;

          // Bare metal per-node monthly
          if (metric.metric_id?.includes('bm') || metric.charge_unit_name?.includes('BARE_METAL')) {
            const val = Math.round(perUnit * 1000) / 1000;
            if (region === DEFAULT_REGION) {
              result.odf[tier].bareMetalPerNodeMonthly = val;
              console.log(`    ODF ${tier} bare metal (us-south): $${val}/node/mo`);
            }
            if (!regional[region]) regional[region] = {};
            if (!regional[region].odf) regional[region].odf = {};
            if (!regional[region].odf![tier]) {
              regional[region].odf![tier] = { bareMetalPerNodeMonthly: 0, vsiPerVCPUHourly: 0 };
            }
            regional[region].odf![tier]!.bareMetalPerNodeMonthly = val;
          }
          // VSI per-vCPU-hour
          else if (metric.metric_id?.includes('vcpu') || metric.charge_unit_name?.includes('VCPU')) {
            const val = Math.round(perUnit * 100000) / 100000;
            if (region === DEFAULT_REGION) {
              result.odf[tier].vsiPerVCPUHourly = val;
              console.log(`    ODF ${tier} VSI (us-south): $${val}/vCPU-hr`);
            }
            if (!regional[region]) regional[region] = {};
            if (!regional[region].odf) regional[region].odf = {};
            if (!regional[region].odf![tier]) {
              regional[region].odf![tier] = { bareMetalPerNodeMonthly: 0, vsiPerVCPUHourly: 0 };
            }
            regional[region].odf![tier]!.vsiPerVCPUHourly = val;
          }
        }
      }
      await delay(50);
    }

    const regionCount = Object.keys(regional).length;
    console.log(`  ROKS pricing fetch complete (${regionCount} regions)`);
    return { usSouth: result, regional };
  } catch (error) {
    console.warn('  Warning: Failed to fetch ROKS pricing from catalog, using defaults');
    console.warn('  Error:', error instanceof Error ? error.message : error);
    return { usSouth: result, regional };
  }
}

// Config type for pricing updates
interface IBMCloudConfig {
  vsiPricing?: Record<string, { hourlyRate: number; monthlyRate: number }>;
  bareMetalPricing?: Record<string, { hourlyRate: number; monthlyRate: number }>;
  vsiProfiles?: Record<string, Array<{ name: string; hourlyRate?: number; monthlyRate?: number }>>;
  bareMetalProfiles?: Record<string, Array<{ name: string; hourlyRate?: number; monthlyRate?: number }>>;
  roks?: ROKSPricingRates;
  regions?: Record<string, { name: string; code: string; multiplier?: number; availabilityZones: number }>;
  regionalPricing?: Record<string, unknown>;
  version?: string;
  [key: string]: unknown;
}

// Update the config with new pricing
function updateConfigWithPricing(
  existingConfig: IBMCloudConfig,
  vsiPricing: Map<string, { hourlyRate: number; monthlyRate: number }>,
  bareMetalPricing: Map<string, { hourlyRate: number; monthlyRate: number }>,
  vsiRegionalPricing: Map<string, Record<string, { hourlyRate: number; monthlyRate: number }>>,
  bmRegionalPricing: Map<string, Record<string, { hourlyRate: number; monthlyRate: number }>>,
  roksRegionalRates: Record<string, RegionalROKSRates>,
  roksWorkerRegional: Record<string, RegionalROKSWorkerRates>
): IBMCloudConfig {
  const newConfig = { ...existingConfig };

  // Update VSI pricing section (us-south backward compat)
  const newVsiPricing: Record<string, { hourlyRate: number; monthlyRate: number }> = {};
  if (existingConfig.vsiPricing) {
    Object.assign(newVsiPricing, existingConfig.vsiPricing);
  }
  for (const [name, pricing] of vsiPricing) {
    newVsiPricing[name] = pricing;
  }
  newConfig.vsiPricing = newVsiPricing;

  // Update bare metal pricing section (us-south backward compat)
  const newBareMetalPricing: Record<string, { hourlyRate: number; monthlyRate: number }> = {};
  if (existingConfig.bareMetalPricing) {
    Object.assign(newBareMetalPricing, existingConfig.bareMetalPricing);
  }
  for (const [name, pricing] of bareMetalPricing) {
    newBareMetalPricing[name] = pricing;
  }
  newConfig.bareMetalPricing = newBareMetalPricing;

  // Also update pricing in vsiProfiles array if present
  if (newConfig.vsiProfiles) {
    for (const family of Object.keys(newConfig.vsiProfiles)) {
      for (const profile of newConfig.vsiProfiles[family]) {
        const pricing = vsiPricing.get(profile.name);
        if (pricing) {
          profile.hourlyRate = pricing.hourlyRate;
          profile.monthlyRate = pricing.monthlyRate;
        }
      }
    }
  }

  // Also update pricing in bareMetalProfiles array if present
  if (newConfig.bareMetalProfiles) {
    for (const family of Object.keys(newConfig.bareMetalProfiles)) {
      for (const profile of newConfig.bareMetalProfiles[family]) {
        const pricing = bareMetalPricing.get(profile.name);
        if (pricing) {
          profile.hourlyRate = pricing.hourlyRate;
          profile.monthlyRate = pricing.monthlyRate;
        }
      }
    }
  }

  // Remove multiplier from regions
  if (newConfig.regions) {
    for (const regionKey of Object.keys(newConfig.regions)) {
      const region = newConfig.regions[regionKey];
      delete region.multiplier;
    }
  }

  // Build regionalPricing section
  // Collect all regions from VSI, BM, ROKS data
  const allRegions = new Set<string>();
  for (const regionMap of vsiRegionalPricing.values()) {
    for (const region of Object.keys(regionMap)) allRegions.add(region);
  }
  for (const regionMap of bmRegionalPricing.values()) {
    for (const region of Object.keys(regionMap)) allRegions.add(region);
  }
  for (const region of Object.keys(roksRegionalRates)) allRegions.add(region);
  for (const region of Object.keys(roksWorkerRegional)) allRegions.add(region);

  // Get existing block storage and networking rates from config to use as static values for all regions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingBlockStorage = (existingConfig as any).blockStorage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingNetworking = (existingConfig as any).networking;

  const regionalPricingData: Record<string, Record<string, unknown>> = {};

  for (const region of allRegions) {
    const regionData: Record<string, unknown> = {};

    // VSI rates for this region
    const vsiRates: Record<string, { hourlyRate: number; monthlyRate: number }> = {};
    for (const [profile, regionMap] of vsiRegionalPricing) {
      if (regionMap[region]) {
        vsiRates[profile] = regionMap[region];
      }
    }
    if (Object.keys(vsiRates).length > 0) {
      regionData.vsi = vsiRates;
    }

    // Bare metal rates for this region
    const bmRates: Record<string, { hourlyRate: number; monthlyRate: number }> = {};
    for (const [profile, regionMap] of bmRegionalPricing) {
      if (regionMap[region]) {
        bmRates[profile] = regionMap[region];
      }
    }
    if (Object.keys(bmRates).length > 0) {
      regionData.bareMetal = bmRates;
    }

    // Block storage rates (static — same for all regions for now)
    // Normalize keys to camelCase to match RegionalPricingData convention
    if (existingBlockStorage) {
      const normalized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(existingBlockStorage)) {
        const camelKey = key === 'general-purpose' ? 'generalPurpose' : key;
        normalized[camelKey] = value;
      }
      regionData.blockStorage = normalized;
    }

    // Networking rates (static — same for all regions for now)
    if (existingNetworking) {
      regionData.networking = existingNetworking;
    }

    // ROKS rates for this region
    const roksRates = roksRegionalRates[region];
    if (roksRates) {
      regionData.roks = roksRates;
    }

    // ROKS worker rates for this region — nest under roks.workerRates
    const workerRates = roksWorkerRegional[region];
    if (workerRates && (Object.keys(workerRates.bareMetal).length > 0 || Object.keys(workerRates.vsi).length > 0)) {
      if (!regionData.roks) {
        regionData.roks = {};
      }
      (regionData.roks as Record<string, unknown>).workerRates = workerRates;
    }

    if (Object.keys(regionData).length > 0) {
      regionalPricingData[region] = regionData;
    }
  }

  newConfig.regionalPricing = regionalPricingData;

  // Update version
  newConfig.version = new Date().toISOString().split('T')[0];

  return newConfig;
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('IBM Cloud Pricing Update Script (unauthenticated)');
  console.log('='.repeat(60));
  console.log('');

  // Load existing config
  console.log('Loading existing configuration...');
  let existingConfig: IBMCloudConfig = {};
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    existingConfig = JSON.parse(content) as IBMCloudConfig;
    console.log(`  Loaded ${CONFIG_PATH}`);
  } catch {
    console.error('  Error: Could not load existing config');
    console.error('  Run "npm run update-profiles" first to create the config file');
    process.exit(1);
  }

  try {
    // Collect profile names from config
    const vsiProfileNames = Object.values(existingConfig.vsiProfiles || {})
      .flat()
      .map(p => p.name);
    const bmProfileNames = Object.values(existingConfig.bareMetalProfiles || {})
      .flat()
      .map(p => p.name);

    console.log(`  Config has ${vsiProfileNames.length} VSI profiles and ${bmProfileNames.length} Bare Metal profiles`);

    // Fetch pricing
    console.log('');
    console.log('Step 1: Fetching pricing from Global Catalog (unauthenticated — list prices)');

    const vsiResult = await fetchVSIPricing(vsiProfileNames);
    const bareMetalResult = await fetchBareMetalPricing(bmProfileNames);
    const roksResult = await fetchROKSPricing();
    const roksWorkerResult = await fetchROKSWorkerRates();

    // Update config
    console.log('');
    console.log('Step 2: Updating configuration');

    const newConfig = updateConfigWithPricing(
      existingConfig,
      vsiResult.pricing,
      bareMetalResult.pricing,
      vsiResult.regionalPricing,
      bareMetalResult.regionalPricing,
      roksResult?.regional || {},
      roksWorkerResult.regional
    );

    // Update ROKS pricing section (us-south backward compat)
    if (roksResult) {
      const roksPricing = roksResult.usSouth;
      // Attach per-profile worker rates if any were found (us-south)
      if (Object.keys(roksWorkerResult.usSouth.bareMetal).length > 0 || Object.keys(roksWorkerResult.usSouth.vsi).length > 0) {
        roksPricing.workerRates = roksWorkerResult.usSouth;
      }
      newConfig.roks = roksPricing;
    }

    // Write new config
    console.log('');
    console.log('Step 3: Writing updated configuration');

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2) + '\n');
    console.log(`  Written to ${CONFIG_PATH}`);

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Update complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Summary:');
    console.log(`  - VSI profiles in config: ${vsiProfileNames.length}`);
    console.log(`  - VSI profiles with us-south pricing: ${vsiResult.pricing.size}`);
    console.log(`  - VSI profiles with regional pricing: ${vsiResult.regionalPricing.size}`);
    console.log(`  - Bare Metal profiles in config: ${bmProfileNames.length}`);
    console.log(`  - Bare Metal profiles with us-south pricing: ${bareMetalResult.pricing.size}`);
    console.log(`  - Bare Metal profiles with regional pricing: ${bareMetalResult.regionalPricing.size}`);
    console.log(`  - Regional pricing: ${Object.keys(newConfig.regionalPricing || {}).length} regions`);
    console.log(`  - Config version: ${newConfig.version}`);

    // Report missing profiles
    const missingVsi = vsiProfileNames.filter(n => !vsiResult.pricing.has(n));
    const missingBm = bmProfileNames.filter(n => !bareMetalResult.pricing.has(n));

    if (missingVsi.length > 0) {
      console.log('');
      console.log(`  VSI profiles still missing pricing (${missingVsi.length}):`);
      for (const name of missingVsi) {
        console.log(`    - ${name}`);
      }
    }

    if (missingBm.length > 0) {
      console.log('');
      console.log(`  Bare Metal profiles still missing pricing (${missingBm.length}):`);
      for (const name of missingBm) {
        console.log(`    - ${name}`);
      }
    }

    if (missingVsi.length === 0 && missingBm.length === 0) {
      console.log('');
      console.log('  All profiles have pricing!');
    }

    console.log('');
    console.log('Note: Pricing uses unauthenticated list prices for all regions.');
    console.log('      us-south rates in top-level vsiPricing/bareMetalPricing for backward compatibility.');
    console.log('      Per-region rates in regionalPricing section.');

  } catch (error) {
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
