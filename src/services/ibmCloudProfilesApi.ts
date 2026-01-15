// IBM Cloud API service for fetching VPC instance profiles and ROKS machine types
//
// VPC API: https://cloud.ibm.com/apidocs/vpc/latest#list-instance-profiles
// Kubernetes Service API: https://cloud.ibm.com/apidocs/kubernetes/containers-v1-v2

// ===== TYPES =====

export interface VPCInstanceProfile {
  name: string;
  family: string;
  vcpu_count: { type: string; value?: number; min?: number; max?: number };
  memory: { type: string; value?: number; min?: number; max?: number };
  bandwidth: { type: string; value?: number };
  os_architecture?: { type: string; values?: string[] };
  href: string;
}

export interface VPCProfilesResponse {
  profiles: VPCInstanceProfile[];
  first?: { href: string };
  limit: number;
  total_count: number;
}

export interface ROKSMachineType {
  name: string;
  cores: number;
  memory: number | string;  // MiB (number) or "384GB" (string) depending on API
  networkSpeed: number;
  serverType: string;
  trustedEnabled: boolean;
  deprecated: boolean;
  isolation: string;
  storage: {
    size: number;
    count: number;
    type: string;
  }[];
}

export interface ROKSMachineTypesResponse {
  machineTypes: ROKSMachineType[];
}

// VPC Bare Metal Server Profile types
export interface VPCBareMetalProfile {
  name: string;
  family: string;
  cpu_core_count: { type: string; value: number };
  cpu_socket_count: { type: string; value: number };
  memory: { type: string; value: number };
  bandwidth: { type: string; value: number };
  disks: Array<{
    quantity: { type: string; value: number };
    size: { type: string; value: number };
    supported_interface_types: { type: string; default: string; values: string[] };
  }>;
  href: string;
}

export interface VPCBareMetalProfilesResponse {
  profiles: VPCBareMetalProfile[];
  total_count: number;
}

export interface TransformedProfile {
  name: string;
  family: string;
  vcpus: number;
  memoryGiB: number;
  bandwidthGbps?: number;
  physicalCores?: number;
  hasNvme?: boolean;
  nvmeDisks?: number;
  nvmeSizeGiB?: number;
  totalNvmeGiB?: number;
}

// ===== CONSTANTS =====

const VPC_API_VERSION = '2024-11-12';
const DEFAULT_TIMEOUT = 30000;

// API key from environment variable
const ENV_API_KEY = import.meta.env.VITE_IBM_CLOUD_API_KEY as string | undefined;

// Regional VPC endpoints - use proxy in development to avoid CORS
const VPC_REGIONS: Record<string, string> = import.meta.env.DEV
  ? {
      'us-south': '/api/vpc/us-south',
      'us-east': '/api/vpc/us-east',
      'eu-de': '/api/vpc/eu-de',
      'eu-gb': '/api/vpc/eu-gb',
      'eu-es': '/api/vpc/eu-es',
      'jp-tok': '/api/vpc/jp-tok',
      'jp-osa': '/api/vpc/jp-osa',
      'au-syd': '/api/vpc/au-syd',
      'ca-tor': '/api/vpc/ca-tor',
      'br-sao': '/api/vpc/br-sao',
    }
  : {
      'us-south': 'https://us-south.iaas.cloud.ibm.com',
      'us-east': 'https://us-east.iaas.cloud.ibm.com',
      'eu-de': 'https://eu-de.iaas.cloud.ibm.com',
      'eu-gb': 'https://eu-gb.iaas.cloud.ibm.com',
      'eu-es': 'https://eu-es.iaas.cloud.ibm.com',
      'jp-tok': 'https://jp-tok.iaas.cloud.ibm.com',
      'jp-osa': 'https://jp-osa.iaas.cloud.ibm.com',
      'au-syd': 'https://au-syd.iaas.cloud.ibm.com',
      'ca-tor': 'https://ca-tor.iaas.cloud.ibm.com',
      'br-sao': 'https://br-sao.iaas.cloud.ibm.com',
    };

// Kubernetes Service API endpoint - use proxy in development
const KUBERNETES_API_URL = import.meta.env.DEV
  ? '/api/kubernetes'
  : 'https://containers.cloud.ibm.com/global/v2';

