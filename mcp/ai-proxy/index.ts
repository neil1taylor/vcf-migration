#!/usr/bin/env npx vite-node
// VCF Analyzer MCP Server — stdio transport

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Tool implementations
import { parseRvtools } from './tools/parse';
import { showParsedData } from './tools/show-data';
import { configureProxy } from './tools/configure';
import { runPreflight } from './tools/preflight';
import { analyzeComplexity } from './tools/complexity';
import { classifyTargets } from './tools/classify';
import { estimateCosts } from './tools/cost';
import { assessRisks } from './tools/risk';
import { planWaves } from './tools/waves';
import { estimateTimeline } from './tools/timeline';
import { designVpc } from './tools/network';
import { checkOsCompatibility } from './tools/os-compat';
import { checkDataQuality } from './tools/data-quality';
import { checkAutoExclusions } from './tools/auto-exclusion';
import { aiHealthCheck, aiReadinessCheck } from './tools/ai-health';
import { aiClassifyVms } from './tools/ai-classify';
import { aiGetInsights } from './tools/ai-insights';
import { aiChat } from './tools/ai-chat';
import { aiCallEndpoint } from './tools/ai-call';

const server = new McpServer({
  name: 'vcf-analyzer',
  version: '1.0.0',
});

// ── Data Loading ──────────────────────────────────────────────────

server.tool(
  'parse_rvtools',
  'Parse an RVTools Excel file and load into memory. Defaults to test fixture.',
  { filePath: z.string().optional().describe('Path to .xlsx file. Defaults to e2e/fixtures/test-rvtools.xlsx') },
  async ({ filePath }) => parseRvtools(filePath),
);

server.tool(
  'show_parsed_data',
  'Inspect loaded RVTools data by section.',
  { section: z.enum(['summary', 'vms', 'hosts', 'clusters', 'datastores', 'networks', 'snapshots', 'disks']).optional().describe('Data section to display. Default: summary') },
  async ({ section }) => showParsedData(section),
);

// ── Local Analysis Tools ──────────────────────────────────────────

server.tool(
  'run_preflight_checks',
  'Run per-VM migration readiness checks (blockers + warnings).',
  { mode: z.enum(['roks', 'vsi']).describe('Migration target: roks or vsi') },
  async ({ mode }) => runPreflight(mode),
);

server.tool(
  'analyze_complexity',
  'Score all VMs for migration complexity. Returns distribution and readiness score.',
  { mode: z.enum(['roks', 'vsi']).describe('Migration target: roks or vsi') },
  async ({ mode }) => analyzeComplexity(mode),
);

server.tool(
  'classify_targets',
  'Route VMs to ROKS/VSI/PowerVS using the data-driven rule engine.',
  { platformLeaning: z.enum(['roks', 'vsi', 'neutral']).optional().describe('Preferred platform. Default: neutral') },
  async ({ platformLeaning }) => classifyTargets(platformLeaning),
);

server.tool(
  'estimate_costs',
  'Calculate ROKS and VSI cost estimates for the loaded environment.',
  {
    region: z.string().optional().describe('IBM Cloud region code. Default: us-south'),
    discountType: z.string().optional().describe('Discount type. Default: onDemand'),
  },
  async ({ region, discountType }) => estimateCosts(region, discountType),
);

server.tool(
  'assess_risks',
  'Generate auto-detected + curated migration risk table.',
  {},
  async () => assessRisks(),
);

server.tool(
  'plan_waves',
  'Group VMs into migration waves by complexity.',
  { mode: z.enum(['roks', 'vsi']).describe('Migration target: roks or vsi') },
  async ({ mode }) => planWaves(mode),
);

server.tool(
  'estimate_timeline',
  'Build migration timeline with phase durations.',
  {
    waveCount: z.number().optional().describe('Number of migration waves. Default: 3'),
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD). Default: today'),
  },
  async ({ waveCount, startDate }) => estimateTimeline(waveCount, startDate),
);

server.tool(
  'design_vpc',
  'Generate VPC design (subnets, security groups, ACLs) from network data.',
  { region: z.string().describe('IBM Cloud region code (e.g. us-south)') },
  async ({ region }) => designVpc(region),
);

server.tool(
  'check_os_compatibility',
  'Check all VM guest OS against compatibility matrices.',
  { mode: z.enum(['roks', 'vsi']).describe('Migration target: roks or vsi') },
  async ({ mode }) => checkOsCompatibility(mode),
);

server.tool(
  'check_data_quality',
  'Run statistical outlier detection on VM resource allocations.',
  {},
  async () => checkDataQuality(),
);

server.tool(
  'check_auto_exclusions',
  'Evaluate all VMs against auto-exclusion rules.',
  {},
  async () => checkAutoExclusions(),
);

// ── AI Proxy Tools ────────────────────────────────────────────────

server.tool(
  'configure_proxy',
  'Set AI proxy URL. Presets: local (localhost:8080), code-engine (from env).',
  {
    preset: z.enum(['local', 'code-engine']).optional().describe('Preset URL'),
    url: z.string().optional().describe('Custom proxy URL'),
  },
  async ({ preset, url }) => configureProxy(preset, url),
);

server.tool(
  'ai_health_check',
  'Check AI proxy health endpoint.',
  {},
  async () => aiHealthCheck(),
);

server.tool(
  'ai_readiness_check',
  'Check AI proxy readiness endpoint.',
  {},
  async () => aiReadinessCheck(),
);

server.tool(
  'ai_classify_vms',
  'Classify VMs using watsonx.ai via the AI proxy.',
  { limit: z.number().optional().describe('Max VMs to classify. Default: all') },
  async ({ limit }) => aiClassifyVms(limit),
);

server.tool(
  'ai_get_insights',
  'Get AI-generated migration insights from watsonx.ai.',
  { migrationTarget: z.string().optional().describe('Target platform (roks/vsi). Default: roks') },
  async ({ migrationTarget }) => aiGetInsights(migrationTarget),
);

server.tool(
  'ai_chat',
  'Chat with watsonx.ai about the loaded environment.',
  { message: z.string().describe('Chat message') },
  async ({ message }) => aiChat(message),
);

server.tool(
  'ai_call_endpoint',
  'Generic POST to any AI proxy endpoint. Body is a JSON string.',
  {
    path: z.string().describe('API path (e.g. /api/anomaly-detection)'),
    body: z.string().describe('Request body as JSON string'),
  },
  async ({ path, body }) => {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return aiCallEndpoint(path, parsed);
  },
);

// ── Start Server ──────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
