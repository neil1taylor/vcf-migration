/**
 * IBM Code Engine - Pricing Proxy
 *
 * This service fetches pricing from the IBM Cloud Global Catalog API
 * (unauthenticated, list prices) and caches results to reduce API calls.
 *
 * No API key is required — Global Catalog list prices are publicly accessible.
 *
 * Environment Variables:
 *   - PORT: Server port (default: 8080)
 *
 * Query Parameters:
 *   - refresh: Set to "true" to bypass cache and fetch fresh data
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
const GLOBAL_CATALOG_BASE = 'https://globalcatalog.cloud.ibm.com/api/v1';
const HOURS_PER_MONTH = 730;
const ALL_REGIONS = [
  'us-south', 'us-east', 'eu-gb', 'eu-de', 'eu-es',
  'jp-tok', 'jp-osa', 'au-syd', 'ca-tor', 'br-sao',
];

// In-memory cache
let pricingCache = {
  data: null,
  lastUpdated: 0,
};

// CORS — restrict to configured origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and health checks
    if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

// Rate limiting (simple in-memory)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // requests per window
const rateLimitMap = new Map(); // ip -> { count, windowStart }

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
  }

  entry.count++;
  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart),
    });
  }

  next();
}

// Health check endpoint (required for Code Engine)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
  res.status(200).json({ status: 'ready' });
});

/**
 * Fetch from Global Catalog (unauthenticated)
 */
async function fetchFromCatalog(endpoint) {
  const response = await fetch(`${GLOBAL_CATALOG_BASE}${endpoint}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Catalog request failed: ${response.status} ${endpoint}`);
  }

  return response.json();
}

/**
 * Fetch plan pricing deployments with pagination
 */