// IAM token endpoint
const IAM_TOKEN_URL = import.meta.env.DEV
  ? '/api/iam/token'
  : 'https://iam.cloud.ibm.com/identity/token';

// Cached IAM token
let cachedIamToken: { token: string; expiry: number } | null = null;

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  return !!ENV_API_KEY;
}

// ===== HELPER FUNCTIONS =====

async function getIamToken(apiKey: string): Promise<string> {
  // Check if we have a valid cached token (with 5 min buffer)
  if (cachedIamToken && cachedIamToken.expiry > Date.now() + 300000) {
    console.log('[IBM Cloud API] Using cached IAM token');
    return cachedIamToken.token;
  }

  console.log('[IBM Cloud API] Fetching new IAM token...');

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
    throw new Error(`IAM authentication failed: ${response.status}`);
  }

  const data = await response.json();

  cachedIamToken = {
    token: data.access_token,
    expiry: Date.now() + (data.expires_in * 1000),
  };

  return data.access_token;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = DEFAULT_TIMEOUT
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

// ===== VPC INSTANCE PROFILES API =====

/**
 * Fetch VPC instance profiles from the IBM Cloud VPC API
 *
 * API Endpoint: GET /v1/instance/profiles
 * Documentation: https://cloud.ibm.com/apidocs/vpc/latest#list-instance-profiles
 *
 * @param region - The IBM Cloud region (e.g., 'us-south')
 * @param apiKey - IBM Cloud API key for authentication
 */
