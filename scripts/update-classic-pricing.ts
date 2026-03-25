#!/usr/bin/env npx tsx
/**
 * Script to update ibmCloudConfig.json with Classic bare metal pricing from SoftLayer API.
 *
 * Usage:
 *   npm run update-classic-pricing
 *
 * Requires:
 *   - IBM_CLOUD_API_KEY environment variable (or VITE_IBM_CLOUD_API_KEY)
 *
 * What it does:
 *   1. Authenticates via IAM
 *   2. Fetches SoftLayer Package 200 (Bare Metal Server) items
 *   3. Fetches item prices (standard and location-specific)
 *   4. Extracts CPU (server) and RAM options with pricing
 *   5. Updates classicBareMetalCpus and classicBareMetalRam in ibmCloudConfig.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const SOFTLAYER_BASE = 'https://api.softlayer.com/rest/v3.1';
const PACKAGE_ID = 200; // Bare Metal Server (Classic)
const CONFIG_PATH = path.join(__dirname, '..', 'src', 'data', 'ibmCloudConfig.json');

interface SLItem {
  id: number;
  keyName: string;
  description: string;
  capacity?: number | string;
  itemCategory?: { categoryCode: string };
}

interface SLItemPrice {
  id: number;
  recurringFee: string | null;
  hourlyRecurringFee: string | null;
  locationGroupId: number | null;
  item: {
    keyName: string;
    description: string;
    capacity?: number | string;
  };
}

interface ClassicCpu {
  keyName: string;
  description: string;
  cores: number;
  hourlyRate: number;
  monthlyRate: number;
}

interface ClassicRam {
  keyName: string;
  description: string;
  memoryGiB: number;
  monthlyRate: number;
}

async function getIamToken(apiKey: string): Promise<string> {
  console.log('  Authenticating with IBM Cloud IAM...');
  const response = await fetch(IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IAM authentication failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  console.log('  Authentication successful');
  return data.access_token;
}

async function fetchAllItemPrices(token: string): Promise<SLItemPrice[]> {
  console.log('  Fetching Classic bare metal item prices...');
  const allPrices: SLItemPrice[] = [];
  const limit = 200;
  let offset = 0;

  while (true) {
    const url = `${SOFTLAYER_BASE}/SoftLayer_Product_Package/${PACKAGE_ID}/getItemPrices?resultLimit=${offset},${limit}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch item prices at offset ${offset}: ${response.status}`);
    }

    const chunk: SLItemPrice[] = await response.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    allPrices.push(...chunk);
    console.log(`    Fetched ${allPrices.length} prices...`);
    if (chunk.length < limit) break;
    offset += limit;
  }

  console.log(`  Total item prices: ${allPrices.length}`);
  return allPrices;
}

function parseCoresFromDescription(desc: string): number {
  const m = desc.match(/\((\d+)\s*Cores/i);
  return m ? parseInt(m[1], 10) : 0;
}

function parseRamGiBFromKeyName(keyName: string): number {
  // RAM_128_GB_DDR4_... or RAM_1_TB_GB_... or RAM_2048_GB_...
  if (keyName.includes('_TB_')) {
    const m = keyName.match(/RAM_(\d+)_TB/);
    return m ? parseInt(m[1], 10) * 1024 : 0;
  }
  const m = keyName.match(/RAM_(\d+)_/);
  return m ? parseInt(m[1], 10) : 0;
}

function isServerItem(keyName: string): boolean {
  return (keyName.includes('INTEL') && (keyName.includes('XEON') || keyName.includes('2174')))
    || keyName.includes('AMD_EPYC')
    || keyName.startsWith('1U_DUAL_AMD');
}

function isRamItem(keyName: string): boolean {
  return keyName.startsWith('RAM_');
}

async function main() {
  const apiKey = process.env.IBM_CLOUD_API_KEY || process.env.VITE_IBM_CLOUD_API_KEY;
  if (!apiKey) {
    console.error('Error: IBM_CLOUD_API_KEY or VITE_IBM_CLOUD_API_KEY environment variable required');
    process.exit(1);
  }

  console.log('Updating Classic bare metal pricing from SoftLayer API...\n');

  const token = await getIamToken(apiKey);
  const allPrices = await fetchAllItemPrices(token);

  // Extract standard (no location group) server and RAM prices
  const serverPrices = allPrices.filter(
    p => isServerItem(p.item.keyName) && p.locationGroupId === null
  );
  const ramPrices = allPrices.filter(
    p => isRamItem(p.item.keyName) && p.locationGroupId === null
  );

  // Deduplicate CPUs by cores (keep the one with lowest monthly rate per core count)
  const cpuByKey = new Map<string, ClassicCpu>();
  for (const sp of serverPrices) {
    const cores = parseCoresFromDescription(sp.item.description);
    const monthlyRate = parseFloat(sp.recurringFee || '0');
    const hourlyRate = parseFloat(sp.hourlyRecurringFee || '0');

    if (cores === 0 || monthlyRate === 0) continue;

    const existing = cpuByKey.get(sp.item.keyName);
    if (!existing || monthlyRate < existing.monthlyRate) {
      cpuByKey.set(sp.item.keyName, {
        keyName: sp.item.keyName,
        description: sp.item.description,
        cores,
        hourlyRate,
        monthlyRate,
      });
    }
  }

  const classicCpus = Array.from(cpuByKey.values()).sort((a, b) => a.cores - b.cores);

  // Deduplicate RAM by memoryGiB (keep lowest monthly rate per size)
  const ramByGiB = new Map<number, ClassicRam>();
  for (const rp of ramPrices) {
    const memoryGiB = parseRamGiBFromKeyName(rp.item.keyName);
    const monthlyRate = parseFloat(rp.recurringFee || '0');

    if (memoryGiB === 0 || monthlyRate === 0) continue;
    // Skip very small sizes not useful for ESXi hosts
    if (memoryGiB < 16) continue;

    const existing = ramByGiB.get(memoryGiB);
    if (!existing || monthlyRate < existing.monthlyRate) {
      ramByGiB.set(memoryGiB, {
        keyName: rp.item.keyName,
        description: rp.item.description,
        memoryGiB,
        monthlyRate,
      });
    }
  }

  const classicRam = Array.from(ramByGiB.values()).sort((a, b) => a.memoryGiB - b.memoryGiB);

  console.log(`\n  Classic BM CPUs: ${classicCpus.length}`);
  for (const cpu of classicCpus) {
    console.log(`    ${cpu.cores} cores - ${cpu.description} - $${cpu.monthlyRate}/mo`);
  }

  console.log(`\n  Classic BM RAM: ${classicRam.length}`);
  for (const ram of classicRam) {
    console.log(`    ${ram.memoryGiB} GiB - ${ram.description} - $${ram.monthlyRate}/mo`);
  }

  // Update config
  console.log('\n  Updating ibmCloudConfig.json...');
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  config.classicBareMetalCpus = classicCpus;
  config.classicBareMetalRam = classicRam;

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
  console.log('  Done!\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
