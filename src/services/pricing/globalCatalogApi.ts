// IBM Cloud Global Catalog API client for fetching pricing data

// ===== TYPES =====

export interface GlobalCatalogConfig {
  apiKey?: string;
  timeout?: number;
}

export interface CatalogResource {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  disabled: boolean;
  geo_tags?: string[];
  pricing_tags?: string[];
  metadata?: {
    ui?: {
      strings?: {
        en?: {
          display_name?: string;
          description?: string;
        };
      };
    };
    service?: {
      id?: string;
      type?: string;
    };
    pricing?: {
      type?: string;
      origin?: string;
      starting_price?: Record<string, unknown>;
      metrics?: PricingMetric[];
    };
  };
}

export interface PricingMetric {
  metric_id: string;
  tier_model?: string;
  resource_display_name?: string;
  charge_unit_display_name?: string;
  charge_unit_name?: string;
  charge_unit?: string;
  amounts?: PricingAmount[];
}

export interface PricingAmount {
  country: string;
  currency: string;
  prices: PriceTier[];
}

export interface PriceTier {
  quantity_tier: number;
  price: number;
}

export interface CatalogResponse {
  offset: number;
  limit: number;
  count: number;
  resource_count: number;
  resources: CatalogResource[];
}

export interface PricingDeployment {
  deployment_id: string;
  deployment_location: string;
  deployment_location_display_name: string;
  metrics: PricingMetric[];
}

export interface PricingResponse {
  deployment_id?: string;
  metrics?: PricingMetric[];
  origin?: string;
  type?: string;
}

// ===== CONSTANTS =====

// Use proxy in development to avoid CORS, direct URL in production
const GLOBAL_CATALOG_BASE_URL = import.meta.env.DEV
  ? '/api/globalcatalog'  // Proxied through Vite dev server
  : 'https://globalcatalog.cloud.ibm.com/api/v1';

const DEFAULT_TIMEOUT = 30000; // 30 seconds

// API key from environment variable
const ENV_API_KEY = import.meta.env.VITE_IBM_CLOUD_API_KEY as string | undefined;

// IAM token endpoint (also needs proxy in dev)
const IAM_TOKEN_URL = import.meta.env.DEV
  ? '/api/iam/token'
  : 'https://iam.cloud.ibm.com/identity/token';

// Cache for IAM token
let cachedIamToken: { token: string; expiry: number } | null = null;

// ===== API FUNCTIONS =====

/**
 * Get IAM access token from API key
 */
async function getIamToken(apiKey: string): Promise<string> {
  // Check if we have a valid cached token (with 5 min buffer)
  if (cachedIamToken && cachedIamToken.expiry > Date.now() + 300000) {
    console.log('[Pricing API] Using cached IAM token');
    return cachedIamToken.token;
  }

  console.log('[Pricing API] Fetching new IAM token...');

  const response = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
  });

  if (!response.ok) {
    console.error('[Pricing API] IAM token request failed:', response.status);
    throw new Error(`IAM authentication failed: ${response.status}`);
  }

  const data = await response.json();

  // Cache the token
  cachedIamToken = {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in * 1000),
  };

  console.log('[Pricing API] IAM token obtained successfully');
  return data.access_token;
}

/**
 * Build headers for API request
 */
async function buildHeaders(config?: GlobalCatalogConfig): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // Use API key from config or environment
  const apiKey = config?.apiKey || ENV_API_KEY;

  if (apiKey) {
    try {
      const token = await getIamToken(apiKey);
      headers['Authorization'] = `Bearer ${token}`;
      console.log('[Pricing API] Using authenticated request');
    } catch (error) {
      console.warn('[Pricing API] Failed to get IAM token, continuing without auth:', error);
    }
  } else {
    console.log('[Pricing API] No API key configured, using unauthenticated request');
  }

  return headers;
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Search the Global Catalog
 */