export async function fetchVPCInstanceProfiles(
  region: string = 'us-south',
  apiKey?: string
): Promise<VPCProfilesResponse> {
  const baseUrl = VPC_REGIONS[region];
  if (!baseUrl) {
    throw new Error(`Unknown region: ${region}. Valid regions: ${Object.keys(VPC_REGIONS).join(', ')}`);
  }

  // Use provided API key or environment variable
  const effectiveApiKey = apiKey || ENV_API_KEY;

  if (!effectiveApiKey) {
    console.warn('[IBM Cloud API] No API key configured. Set VITE_IBM_CLOUD_API_KEY in .env file.');
    throw new Error('API key required. Set VITE_IBM_CLOUD_API_KEY environment variable.');
  }

  const url = `${baseUrl}/v1/instance/profiles?version=${VPC_API_VERSION}&generation=2`;

  console.log('[IBM Cloud API] Fetching VPC instance profiles:', { region, url });

  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  // Get IAM token for authentication
  try {
    const token = await getIamToken(effectiveApiKey);
    headers['Authorization'] = `Bearer ${token}`;
  } catch (authError) {
    console.error('[IBM Cloud API] Authentication failed:', authError);
    throw new Error('Authentication failed. Check your API key.');
  }

  const response = await fetchWithTimeout(url, { method: 'GET', headers });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[IBM Cloud API] VPC API error:', response.status, errorText);

    // Parse error for better messaging
    try {
      const errorData = JSON.parse(errorText);
      const errorCode = errorData.errors?.[0]?.code || '';
      const errorMsg = errorData.errors?.[0]?.message || '';
      if (errorCode === 'not_authorized' || response.status === 403) {
        throw new Error(`not_authorized: Service ID needs VPC Infrastructure Services Viewer role. ${errorMsg}`);
      }
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message.includes('not_authorized')) {
        throw parseErr;
      }
    }

    throw new Error(`VPC API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[IBM Cloud API] Fetched VPC profiles:', { count: data.total_count });

  return data;
}

/**
 * Transform VPC API profiles to our internal format
 */
export function transformVPCProfiles(profiles: VPCInstanceProfile[]): Record<string, TransformedProfile[]> {
  const grouped: Record<string, TransformedProfile[]> = {
    balanced: [],
    compute: [],
    memory: [],
    veryHighMemory: [],
    ultraHighMemory: [],
    gpu: [],
    other: [],
  };

  for (const profile of profiles) {
    const transformed: TransformedProfile = {
      name: profile.name,
      family: profile.family,
      vcpus: profile.vcpu_count.value || profile.vcpu_count.min || 0,
      memoryGiB: Math.round((profile.memory.value || profile.memory.min || 0) / 1024), // Convert MiB to GiB
      bandwidthGbps: profile.bandwidth?.value,
    };

    // Categorize by family/prefix
    const prefix = profile.name.split('-')[0];
    if (prefix.startsWith('bx') || prefix.startsWith('bz')) {
      grouped.balanced.push(transformed);
    } else if (prefix.startsWith('cx') || prefix.startsWith('cz')) {
      grouped.compute.push(transformed);
    } else if (prefix.startsWith('mx') || prefix.startsWith('mz')) {
      grouped.memory.push(transformed);
    } else if (prefix.startsWith('vx')) {
      grouped.veryHighMemory.push(transformed);
    } else if (prefix.startsWith('ux')) {
      grouped.ultraHighMemory.push(transformed);
    } else if (prefix.startsWith('gx') || prefix.startsWith('gp')) {
      grouped.gpu.push(transformed);
    } else {
      grouped.other.push(transformed);
    }
  }

  // Sort each group by vcpus
  for (const family of Object.keys(grouped)) {
    grouped[family].sort((a, b) => a.vcpus - b.vcpus);
  }

  return grouped;
}

// ===== VPC BARE METAL SERVER PROFILES API =====

/**
 * Fetch VPC Bare Metal Server profiles from the IBM Cloud VPC API
 *
 * API Endpoint: GET /v1/bare_metal_server/profiles
 * Documentation: https://cloud.ibm.com/apidocs/vpc/latest#list-bare-metal-server-profiles
 *
 * @param region - The IBM Cloud region (e.g., 'us-south')
 * @param apiKey - IBM Cloud API key for authentication
 */
export async function fetchVPCBareMetalProfiles(
  region: string = 'us-south',
  apiKey?: string
): Promise<VPCBareMetalProfilesResponse> {
  const baseUrl = VPC_REGIONS[region];
  if (!baseUrl) {
    throw new Error(`Unknown region: ${region}. Valid regions: ${Object.keys(VPC_REGIONS).join(', ')}`);
  }

  const effectiveApiKey = apiKey || ENV_API_KEY;

  if (!effectiveApiKey) {
    console.warn('[IBM Cloud API] No API key configured for Bare Metal API.');
    throw new Error('API key required. Set VITE_IBM_CLOUD_API_KEY environment variable.');
  }

  const url = `${baseUrl}/v1/bare_metal_server/profiles?version=${VPC_API_VERSION}&generation=2`;

  console.log('[IBM Cloud API] Fetching VPC bare metal profiles:', { region, url });

  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  try {
    const token = await getIamToken(effectiveApiKey);
    headers['Authorization'] = `Bearer ${token}`;
  } catch (authError) {
    console.error('[IBM Cloud API] Bare metal authentication failed:', authError);
    throw new Error('Authentication failed. Check your API key.');
  }

  const response = await fetchWithTimeout(url, { method: 'GET', headers });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[IBM Cloud API] Bare Metal API error:', response.status, errorText);

    try {
      const errorData = JSON.parse(errorText);
      const errorCode = errorData.errors?.[0]?.code || '';
      const errorMsg = errorData.errors?.[0]?.message || '';
      if (errorCode === 'not_authorized' || response.status === 403) {
        throw new Error(`not_authorized: Service ID needs VPC Infrastructure Services Viewer role. ${errorMsg}`);
      }
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message.includes('not_authorized')) {
        throw parseErr;
      }
    }

    throw new Error(`Bare Metal API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[IBM Cloud API] Fetched bare metal profiles:', { count: data.total_count });

  return data;
}

/**
 * Transform VPC Bare Metal profiles to our internal format
 */