async function fetchPlanDeployments(planId) {
  const allEntries = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const url = `${GLOBAL_CATALOG_BASE}/${encodeURIComponent(planId)}/pricing/deployment?_offset=${offset}&_limit=${limit}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) break;

    const data = await response.json();
    allEntries.push(...(data.resources || []));
    if ((data.resources || []).length < limit) break;
    offset += limit;
  }

  return allEntries;
}

/**
 * Extract per-region pricing from plan deployments.
 * Returns Record<region, { rawEntries?, flatRate? }>
 *
 * Shared plans (gen2) have many deployment entries per region — one per profile
 * size/family. Each qty=1 entry's cpu-hours and ram-hours prices are TOTAL costs
 * for that specific profile, not per-unit rates. We store all raw entries so that
 * buildProfileRegionalPricing can match them to specific profiles by vCPU/memory.
 */
function extractAllRegionPricing(deployments) {
  const regionCollector = {};

  for (const deployment of deployments) {
    const region = deployment.deployment_location || deployment.deployment_region || '';
    if (!region || !deployment.metrics) continue;

    let cpuPrice = 0, memPrice = 0, cpuQty = 0;
    let flatHourlyRate = 0;

    for (const metric of deployment.metrics) {
      const usdAmount = (metric.amounts || []).find(a => a.country === 'USA' && a.currency === 'USD');
      const price = usdAmount?.prices?.find(p => p.quantity_tier === 1)?.price
        ?? usdAmount?.prices?.[0]?.price;
      if (!price || price === 0) continue;

      const qty = metric.charge_unit_quantity || 1;

      if (metric.metric_id === 'part-is.cpu-hours' || metric.charge_unit_name === 'VCPU_HOURS') {
        cpuPrice = price; cpuQty = qty;
      } else if (metric.metric_id === 'part-is.ram-hours' || metric.charge_unit_name === 'MEMORY_HOURS') {
        memPrice = price;
      } else if (metric.charge_unit_name === 'SECUREEXECUTION_VCPU_HOURS' || metric.metric_id === 'part-is.zvsi.SE-cpu-hours') {
        cpuPrice = price; cpuQty = qty;
      } else if (metric.charge_unit_name === 'SECUREEXECUTION_MEMORY_HOURS' || metric.metric_id === 'part-is.zvsi.SE-ram-hours') {
        memPrice = price;
      } else if (metric.charge_unit_name === 'INSTANCE_HOURS_MULTI_TENANT' ||
                 (metric.metric_id?.startsWith('part-is.instance-hours') && !metric.metric_id.includes('-dh-'))) {
        flatHourlyRate = price;
      } else if (metric.charge_unit_name === 'BARE_METAL_SERVER_HOURS') {
        flatHourlyRate = price;
      }
    }

    if (!regionCollector[region]) regionCollector[region] = { rawEntries: [], flatRate: null };

    // Only keep qty=1 entries (profile-specific totals, not base rate aggregates)
    if (cpuPrice > 0 && memPrice > 0 && cpuQty === 1) {
      regionCollector[region].rawEntries.push({ cpuPrice, memPrice });
    }
    if (flatHourlyRate > 0 && !regionCollector[region].flatRate) {
      regionCollector[region].flatRate = { hourlyRate: flatHourlyRate };
    }
  }

  const result = {};
  for (const [region, data] of Object.entries(regionCollector)) {
    const entry = {};
    if (data.rawEntries.length > 0) {
      entry.rawEntries = data.rawEntries;
    }
    if (data.flatRate) {
      entry.flatRate = data.flatRate;
    }
    if (entry.rawEntries || entry.flatRate) {
      result[region] = entry;
    }
  }

  return result;
}

/**
 * Extract profile measures (plan ID, vCPUs, memory) from catalog metadata
 */
function extractProfileMeasures(entry) {
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

  return { planId: deployment.plan, vcpus, memoryGB };
}

/**
 * Parse vCPUs and memory from profile name (e.g., "bx2-16x64" -> 16 vCPUs, 64 GB)
 */
function parseProfileName(name) {
  const match = name.match(/(\d+)x(\d+)(?:x\d+)?$/);
  if (!match) return null;
  return { vcpus: parseInt(match[1], 10), memoryGB: parseInt(match[2], 10) };
}

/**
 * Compute hourly rate for a profile given component rates and profile specs
 */
function computeHourlyRate(rates, vcpus, memoryGB) {
  return rates.cpuPerHour * vcpus + rates.memPerHour * memoryGB;
}

/**
 * Small delay helper to rate-limit catalog fetches
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Static rates (same for all regions)
const STATIC_BLOCK_STORAGE = {
  generalPurpose: { costPerGBMonth: 0.10 },
  '3iops': { costPerGBMonth: 0.08 },
  '5iops': { costPerGBMonth: 0.13 },
  '10iops': { costPerGBMonth: 0.25 },
};

const STATIC_NETWORKING = {
  loadBalancer: { perLBMonthly: 21.60, perGBProcessed: 0.008 },
  vpnGateway: { perGatewayMonthly: 99, perConnectionMonthly: 0.04 },
  publicGateway: { perGatewayMonthly: 5 },
  transitGateway: { perGatewayMonthly: 0, localConnectionMonthly: 50, globalConnectionMonthly: 100, perGBLocal: 0.02, perGBGlobal: 0.04 },
  floatingIP: { perIPMonthly: 5 },
};

const STATIC_ROKS = {
  ocpLicense: { perVCPUHourly: 0.04275, perVCPUMonthly: 31.21 },
  odf: {
    advanced: { bareMetalPerNodeMonthly: 681.818, vsiPerVCPUHourly: 0.00725 },
    essentials: { bareMetalPerNodeMonthly: 545.455, vsiPerVCPUHourly: 0.00575 },
  },
  clusterManagement: { perClusterMonthly: 0 },
};

/**
 * Fetch and aggregate all pricing data from Global Catalog (unauthenticated)
 */
async function fetchAllPricing() {
  console.log('Fetching pricing from Global Catalog (unauthenticated)...');

  // Step 1: Search for VSI profile entries
  console.log('  Step 1: Fetching VSI and bare metal profiles from catalog...');
  const [vsiSearch, bmSearch] = await Promise.all([
    fetchFromCatalog('?q=is.instance&include=metadata&_limit=200'),
    fetchFromCatalog('?q=is.bare-metal-server&include=metadata&_limit=200'),
  ]);

  const vsiProfiles = (vsiSearch.resources || []).filter(
    r => r.active && !r.disabled && r.kind === 'instance.profile'
  );
  const bmProfiles = (bmSearch.resources || []).filter(
    r => r.active && !r.disabled && r.kind === 'bare_metal_server.profile'
  );
  console.log(`    Found ${vsiProfiles.length} VSI profiles, ${bmProfiles.length} bare metal profiles`);

  // Step 2: Extract plan IDs from profile metadata
  console.log('  Step 2: Extracting plan metadata...');
  const vsiMeasuresMap = new Map(); // name -> { planId, vcpus, memoryGB }
  for (const entry of vsiProfiles) {
    const measures = extractProfileMeasures(entry);
    if (measures) {
      // If meters don't have vcpus/memory, parse from name
      if (measures.vcpus === 0 || measures.memoryGB === 0) {
        const parsed = parseProfileName(entry.name);
        if (parsed) {
          measures.vcpus = measures.vcpus || parsed.vcpus;
          measures.memoryGB = measures.memoryGB || parsed.memoryGB;
        }
      }
      vsiMeasuresMap.set(entry.name, measures);
    }
  }

  const bmMeasuresMap = new Map();
  for (const entry of bmProfiles) {
    const measures = extractProfileMeasures(entry);
    if (measures) {
      if (measures.vcpus === 0 || measures.memoryGB === 0) {
        const parsed = parseProfileName(entry.name);
        if (parsed) {
          measures.vcpus = measures.vcpus || parsed.vcpus;
          measures.memoryGB = measures.memoryGB || parsed.memoryGB;
        }
      }
      bmMeasuresMap.set(entry.name, measures);
    }
  }
  console.log(`    ${vsiMeasuresMap.size} VSI profiles with plan metadata, ${bmMeasuresMap.size} bare metal`);

  // Step 3: Collect unique plan IDs and fetch their pricing (all regions)
  console.log('  Step 3: Fetching plan pricing rates (all regions)...');
  const uniquePlanIds = new Set();
  for (const measures of vsiMeasuresMap.values()) uniquePlanIds.add(measures.planId);
  for (const measures of bmMeasuresMap.values()) uniquePlanIds.add(measures.planId);
  console.log(`    ${uniquePlanIds.size} unique plans to fetch pricing for`);

  // planId -> region -> { rates?, flatRate? }
  const planRegionalRatesMap = new Map();
  let plansFetched = 0;
  let plansWithPricing = 0;

  for (const planId of uniquePlanIds) {
    try {
      const deployments = await fetchPlanDeployments(planId);
      const allRegionRates = extractAllRegionPricing(deployments);
      if (Object.keys(allRegionRates).length > 0) {
        planRegionalRatesMap.set(planId, allRegionRates);
        plansWithPricing++;
      }
    } catch (err) {
      console.warn(`    Failed to fetch plan ${planId}: ${err.message}`);
    }
    plansFetched++;
    if (plansFetched % 20 === 0) {
      console.log(`    Fetched ${plansFetched}/${uniquePlanIds.size} plan prices...`);
    }
    await delay(50);
  }
  console.log(`    ${plansWithPricing} plans with valid pricing across regions`);

  // Step 4: Compute per-profile pricing for all regions
  console.log('  Step 4: Computing per-profile pricing (all regions)...');

  /**
   * Match raw deployment entries to profiles within a shared plan.
   *
   * In shared plans (gen2), each entry's cpuPrice is proportional to vCPUs
   * (same per-vCPU rate across all families). memPrice differs by family
   * because per-GB rates vary, but higher memGB always means higher memPrice.
   *
   * Algorithm:
   * 1. Derive per-vCPU rate from smallest cpuPrice / 2 (min VPC profile)
   * 2. Group entries and profiles by vCPU level
   * 3. Within each level, sort unique memPrices and memGBs ascending
   * 4. Match positionally: smallest memGB → smallest memPrice
   */
  function matchEntriesToProfiles(rawEntries, profiles, region, result) {
    if (rawEntries.length === 0 || profiles.length === 0) return;

    const minCpu = Math.min(...rawEntries.map(e => e.cpuPrice));
    const perVCPU = minCpu / 2; // Smallest VPC profile is 2 vCPUs

    const uniqueVCPUs = [...new Set(profiles.map(p => p.vcpus))].sort((a, b) => a - b);

    for (const vcpus of uniqueVCPUs) {
      const expectedCpu = perVCPU * vcpus;
      const entriesAtLevel = rawEntries.filter(e => Math.abs(e.cpuPrice - expectedCpu) < 0.002);
      const profilesAtLevel = profiles.filter(p => p.vcpus === vcpus);

      if (entriesAtLevel.length === 0 || profilesAtLevel.length === 0) continue;

      // Dedupe and sort memPrices ascending
      const uniqueMemPrices = [...new Set(entriesAtLevel.map(e =>
        Math.round(e.memPrice * 100000) / 100000
      ))].sort((a, b) => a - b);

      // Unique memGB values sorted ascending
      const uniqueMemGBs = [...new Set(profilesAtLevel.map(p => p.memoryGB))].sort((a, b) => a - b);

      // Positional mapping: smallest memGB → smallest memPrice
      const memGBtoPrice = {};
      for (let i = 0; i < Math.min(uniqueMemGBs.length, uniqueMemPrices.length); i++) {
        memGBtoPrice[uniqueMemGBs[i]] = uniqueMemPrices[i];
      }

      for (const profile of profilesAtLevel) {
        const memPrice = memGBtoPrice[profile.memoryGB];
        if (memPrice === undefined) continue;

        const hourlyRate = expectedCpu + memPrice;
        if (!result[profile.name]) result[profile.name] = {};
        result[profile.name][region] = {
          vcpus: profile.vcpus,
          memoryGiB: profile.memoryGB,
          hourlyRate: Math.round(hourlyRate * 10000) / 10000,
          monthlyRate: Math.round(hourlyRate * HOURS_PER_MONTH * 100) / 100,
        };
      }
    }
  }

  // Helper to build per-region rates for a set of profiles
  function buildProfileRegionalPricing(measuresMap) {
    // profileName -> region -> { hourlyRate, monthlyRate, vcpus, memoryGiB }
    const result = {};

    // Group profiles by planId for matching shared-plan entries
    const profilesByPlan = new Map();
    for (const [name, measures] of measuresMap) {
      if (!profilesByPlan.has(measures.planId)) {
        profilesByPlan.set(measures.planId, []);
      }
      profilesByPlan.get(measures.planId).push({ name, vcpus: measures.vcpus, memoryGB: measures.memoryGB });
    }

    for (const [planId, profiles] of profilesByPlan) {
      const regionRates = planRegionalRatesMap.get(planId);
      if (!regionRates) continue;

      for (const [region, rateData] of Object.entries(regionRates)) {
        if (rateData.flatRate) {
          // Flat-rate plan (gen3+, bare metal): one profile per plan per region
          for (const profile of profiles) {
            if (!result[profile.name]) result[profile.name] = {};
            result[profile.name][region] = {
              vcpus: profile.vcpus,
              memoryGiB: profile.memoryGB,
              hourlyRate: Math.round(rateData.flatRate.hourlyRate * 10000) / 10000,
              monthlyRate: Math.round(rateData.flatRate.hourlyRate * HOURS_PER_MONTH * 100) / 100,
            };
          }
        } else if (rateData.rawEntries && rateData.rawEntries.length > 0) {
          // Shared plan (gen2): match entries to profiles by vCPU/memory
          matchEntriesToProfiles(rateData.rawEntries, profiles, region, result);
        }
      }
    }

    return result;
  }

  const vsiRegionalPricing = buildProfileRegionalPricing(vsiMeasuresMap);
  const bmRegionalPricing = buildProfileRegionalPricing(bmMeasuresMap);

  console.log(`    ${Object.keys(vsiRegionalPricing).length} VSI profiles with pricing, ${Object.keys(bmRegionalPricing).length} bare metal`);

  // Step 5: Build regionalPricing section
  console.log('  Step 5: Building regional pricing structure...');
  const regionalPricing = {};

  for (const region of ALL_REGIONS) {
    const regionVsi = {};
    for (const [name, regionMap] of Object.entries(vsiRegionalPricing)) {
      if (regionMap[region]) {
        regionVsi[name] = regionMap[region];
      }
    }

    const regionBm = {};
    for (const [name, regionMap] of Object.entries(bmRegionalPricing)) {
      if (regionMap[region]) {
        regionBm[name] = regionMap[region];
      }
    }

    regionalPricing[region] = {
      vsi: regionVsi,
      bareMetal: regionBm,
      blockStorage: STATIC_BLOCK_STORAGE,
      networking: STATIC_NETWORKING,
      roks: STATIC_ROKS,
    };
  }

  // Step 6: Build backward-compat top-level pricing from us-south data
  console.log('  Step 6: Building backward-compatible top-level pricing...');
  const usSouthVsi = regionalPricing['us-south']?.vsi || {};
  const usSouthBm = regionalPricing['us-south']?.bareMetal || {};

  // Convert to the legacy format (without memoryGiB in top-level for VSI, with it for bareMetal)
  const topLevelVsi = {};
  for (const [name, data] of Object.entries(usSouthVsi)) {
    topLevelVsi[name] = {
      vcpus: data.vcpus,
      memoryGiB: data.memoryGiB,
      hourlyRate: data.hourlyRate,
    };
  }

  const topLevelBm = {};
  for (const [name, data] of Object.entries(usSouthBm)) {
    topLevelBm[name] = {
      vcpus: data.vcpus,
      memoryGiB: data.memoryGiB,
      monthlyRate: data.monthlyRate,
    };
  }

  const pricing = {
    version: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    source: 'ibm-code-engine-proxy',

    regions: {
      'us-south': { name: 'Dallas', availabilityZones: 3 },
      'us-east': { name: 'Washington DC', availabilityZones: 3 },
      'eu-gb': { name: 'London', availabilityZones: 3 },
      'eu-de': { name: 'Frankfurt', availabilityZones: 3 },
      'eu-es': { name: 'Madrid', availabilityZones: 3 },
      'jp-tok': { name: 'Tokyo', availabilityZones: 3 },
      'jp-osa': { name: 'Osaka', availabilityZones: 3 },
      'au-syd': { name: 'Sydney', availabilityZones: 3 },
      'ca-tor': { name: 'Toronto', availabilityZones: 3 },
      'br-sao': { name: 'São Paulo', availabilityZones: 3 },
    },

    discountOptions: {
      onDemand: { name: 'On-Demand', discountPct: 0 },
      oneYear: { name: '1-Year Reserved', discountPct: 20 },
      threeYear: { name: '3-Year Reserved', discountPct: 40 },
    },

    vsiProfiles: topLevelVsi,
    bareMetal: topLevelBm,

    blockStorage: {
      generalPurpose: { costPerGBMonth: 0.10, iopsPerGB: 3 },
      custom: { costPerGBMonth: 0.10, costPerIOPS: 0.07 },
      tiers: {
        '3iops': { costPerGBMonth: 0.08, iopsPerGB: 3 },
        '5iops': { costPerGBMonth: 0.13, iopsPerGB: 5 },
        '10iops': { costPerGBMonth: 0.25, iopsPerGB: 10 },
      },
    },

    roks: { clusterManagementFee: 0, workerNodeMarkup: 0 },
    odf: { perTBMonth: 60, minimumTB: 0.5 },

    networking: {
      loadBalancer: { perLBMonthly: 21.60, perGBProcessed: 0.008 },
      vpnGateway: { perGatewayMonthly: 99, perConnectionMonthly: 0.04 },
      publicGateway: { perGatewayMonthly: 5 },
      transitGateway: { perGatewayMonthly: 0, localConnectionMonthly: 50, globalConnectionMonthly: 100, perGBLocal: 0.02, perGBGlobal: 0.04 },
      floatingIP: { perIPMonthly: 5 },
    },

    regionalPricing,
  };

  console.log('  Done fetching pricing.');
  return pricing;
}

/**
 * Get default pricing data (used when catalog fetch fails)
 */
function getDefaultPricing() {
  // Build regionalPricing from hardcoded rates for all regions
  const defaultVsi = {
    'bx2-2x8': { vcpus: 2, memoryGiB: 8, hourlyRate: 0.099, monthlyRate: 72.27 },
    'bx2-4x16': { vcpus: 4, memoryGiB: 16, hourlyRate: 0.198, monthlyRate: 144.54 },
    'bx2-8x32': { vcpus: 8, memoryGiB: 32, hourlyRate: 0.396, monthlyRate: 289.08 },
    'bx2-16x64': { vcpus: 16, memoryGiB: 64, hourlyRate: 0.792, monthlyRate: 578.16 },
    'bx2-32x128': { vcpus: 32, memoryGiB: 128, hourlyRate: 1.584, monthlyRate: 1156.32 },
    'bx2-48x192': { vcpus: 48, memoryGiB: 192, hourlyRate: 2.376, monthlyRate: 1734.48 },
    'bx2-64x256': { vcpus: 64, memoryGiB: 256, hourlyRate: 3.168, monthlyRate: 2312.64 },
    'bx2-96x384': { vcpus: 96, memoryGiB: 384, hourlyRate: 4.752, monthlyRate: 3468.96 },
    'bx2-128x512': { vcpus: 128, memoryGiB: 512, hourlyRate: 6.336, monthlyRate: 4625.28 },
    'cx2-2x4': { vcpus: 2, memoryGiB: 4, hourlyRate: 0.083, monthlyRate: 60.59 },
    'cx2-4x8': { vcpus: 4, memoryGiB: 8, hourlyRate: 0.166, monthlyRate: 121.18 },
    'cx2-8x16': { vcpus: 8, memoryGiB: 16, hourlyRate: 0.332, monthlyRate: 242.36 },
    'cx2-16x32': { vcpus: 16, memoryGiB: 32, hourlyRate: 0.664, monthlyRate: 484.72 },
    'cx2-32x64': { vcpus: 32, memoryGiB: 64, hourlyRate: 1.328, monthlyRate: 969.44 },
    'cx2-48x96': { vcpus: 48, memoryGiB: 96, hourlyRate: 1.992, monthlyRate: 1454.16 },
    'cx2-64x128': { vcpus: 64, memoryGiB: 128, hourlyRate: 2.656, monthlyRate: 1938.88 },
    'cx2-96x192': { vcpus: 96, memoryGiB: 192, hourlyRate: 3.984, monthlyRate: 2908.32 },
    'cx2-128x256': { vcpus: 128, memoryGiB: 256, hourlyRate: 5.312, monthlyRate: 3877.76 },
    'mx2-2x16': { vcpus: 2, memoryGiB: 16, hourlyRate: 0.125, monthlyRate: 91.25 },
    'mx2-4x32': { vcpus: 4, memoryGiB: 32, hourlyRate: 0.25, monthlyRate: 182.50 },
    'mx2-8x64': { vcpus: 8, memoryGiB: 64, hourlyRate: 0.5, monthlyRate: 365.00 },
    'mx2-16x128': { vcpus: 16, memoryGiB: 128, hourlyRate: 1.0, monthlyRate: 730.00 },
    'mx2-32x256': { vcpus: 32, memoryGiB: 256, hourlyRate: 2.0, monthlyRate: 1460.00 },
    'mx2-48x384': { vcpus: 48, memoryGiB: 384, hourlyRate: 3.0, monthlyRate: 2190.00 },
    'mx2-64x512': { vcpus: 64, memoryGiB: 512, hourlyRate: 4.0, monthlyRate: 2920.00 },
    'mx2-96x768': { vcpus: 96, memoryGiB: 768, hourlyRate: 6.0, monthlyRate: 4380.00 },
    'mx2-128x1024': { vcpus: 128, memoryGiB: 1024, hourlyRate: 8.0, monthlyRate: 5840.00 },
  };

  const defaultBm = {
    'bx2d-metal-96x384': { vcpus: 96, memoryGiB: 384, hourlyRate: 3.904, monthlyRate: 2850 },
    'bx2d-metal-192x768': { vcpus: 192, memoryGiB: 768, hourlyRate: 7.808, monthlyRate: 5700 },
    'mx2d-metal-96x768': { vcpus: 96, memoryGiB: 768, hourlyRate: 4.685, monthlyRate: 3420 },
  };

  const regionalPricing = {};
  for (const region of ALL_REGIONS) {
    regionalPricing[region] = {
      vsi: defaultVsi,
      bareMetal: defaultBm,
      blockStorage: STATIC_BLOCK_STORAGE,
      networking: STATIC_NETWORKING,
      roks: STATIC_ROKS,
    };
  }

  // Top-level VSI (legacy format without monthlyRate)
  const topLevelVsi = {};
  for (const [name, data] of Object.entries(defaultVsi)) {
    topLevelVsi[name] = { vcpus: data.vcpus, memoryGiB: data.memoryGiB, hourlyRate: data.hourlyRate };
  }

  const topLevelBm = {};
  for (const [name, data] of Object.entries(defaultBm)) {
    topLevelBm[name] = { vcpus: data.vcpus, memoryGiB: data.memoryGiB, monthlyRate: data.monthlyRate };
  }

  return {
    version: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    source: 'ibm-code-engine-proxy-defaults',

    regions: {
      'us-south': { name: 'Dallas', availabilityZones: 3 },
      'us-east': { name: 'Washington DC', availabilityZones: 3 },
      'eu-gb': { name: 'London', availabilityZones: 3 },
      'eu-de': { name: 'Frankfurt', availabilityZones: 3 },
      'eu-es': { name: 'Madrid', availabilityZones: 3 },
      'jp-tok': { name: 'Tokyo', availabilityZones: 3 },
      'jp-osa': { name: 'Osaka', availabilityZones: 3 },
      'au-syd': { name: 'Sydney', availabilityZones: 3 },
      'ca-tor': { name: 'Toronto', availabilityZones: 3 },
      'br-sao': { name: 'São Paulo', availabilityZones: 3 },
    },

    discountOptions: {
      onDemand: { name: 'On-Demand', discountPct: 0 },
      oneYear: { name: '1-Year Reserved', discountPct: 20 },
      threeYear: { name: '3-Year Reserved', discountPct: 40 },
    },

    vsiProfiles: topLevelVsi,
    bareMetal: topLevelBm,

    blockStorage: {
      generalPurpose: { costPerGBMonth: 0.10, iopsPerGB: 3 },
      custom: { costPerGBMonth: 0.10, costPerIOPS: 0.07 },
      tiers: {
        '3iops': { costPerGBMonth: 0.08, iopsPerGB: 3 },
        '5iops': { costPerGBMonth: 0.13, iopsPerGB: 5 },
        '10iops': { costPerGBMonth: 0.25, iopsPerGB: 10 },
      },
    },

    roks: { clusterManagementFee: 0, workerNodeMarkup: 0 },
    odf: { perTBMonth: 60, minimumTB: 0.5 },

    networking: {
      loadBalancer: { perLBMonthly: 21.60, perGBProcessed: 0.008 },
      vpnGateway: { perGatewayMonthly: 99, perConnectionMonthly: 0.04 },
      publicGateway: { perGatewayMonthly: 5 },
      transitGateway: { perGatewayMonthly: 0, localConnectionMonthly: 50, globalConnectionMonthly: 100, perGBLocal: 0.02, perGBGlobal: 0.04 },
      floatingIP: { perIPMonthly: 5 },
    },

    regionalPricing,
  };
}

// Main pricing endpoint
app.get('/', rateLimit, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const now = Date.now();

    const cacheValid =
      pricingCache.lastUpdated && now - pricingCache.lastUpdated < CACHE_TTL_MS;

    if (cacheValid && !forceRefresh && pricingCache.data) {
      return res.json({
        ...pricingCache.data,
        cached: true,
        cacheAge: Math.round((now - pricingCache.lastUpdated) / 1000),
      });
    }

    let pricing;
    try {
      pricing = await fetchAllPricing();
    } catch (fetchError) {
      console.error('Catalog fetch failed, using defaults:', fetchError.message);
      pricing = getDefaultPricing();
    }

    pricingCache = { data: pricing, lastUpdated: now };
    return res.json({ ...pricing, cached: false });
  } catch (error) {
    console.error('Pricing proxy error:', error);

    // Return cached data if available, even if stale
    if (pricingCache.data) {
      return res.json({
        ...pricingCache.data,
        cached: true,
        stale: true,
        error: error.message,
      });
    }

    // Return default pricing as fallback
    return res.status(500).json({
      ...getDefaultPricing(),
      error: 'Failed to fetch pricing data',
      message: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Pricing proxy server listening on port ${PORT}`);
});