export async function searchCatalog(
  query: string,
  config?: GlobalCatalogConfig
): Promise<CatalogResponse> {
  const params = new URLSearchParams({
    q: query,
    include: 'metadata.pricing',
    _limit: '200',
  });

  const url = `${GLOBAL_CATALOG_BASE_URL}?${params.toString()}`;
  const timeout = config?.timeout || DEFAULT_TIMEOUT;

  console.log('[Pricing API] Searching catalog:', { query, url });

  try {
    const headers = await buildHeaders(config);
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers,
      },
      timeout
    );

    if (!response.ok) {
      console.error('[Pricing API] HTTP error:', response.status, response.statusText);
      throw new Error(`Global Catalog API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Pricing API] Search successful:', { query, resourceCount: data.resource_count });
    return data;
  } catch (error) {
    // Detect CORS errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('[Pricing API] CORS or network error - API may be blocked by browser security policy');
      console.info('[Pricing API] To fix CORS issues, you may need to:');
      console.info('  1. Use a proxy server');
      console.info('  2. Run from a server that allows CORS');
      console.info('  3. Use a browser extension for development');
    }
    throw error;
  }
}

/**
 * Get pricing for a specific catalog entry
 */
export async function getPricing(
  id: string,
  config?: GlobalCatalogConfig
): Promise<PricingResponse> {
  const url = `${GLOBAL_CATALOG_BASE_URL}/${encodeURIComponent(id)}/pricing`;
  const timeout = config?.timeout || DEFAULT_TIMEOUT;

  const headers = await buildHeaders(config);
  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers,
    },
    timeout
  );

  if (!response.ok) {
    throw new Error(`Pricing API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch VSI profiles from Global Catalog
 */
export async function fetchVSIProfiles(config?: GlobalCatalogConfig): Promise<CatalogResource[]> {
  // Search for VPC VSI instance profiles
  const response = await searchCatalog('is.instance', config);

  // Filter for active VSI profiles (kind is 'instance.profile')
  return response.resources.filter(
    (r) => r.active && !r.disabled && r.kind === 'instance.profile'
  );
}

/**
 * Fetch block storage profiles from Global Catalog
 */
export async function fetchBlockStorageProfiles(config?: GlobalCatalogConfig): Promise<CatalogResource[]> {
  // Search for VPC block storage volume profiles
  const response = await searchCatalog('is.volume', config);

  // Filter for volume profiles
  return response.resources.filter(
    (r) => r.active && !r.disabled && r.kind === 'volume.profile'
  );
}

/**
 * Fetch bare metal profiles from Global Catalog
 */
export async function fetchBareMetalProfiles(config?: GlobalCatalogConfig): Promise<CatalogResource[]> {
  // Search for bare metal server profiles
  const response = await searchCatalog('is.bare-metal-server', config);

  // Filter for bare metal profiles
  return response.resources.filter(
    (r) => r.active && !r.disabled && r.kind === 'bare_metal_server.profile'
  );
}

/**
 * Fetch all pricing data from Global Catalog
 */
export async function fetchAllCatalogPricing(
  config?: GlobalCatalogConfig
): Promise<{
  vsi: CatalogResource[];
  bareMetal: CatalogResource[];
  blockStorage: CatalogResource[];
}> {
  console.log('[Pricing API] Fetching all catalog pricing data...');

  // Fetch all resource types in parallel
  const [vsi, bareMetal, blockStorage] = await Promise.all([
    fetchVSIProfiles(config).catch((err) => {
      console.warn('[Pricing API] Failed to fetch VSI profiles:', err.message);
      return [];
    }),
    fetchBareMetalProfiles(config).catch((err) => {
      console.warn('[Pricing API] Failed to fetch Bare Metal profiles:', err.message);
      return [];
    }),
    fetchBlockStorageProfiles(config).catch((err) => {
      console.warn('[Pricing API] Failed to fetch Block Storage profiles:', err.message);
      return [];
    }),
  ]);

  console.log('[Pricing API] Fetch complete:', {
    vsiProfiles: vsi.length,
    bareMetalProfiles: bareMetal.length,
    blockStorageProfiles: blockStorage.length,
  });

  return { vsi, bareMetal, blockStorage };
}

/**
 * Test API connectivity
 */
export async function testApiConnection(config?: GlobalCatalogConfig): Promise<boolean> {
  console.log('[Pricing API] Testing API connectivity...');
  try {
    const response = await searchCatalog('is.instance', { ...config, timeout: 10000 });
    const isAvailable = response.resource_count > 0;
    console.log('[Pricing API] Connection test result:', isAvailable ? 'SUCCESS' : 'NO DATA');
    return isAvailable;
  } catch (error) {
    console.error('[Pricing API] Connection test FAILED:', error instanceof Error ? error.message : error);
    return false;
  }
}