export function transformVPCBareMetalProfiles(profiles: VPCBareMetalProfile[]): TransformedProfile[] {
  const result: TransformedProfile[] = [];

  for (const profile of profiles) {
    // Find NVMe storage disk (skip boot disks with size 480 or 960)
    const storageDisk = profile.disks.find(d =>
      (d.supported_interface_types.default === 'nvme' ||
       d.supported_interface_types.values?.includes('nvme')) &&
      d.size.value > 1000
    );

    const hasNvme = !!storageDisk;
    const nvmeDisks = storageDisk?.quantity.value || 0;
    const nvmeSizeGiB = storageDisk?.size.value || 0;

    const transformed: TransformedProfile = {
      name: profile.name,
      family: getFamilyFromName(profile.name),
      vcpus: profile.cpu_core_count.value * 2, // Hyperthreading
      memoryGiB: profile.memory.value,
      physicalCores: profile.cpu_core_count.value,
      bandwidthGbps: profile.bandwidth?.value ? profile.bandwidth.value / 1000 : undefined,
      hasNvme,
      nvmeDisks: hasNvme ? nvmeDisks : undefined,
      nvmeSizeGiB: hasNvme ? nvmeSizeGiB : undefined,
      totalNvmeGiB: hasNvme ? nvmeDisks * nvmeSizeGiB : undefined,
    };

    result.push(transformed);
  }

  // Sort by vcpus
  return result.sort((a, b) => a.vcpus - b.vcpus);
}

// ===== KUBERNETES SERVICE FLAVORS API =====

/**
 * Fetch ROKS/Kubernetes flavors from the IBM Cloud Kubernetes Service API
 *
 * CLI Equivalent: ibmcloud ks flavors --zone <zone> --provider vpc-gen2
 * API Endpoint: GET /global/v2/getFlavors
 * Documentation: https://cloud.ibm.com/apidocs/kubernetes/containers-v1-v2
 *
 * @param zone - The availability zone (e.g., 'us-south-1')
 * @param provider - The provider type ('vpc-gen2' for VPC)
 * @param apiKey - IBM Cloud API key for authentication
 */
export async function fetchROKSMachineTypes(
  zone: string,
  provider: string = 'vpc-gen2',
  apiKey?: string
): Promise<ROKSMachineTypesResponse> {
  // Use provided API key or environment variable
  const effectiveApiKey = apiKey || ENV_API_KEY;

  if (!effectiveApiKey) {
    console.warn('[IBM Cloud API] No API key configured for ROKS API.');
    throw new Error('API key required. Set VITE_IBM_CLOUD_API_KEY environment variable.');
  }

  // Use getFlavors endpoint instead of getMachineTypes
  const url = `${KUBERNETES_API_URL}/getFlavors?zone=${encodeURIComponent(zone)}&provider=${encodeURIComponent(provider)}`;

  console.log('[IBM Cloud API] Fetching ROKS flavors:', { zone, provider, url });

  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  // Get IAM token for authentication
  try {
    const token = await getIamToken(effectiveApiKey);
    headers['Authorization'] = `Bearer ${token}`;
  } catch (authError) {
    console.error('[IBM Cloud API] ROKS authentication failed:', authError);
    throw new Error('Authentication failed. Check your API key.');
  }

  const response = await fetchWithTimeout(url, { method: 'GET', headers });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[IBM Cloud API] ROKS API error:', response.status, errorText);
    throw new Error(`Kubernetes Service API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // getFlavors returns an array directly, wrap it for compatibility
  const result: ROKSMachineTypesResponse = {
    machineTypes: Array.isArray(data) ? data : (data.machineTypes || []),
  };

  console.log('[IBM Cloud API] Fetched ROKS flavors:', { count: result.machineTypes.length });

  return result;
}

/**
 * Parse memory value from ROKS API (can be number in MiB or string like "384GB")
 */
function parseMemoryGiB(memory: number | string): number {
  if (typeof memory === 'number') {
    return Math.round(memory / 1024); // MiB to GiB
  }
  // String format like "384GB" or "768GiB"
  const match = memory.match(/(\d+)\s*(GB|GiB|MB|MiB)?/i);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = (match[2] || 'GB').toUpperCase();
    if (unit === 'MB' || unit === 'MIB') {
      return Math.round(value / 1024);
    }
    return value; // Already in GB/GiB
  }
  return 0;
}

/**
 * Transform ROKS machine types to our internal format
 */
export function transformROKSMachineTypes(machineTypes: ROKSMachineType[]): {
  vsi: TransformedProfile[];
  bareMetal: TransformedProfile[];
} {
  const vsi: TransformedProfile[] = [];
  const bareMetal: TransformedProfile[] = [];

  for (const mt of machineTypes) {
    if (mt.deprecated) continue;

    const isBM = mt.serverType === 'bare_metal' || mt.name.includes('.metal.');
    const hasNvme = mt.storage?.some(s => s.type === 'nvme') || false;

    const profile: TransformedProfile = {
      name: mt.name,
      family: getFamilyFromName(mt.name),
      vcpus: mt.cores,
      memoryGiB: parseMemoryGiB(mt.memory),
      bandwidthGbps: mt.networkSpeed ? mt.networkSpeed / 1000 : undefined,
    };

    if (isBM) {
      profile.physicalCores = Math.round(mt.cores / 2); // Assuming hyperthreading
      profile.hasNvme = hasNvme;
      if (hasNvme && mt.storage) {
        const nvmeStorage = mt.storage.filter(s => s.type === 'nvme');
        profile.nvmeDisks = nvmeStorage.reduce((sum, s) => sum + s.count, 0);
        profile.nvmeSizeGiB = nvmeStorage[0]?.size || 0;
        profile.totalNvmeGiB = nvmeStorage.reduce((sum, s) => sum + (s.size * s.count), 0);
      }
      bareMetal.push(profile);
    } else {
      vsi.push(profile);
    }
  }

  return {
    vsi: vsi.sort((a, b) => a.vcpus - b.vcpus),
    bareMetal: bareMetal.sort((a, b) => a.vcpus - b.vcpus),
  };
}

function getFamilyFromName(name: string): string {
  const prefix = name.split('-')[0].split('.')[0];
  if (prefix.startsWith('bx') || prefix.startsWith('bz')) return 'balanced';
  if (prefix.startsWith('cx') || prefix.startsWith('cz')) return 'compute';
  if (prefix.startsWith('mx') || prefix.startsWith('mz')) return 'memory';
  if (prefix.startsWith('vx')) return 'veryHighMemory';
  if (prefix.startsWith('ux')) return 'ultraHighMemory';
  if (prefix.startsWith('gx') || prefix.startsWith('gp')) return 'gpu';
  return 'other';
}

// ===== COMBINED FETCH =====

export interface ProfilesApiResult {
  vpcProfiles: Record<string, TransformedProfile[]>;
  roksMachineTypes: {
    vsi: TransformedProfile[];
    bareMetal: TransformedProfile[];
  };
  fetchedAt: string;
  region: string;
  zone: string;
}

/**
 * Fetch all profiles from both VPC and Kubernetes Service APIs
 *
 * @param region - IBM Cloud region (e.g., 'us-south')
 * @param zone - Availability zone (e.g., 'us-south-1')
 * @param apiKey - IBM Cloud API key
 */
export async function fetchAllProfiles(
  region: string = 'us-south',
  zone?: string,
  apiKey?: string
): Promise<ProfilesApiResult> {
  const effectiveZone = zone || `${region}-1`;

  console.log('[IBM Cloud API] Fetching all profiles:', { region, zone: effectiveZone });

  const [vpcResponse, roksResponse] = await Promise.all([
    fetchVPCInstanceProfiles(region, apiKey).catch(err => {
      console.warn('[IBM Cloud API] Failed to fetch VPC profiles:', err.message);
      return null;
    }),
    fetchROKSMachineTypes(effectiveZone, 'vpc-gen2', apiKey).catch(err => {
      console.warn('[IBM Cloud API] Failed to fetch ROKS machine types:', err.message);
      return null;
    }),
  ]);

  const vpcProfiles = vpcResponse
    ? transformVPCProfiles(vpcResponse.profiles)
    : { balanced: [], compute: [], memory: [], veryHighMemory: [], ultraHighMemory: [], gpu: [], other: [] };

  const roksMachineTypes = roksResponse
    ? transformROKSMachineTypes(roksResponse.machineTypes)
    : { vsi: [], bareMetal: [] };

  return {
    vpcProfiles,
    roksMachineTypes,
    fetchedAt: new Date().toISOString(),
    region,
    zone: effectiveZone,
  };
}

/**
 * Test API connectivity
 */
export async function testProfilesApiConnection(
  region: string = 'us-south',
  apiKey?: string
): Promise<boolean> {
  try {
    const response = await fetchVPCInstanceProfiles(region, apiKey);
    return response.total_count > 0;
  } catch (error) {
    console.error('[IBM Cloud API] Connection test failed:', error);
    return false;
  }
}
