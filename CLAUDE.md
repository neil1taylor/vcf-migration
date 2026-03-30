# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Clarification and Planning

- If requirements are ambiguous or incomplete, STOP and ask clarifying questions
- When multiple valid solutions exist, present 2-3 options with tradeoffs and ask for preference
- After gathering requirements, propose a plan before coding
- Start with the simplest solution; ask before adding sophistication

## Build & Development Commands

```bash
npm run dev          # Start dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm test             # Run tests with Vitest
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage
npm run update-profiles # Update IBM Cloud profiles from APIs (requires API key)
npm run update-pricing  # Update IBM Cloud pricing from Global Catalog (no API key required)
npm run update-classic-pricing # Update Classic bare metal pricing (no API key required)
npm run update-all      # Update profiles, pricing, and classic pricing
npm run test:e2e        # Run Playwright E2E tests (headless)
npm run test:e2e:headed # Run E2E tests with visible browser
npm run test:e2e:debug  # Run E2E tests in debug mode
npm run test:e2e:ui     # Run E2E tests with Playwright UI
npm run test:e2e:generate-fixture # Regenerate test Excel fixture
npm run convert:vinventory -- input.xlsx [output.xlsx]  # Convert vInventory to RVTools format
npm run preview:pptx    # Generate PPTX from test fixture + convert slides to PNGs for visual inspection
npm run preview:docx    # Generate DOCX from test fixture for visual inspection
npm run mcp:ai-proxy    # Start the MCP server for automated AI proxy testing
```

## Testing Requirements

- Always run existing tests before making changes to establish baseline
- Write or update tests before implementing new features
- Run tests after each significant change; fix failures immediately
- All new functions must have tests; bug fixes must include regression tests
- Test both happy paths and error conditions/edge cases
- After completing a feature, run the full test suite

## E2E Testing (Playwright)

Browser-based E2E tests using Playwright (Chromium only). Tests live in `e2e/` directory with a separate `tsconfig.e2e.json` to avoid conflicts with the app's TypeScript config.

### Structure

| Path | Purpose |
|------|---------|
| `e2e/dashboard-tiles.spec.ts` | Dashboard tile navigation, tooltip isolation, hover arrows |
| `e2e/helpers/load-data.ts` | Shared helper: uploads test fixture, waits for dashboard |
| `e2e/fixtures/generate-fixture.ts` | Script to regenerate the test `.xlsx` fixture |
| `e2e/fixtures/test-rvtools.xlsx` | Minimal RVTools Excel with all required sheets |
| `playwright.config.ts` | Playwright config (Chromium, webServer auto-start, HTML reporter) |

### Running

- `npm run test:e2e` — headless (CI-friendly)
- `npm run test:e2e:headed` — visible browser
- `npm run test:e2e:ui` — Playwright UI mode
- Regenerate fixture: `npm run test:e2e:generate-fixture`

### Fixture

The test fixture (`e2e/fixtures/test-rvtools.xlsx`) contains 3 VMs, 2 hosts, 1 cluster, 1 datastore, 1 old snapshot (>30 days), 1 VM with tools not installed, and 1 CD-ROM connected. Column headers match the app's parser COLUMN_MAP definitions. Regenerate with `npm run test:e2e:generate-fixture` if parser columns change.

## UI Testing

- Test UI changes in Chrome, not just by reading code
- Verify responsive behavior, user interactions, console errors
- Start dev server → navigate to page → test feature → check console → verify responsive layout
- Open Chrome: `open -a "Google Chrome" http://localhost:5173`

## Documentation

Document all changes in CLAUDE.md and README.md. If adding new technologies, update TECHNOLOGIES.md. If changes impact the user, update in-app documentation. Add changes to `src/data/changelog.json`. Only update the version if requested.

User Guide: `docs/USER_GUIDE.md` and in-app at `/user-guide` route (`src/pages/UserGuidePage.tsx`).

## Architecture Overview

React 19 + TypeScript + Vite application for VMware Cloud Foundation migration planning. Analyzes RVTools Excel exports and provides migration assessments for IBM Cloud ROKS (OpenShift) and VPC VSI targets.

### Key Architectural Patterns

- **Data Flow**: RVTools/vInventory Excel parsed client-side (SheetJS `xlsx`) → `DataContext` (React Context + useReducer) → all components. Types in `src/types/rvtools.ts`. Only vInfo is required; all other sheets default to `[]` when missing. vInventory files are auto-detected (has `vmInfo` but no `vInfo` sheet) and converted in-memory by `src/services/parser/vinventoryConverter.ts` before parsing.
- **Sheet Availability**: `src/hooks/useAvailableSheets.ts` derives boolean flags (`hasVDisk`, `hasVDatastore`, `hasVNetwork`, `hasVHost`, `hasVCluster`, `hasVSnapshot`, `hasVTools`) from `rawData` array lengths. SideNav greys out items for pages missing required sheets; pages show empty state tiles.
- **State Management**: `src/context/DataContext.tsx` (global state), `src/context/dataReducer.ts` (reducer), hooks in `src/hooks/` (complex logic).
- **VM Management**: `src/hooks/useVMOverrides.ts` (exclusions/overrides/burstable/instance storage with localStorage), `src/utils/vmIdentifier.ts` (VM ID and environment fingerprinting).
- **IBM Cloud Integration**: `src/services/pricing/globalCatalogApi.ts` and `src/services/ibmCloudProfilesApi.ts` fetch via Code Engine proxies. Fallback to `src/data/ibmCloudConfig.json`.
- **Export Pipeline**: `src/services/export/` — `bomXlsxGenerator.ts` (ExcelJS; VSI BOM includes aggregated "BOM Summary" sheet as first tab with category-level line items from `estimate.lineItems`), `pdfGenerator.ts` (jsPDF), `excelGenerator.ts`, `docxGenerator.ts`, `pptxGenerator.ts` (pptxgenjs), `yamlGenerator.ts`, `handoverExporter.ts` (bundles RVTools file + localStorage settings into a single download for colleague handoff). **Import**: `src/services/settingsExtractor.ts` extracts settings from a handover file without full parsing; `src/services/settingsRestore.ts` writes them to localStorage. Available on Settings and Export pages.

### Key Directories

- `src/pages/` — Route components (main: `ROKSMigrationPage.tsx`, `VSIMigrationPage.tsx`)
- `src/components/` — By feature: `charts/`, `sizing/`, `pricing/`, `tables/`, `export/`
- `src/services/` — Business logic: cost estimation, pricing APIs, export generation
- `src/data/` — Static JSON: IBM Cloud config, MTV requirements, OS compatibility matrices
- `src/types/` — TypeScript interfaces for RVTools data, MTV types, analysis results

### Path Alias

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).

### UI Framework

IBM Carbon Design System (`@carbon/react`) — all UI components follow Carbon patterns.

## Environment Variables

```bash
VITE_PRICING_PROXY_URL=...      # Code Engine pricing proxy URL
VITE_PROFILES_PROXY_URL=...     # Code Engine profiles proxy URL
VITE_AI_PROXY_URL=...           # Code Engine AI proxy URL (watsonx.ai)
```

Without proxy URLs, the app uses static data from `src/data/ibmCloudConfig.json`.

## Updating IBM Cloud Data

```bash
export IBM_CLOUD_API_KEY=your-api-key
npm run update-profiles  # VSI/bare metal specs, ROKS support detection
npm run update-pricing   # Per-region list prices from Global Catalog (unauthenticated)
npm run update-classic-pricing # Classic bare metal pricing (unauthenticated)
npm run update-all       # All three: profiles, pricing, and classic pricing
```

- **Profile script** (`scripts/update-profiles.ts`): Fetches VPC instance/bare metal profiles and ROKS machine types, auto-detects ROKS support by matching bare metal profiles against ROKS flavors API.
- **Pricing script** (`scripts/update-pricing.ts`): Fetches pricing unauthenticated from Global Catalog (list prices, no API key required), extracts per-region rates for all 10 IBM Cloud VPC regions, calculates monthly (hourly × 730). Writes `regionalPricing` section to config with actual rates per region. Also fetches ROKS per-profile worker node rates (which differ from VPC rates by ~9%). `calculateROKSCost()` prefers ROKS worker rates when available, falling back to VPC rates via `??`.
- **Classic pricing script** (`scripts/update-classic-pricing.ts`): Fetches Classic bare metal pricing from Global Catalog (unauthenticated).
- **ROKS fallback**: When proxy returns no ROKS data, `useDynamicProfiles` hook falls back to static JSON `roksSupported` values.
- **Data source labels**: "Live API" (green) when proxy available or cached proxy data; "Cache" (gray) when using static data.

## Custom Bare Metal Profiles

Define custom profiles in `src/data/ibmCloudConfig.json` under `customBareMetalProfiles`. Required fields: `name`, `physicalCores`, `vcpus`, `memoryGiB`, `hasNvme`. Optional: `tag` (defaults to "Custom"), `roksSupported`, `hourlyRate`, `monthlyRate`, `useCase`, `description`. See the JSON file for full structure. Custom profiles are always static (never from proxy) and appear alongside standard profiles in the Sizing Calculator.

## OS Compatibility Data

Manually maintained in `src/data/ibmCloudOSCompatibility.json` (VPC VSI) and `src/data/redhatOSCompatibility.json` (ROKS). Update when IBM Cloud/Red Hat changes supported OS versions. The `patterns` array contains lowercase strings matched against RVTools "Guest OS" field (case-insensitive substring matching in `src/services/migration/osCompatibility.ts`).

## vInventory Converter

Standalone Python script (`scripts/convert_vinventory.py`) that converts vInventory Excel exports to RVTools-compatible format for ingestion by the app.

### Usage

```bash
python3 scripts/convert_vinventory.py input.xlsx [output.xlsx]
# Or via npm:
npm run convert:vinventory -- input.xlsx [output.xlsx]
```

### Supported Sheets

| vInventory Sheet | RVTools Output | Notes |
|---|---|---|
| `vmInfo` | `vInfo` | MemGB×1024→MiB, ProvisionedGB×1024→MiB |
| `vDisk` | `vDisk` | DiskGB×1024→MiB |
| `vNetworkadapter` | `vNetwork` | — |
| `Snapshots` | `vSnapshot` | DaysOld→Date/time synthesis |
| `DvdFloppy` | `vCD` | — |
| `Cluster` | `vCluster` | MemGB×1024→MiB |
| `vmhost` | `vHost` | MemGB×1024→MiB |
| `vCenter` | `vSource` | — |
| `vLicense` | `vLicense` | — |
| `vPartition` | `vPartition` | — |
| (from vmInfo) | `vTools` | Synthesized from vmInfo columns |
| (from vmInfo) | `vCPU` | Synthesized from vmInfo columns |
| (from vmInfo) | `vMemory` | Synthesized from vmInfo columns |
| vDisk+DatastoreAssociation+LUN | `vDatastore` | Synthesized: capacity, usage, hosts, datacenter |

### Requirements

Python 3.8+ with openpyxl: `pip install openpyxl`

## Virtualization Overhead

Configured in `src/data/virtualizationOverhead.json`. Overhead formula: **fixed + proportional** per VM.

| Type | Fixed (per VM) | Proportional |
|------|----------------|--------------|
| CPU | 0.27 vCPU | 3% of guest vCPUs |
| Memory | 378 MiB | 3% of guest RAM |
| Storage | N/A | 15% (user adjustable, 0-25%) |

The Sizing Calculator shows 4-segment breakdowns: VM requirements, Virt overhead, ODF reserved, System reserved. Reference page at `/overhead-reference`.

## AI Integration (watsonx.ai)

Optional AI features via Code Engine proxy → IBM watsonx.ai (Granite models).

### Model Tiers

The proxy uses a tiered model approach for optimal performance:
- **Fast model** (`ibm/granite-3-1-8b-instruct`): Classification, right-sizing, remediation, discovery questions
- **Complex model** (`ibm/granite-3-1-34b-instruct`): Insights, chat, risk analysis, report narrative, target selection, anomaly detection, wave sequencing

Override via env vars: `WATSONX_FAST_MODEL_ID`, `WATSONX_COMPLEX_MODEL_ID`.

### Key Files

| Directory | Purpose |
|-----------|---------|
| `functions/ai-proxy/` | Code Engine Express.js proxy (endpoints, prompts, watsonx client) |
| `src/services/ai/` | Client API, cache, context builder, stream client, types |
| `src/hooks/useAI*.ts` | React hooks for all AI features |
| `src/components/ai/` | UI components (panels, chat, anomaly, risk, report, interview) |
| `src/services/ai/insightsInputBuilder.ts` | Builds InsightsInput for report AI integration |
| `src/services/ai/anomalyInputBuilder.ts` | Client-side statistical analysis for anomaly detection |
| `src/services/ai/reportInputBuilder.ts` | Assembles aggregated data for report narrative |

### AI Features

| Feature | Endpoint | Hook | Model |
|---------|----------|------|-------|
| Classification | `/api/classify` | `useAIClassification` | Fast |
| Right-sizing | `/api/rightsizing` | `useAIRightsizing` | Fast |
| Insights | `/api/insights` | `useAIInsights` | Complex |
| Chat | `/api/chat` | `useAIChat` | Complex |
| Chat (streaming) | `/api/chat/stream` | `useAIChat` | Complex |
| Insights (streaming) | `/api/insights/stream` | `useAIInsights` | Complex |
| Wave Suggestions | `/api/wave-suggestions` | `useAIWaveSuggestions` | Fast |
| Cost Optimization | `/api/cost-optimization` | `useAICostOptimization` | Fast |
| Remediation | `/api/remediation` | `useAIRemediation` | Fast |
| Target Selection | `/api/target-selection` | `useAITargetSelection` | Complex |
| Wave Sequencing | `/api/wave-sequencing` | `useAIWaveSuggestions` | Complex |
| Anomaly Detection | `/api/anomaly-detection` | `useAIAnomalyDetection` | Complex |
| Risk Analysis | `/api/risk-analysis` | `useAIRiskAnalysis` | Complex |
| Report Narrative | `/api/report-narrative` | `useAIReport` | Complex |
| Discovery Questions | `/api/discovery-questions` | `useAIDiscoveryQuestions` | Fast |
| Interview | `/api/interview` | `useAIInterview` | Fast |

### AI Behavior

- Disabled by default; users enable via Settings page (`/settings`, stored in `vcf-ai-settings` localStorage key)
- All hooks check `useAISettings().settings.enabled` before requests
- Only aggregated summaries sent (never VM names, IPs, or raw data)
- Reports (DOCX, PDF, Excel, BOM) include AI sections when enabled, with watsonx.ai disclaimer
- Fallback: Without proxy → components render nothing; proxy unavailable → rule-based logic; AI disabled → same as unconfigured
- Proxy access: CORS origin restriction via `ALLOWED_ORIGINS` env var; `/health` is unauthenticated; rate limited (30 req/min)
- **Streaming**: Chat and insights support SSE streaming via `/api/chat/stream` and `/api/insights/stream`. Client uses `aiStreamClient.ts` with `ReadableStream` reader.
- **Persistent chat**: Chat history stored in localStorage (`vcf-ai-chat-history`), scoped by environment fingerprint, max 100 messages.
- **Parallel batching**: Classification and right-sizing process batches concurrently (max 5 parallel LLM calls) for faster results on large environments.
- **Anomaly detection**: Client-side statistical analysis (z-scores, outlier detection) runs first, then AI validates and provides narrative. No VM names sent to AI.
- Caching: Proxy 30min (in-memory), Client 24hr (localStorage)

## Version Management

Version sourced from `package.json`, injected via Vite `define` in `vite.config.ts`. Globals: `__APP_VERSION__`, `__APP_NAME__`, `__APP_DESCRIPTION__`, `__APP_AUTHOR__`, `__APP_LICENSE__`, `__BUILD_TIME__` (declared in `src/vite-env.d.ts`).

To update: change `package.json` version → add entry to `src/data/changelog.json` → rebuild. Changelog follows [Keep a Changelog](https://keepachangelog.com/) (sections: `added`, `changed`, `fixed`, `removed`, `deprecated`, `security`).

## Utilities

- **Retry**: `src/utils/retry.ts` — `withRetry()` with exponential backoff. Network/5xx errors retry; auth errors (401/403) fail immediately; AbortErrors not retried.
- **Logging**: `src/utils/logger.ts` — `createLogger(moduleName)`. Levels: error (failures), warn (recoverable), info (operations), debug (dev only). Also: `parseApiError()`, `getUserFriendlyMessage()`.
- **Validation**: `src/services/costEstimation.ts` — `validateROKSSizingInput()`, `validateVSISizingInput()`, `validateRegion()`, `validateDiscountType()`.

## VM Management

Three-tier exclusion model (priority order):
1. **User force-included** (`forceIncluded: true`) → INCLUDED regardless
2. **User manually excluded** (`excluded: true`) → EXCLUDED
3. **Auto-exclusion rule matches** → AUTO-EXCLUDED
4. **Default** → INCLUDED

### Auto-Exclusion

All rules configured in `src/data/workloadPatterns.json` under `autoExclusionRules` (no hardcoded logic). Two rule types:
- **Field rules**: Match VM properties (e.g., `template === true`, `powerState !== 'poweredOn'`)
- **Name patterns**: Match VM names with `contains`/`startsWith`/`endsWith`/`exact`/`regex`. Optional `excludePatterns` for exceptions.

### Key Files

| File | Purpose |
|------|---------|
| `src/utils/autoExclusion.ts` | Auto-exclusion logic |
| `src/hooks/useAutoExclusion.ts` | React hook for auto-exclusion |
| `src/hooks/useVMOverrides.ts` | VM overrides with localStorage (`vcf-vm-overrides`) |
| `src/components/discovery/DiscoveryVMTable.tsx` | Unified VM table |
| `src/utils/vmIdentifier.ts` | VM ID: `${name}::${uuid}` or `${name}::${dc}::${cluster}` |

### VM Overrides

Stored in localStorage (`vcf-vm-overrides`), version 2. Environment fingerprinting (`server::instanceUuid::clusters`) enables override reuse across exports from the same vCenter. Per-VM fields: `excluded`, `forceIncluded`, `workloadType`, `burstableCandidate`, `instanceStorage`, `notes`. The `burstableCandidate` flag selects burstable (flex) VSI profiles; `instanceStorage` selects the NVMe instance storage (d-suffix) variant of the profile.

### Migration Page Integration

```typescript
const vms = allVmsRaw.filter(vm => {
  const vmId = getVMIdentifier(vm);
  const autoResult = getAutoExclusionById(vmId);
  return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
});
```

## Discovery

Discovery page (`src/pages/DiscoveryPage.tsx`) has Infrastructure, Workload, Networks, and Source BOM tabs.

### Infrastructure Tab

Source Data Center selector and Target IBM Cloud MZR dropdown. Source DC auto-selects the nearest MZR; user can override. On-premise sources show "Choose" placeholder (no default MZR). Both values persist in localStorage (`vcf-target-location`).

| File | Purpose |
|------|---------|
| `src/components/discovery/InfrastructureTab.tsx` | Infrastructure tab with DC/MZR selectors and environment summary tables |
| `src/hooks/useTargetLocation.ts` | localStorage `vcf-target-location`, env fingerprinting, DC→MZR mapping |
| `src/data/ibmCloudDataCenters.json` | IBM Cloud data center codes, cities, MZR mappings |

### Source BOM Tab

Prices the source VMware environment using IBM Cloud bare metal, VCF licensing, and storage. Best-fit matches each ESXi host to the smallest adequate bare metal profile. Storage classified by type: NFS → File Storage, VMFS → Block Storage, vSAN/VVOL → local NVMe ($0). Uses the target MZR from the Infrastructure tab for regional pricing.

| File | Purpose |
|------|---------|
| `src/components/discovery/SourceBOMTab.tsx` | Source BOM tab with host mapping, storage, cost summary |
| `src/hooks/useSourceBOM.ts` | Computes source BOM from RVTools data + pricing |
| `src/services/sourceBom/sourceBomService.ts` | Pure functions: `matchHostToBareMetal`, `classifyDatastoreStorage`, `buildSourceBOM` |
| `src/services/sourceBom/types.ts` | `HostMapping`, `StorageLineItem`, `SourceBOMResult` types |
| `src/services/export/sourceBomXlsxGenerator.ts` | XLSX export: BOM Summary, Host Mapping, Storage Mapping sheets |
| `src/services/export/docx/sections/sourceBom.ts` | DOCX section: Source Infrastructure Costing |

### Classification Precedence

1. **User override** (cyan `User` tag) — highest priority
2. **Maintainer authoritative** (teal `Maintainer` tag, from `authoritativeClassifications` in `workloadPatterns.json`) — AI cannot override
3. **AI classification** — overrides pattern matching when available
4. **Rule-based detection** — fallback pattern matching from `categories` in `workloadPatterns.json`

Classification and auto-exclusion are independent. Each VM has exactly one workload type (4-pass merge with dedup).

### Key Files

| File | Purpose |
|------|---------|
| `src/pages/DiscoveryPage.tsx` | Tabbed layout (Infrastructure + Workload + Networks) |
| `src/components/discovery/DiscoveryVMTable.tsx` | Unified VM table with burstable/instance storage toggles |
| `src/components/network/NetworkSummaryTable.tsx` | Network table with editable subnets |
| `src/data/workloadPatterns.json` | Workload types, authoritative classifications, auto-exclusion rules |

## Assess Step

Legacy routes (`/migration-timeline`, `/risk-assessment`, `/network-design`) redirect to their new locations.

| Route | Redirect |
|-------|----------|
| `/network-design` | `/vsi-migration` (Network Design tab) |
| `/migration-timeline` | `/migration-comparison` (Migration Timeline tab) |
| `/risk-assessment` | `/migration-comparison` (Risk Assessment tab) |

### VPC Network Design (VSI Migration tab)

Maps VMware port groups to IBM Cloud VPC subnets. Distributes across 3 zones. Generates security groups from templates and ACL suggestions. Rendered as `NetworkDesignPanel` within the VSI Migration page tabs.

| File | Purpose |
|------|---------|
| `src/types/vpcDesign.ts` | VPC subnet, SG, ACL, transit gateway, zone types |
| `src/services/network/vpcDesignService.ts` | `buildVPCDesign()` orchestrator |
| `src/hooks/useVPCDesign.ts` | localStorage `vcf-vpc-design`, env fingerprinting |
| `src/data/vpcSecurityGroupTemplates.json` | Workload → default SG rules mapping |
| `src/components/charts/VPCTopologyDiagram.tsx` | D3 hierarchical SVG (region → VPC → zones → subnets) |
| `src/components/migration/NetworkDesignPanel.tsx` | Panel component for VSI Migration tab |

### Migration Review (under Migration Assessment)

Side-by-side ROKS vs VSI vs PowerVS comparison with user overrides and 5-tab analysis (Platform Selection, VM Assignments, Migration Planning, Risk Assessment, Cost Comparison). Route: `/migration-comparison`. The Migration Planning tab integrates wave planning (from `useWavePlanning` hook) with the timeline — wave count from active waves drives timeline phases. Platform-specific sections (VSI workflow, RackWare export) appear conditionally based on platform selection leaning. The Cost Comparison tab shows source VMware BOM alongside all 6 ROKS architectures (full + ROVe variants) and VPC VSI costs with category-level expandable rows and delta tags.

**Target Assignment** — Default platform comes from the Platform Selection questionnaire's `leaning` (`roks`/`vsi`/`neutral`). SAP/Oracle VMs (enterprise workload + SAP/HANA name patterns, or database workload + Oracle name patterns) default to PowerVS. When leaning is `neutral`, falls back to data-driven auto-classification rules (`targetClassificationRules.json`). Users can override any VM's target via dropdown and edit the reason text inline. The VM Assignment table shows: VM Name, Workload Type, Target (dropdown), and Reason (editable text). Recommendation: >70% one target → recommend that target; else split.

**Auto-Classification Fallback** — Rule engine (`src/data/targetClassificationRules.json`) evaluated in priority order: OS compatibility crosscheck (consults ROKS/VSI compat JSON), memory >512GB→ROKS, workload type heuristics, Linux default→ROKS, fallback→VSI. No hardcoded OS checks — Windows VMs are routed by actual compatibility data.

| File | Purpose |
|------|---------|
| `src/data/targetClassificationRules.json` | Data-driven classification rules (priority, type, target, confidence, reason templates) |
| `src/services/migration/targetClassification.ts` | Rule engine: `classifyVMTarget()`, `classifyAllVMs()`, `getRecommendation()` |
| `src/hooks/useTargetAssignments.ts` | Accepts `platformLeaning`, SAP/Oracle→PowerVS, localStorage `vcf-target-assignments`, env fingerprinting, user overrides with editable reasons |
| `src/data/platformSelectionFactors.json` | Platform selection factors including dynamic cost factor (`target: "dynamic"`, `dynamicResolver: "cost"`) |
| `src/hooks/usePlatformSelection.ts` | Platform selection with optional `costData` param — resolves dynamic cost factor at runtime |
| `src/pages/MigrationComparisonPage.tsx` | Main page with 5 tabs (Platform Selection, VM Assignments, Migration Planning, Risk Assessment, Cost Comparison) |
| `src/components/comparison/` | RecommendationBanner, VMAssignmentTable, PlatformSelectionPanel, CostComparisonPanel |
| `src/hooks/useCostComparison.ts` | Orchestrates source BOM + all ROKS/ROVe + VSI cost estimates for Cost Comparison tab |
| `src/types/timeline.ts` | Phase types, config, totals, colors/defaults |
| `src/services/migration/timelineEstimation.ts` | `buildDefaultTimeline()`, `calculateTimelineTotals()`, `formatTimelineForExport()` |
| `src/hooks/useTimelineConfig.ts` | localStorage `vcf-timeline-config`, env fingerprinting |
| `src/components/charts/GanttTimeline.tsx` | Chart.js Bar with `indexAxis: 'y'` |
| `src/types/riskAssessment.ts` | RiskRow, RiskTableData, RiskTableOverrides (v3), RiskStatus (red/amber/green), RiskCategory |
| `src/data/curatedMigrationRisks.json` | 15 curated migration risks across 6 categories |
| `src/services/riskAssessment.ts` | `generateAutoRisks()`, `loadCuratedRisks()`, `buildRiskTable()` |
| `src/hooks/useRiskAssessment.ts` | localStorage `vcf-risk-overrides` (v3), env fingerprinting |
| `src/components/risk/RiskTable.tsx` | Carbon DataTable with status dropdowns, inline-editable mitigation, category filter |
| `src/components/risk/AddRiskModal.tsx` | Modal for adding custom user risk rows |

### DOCX Export Sections

| File | Content |
|------|---------|
| `src/services/export/docx/sections/riskAssessment.ts` | Flat risk table with status summary |
| `src/services/export/docx/sections/timelineEstimation.ts` | Phase table (with Source/VMs columns), pilot description, duration formula, total duration |
| `src/services/export/docx/sections/networkDesign.ts` | Subnet mapping, SG summary |
| `src/services/export/docx/sections/platformSelection.ts` | Score summary, per-factor responses |

## IBM Cloud Classic Billing Import

Optional import of IBM Cloud Classic billing exports (`.xls`) to replace estimated Source BOM costs with actual invoiced amounts.

### File Detection

`src/services/parser/fileDetector.ts` — `detectFileType(workbook)` returns `'classic-billing' | 'vinventory' | 'rvtools' | 'unknown'`. Billing files detected by presence of `Summary` + `Detailed Billing` sheets and absence of `vInfo`/`vmInfo`.

### Key Files

| File | Purpose |
|------|---------|
| `src/services/billing/types.ts` | `ClassicBillingData`, `BillingServerSummary`, `BillingDetailLineItem`, `BillingHostMatch`, `BillingMatchResult` |
| `src/services/billing/billingDetector.ts` | `isClassicBillingFormat(workbook)` — sheet-name-based detection |
| `src/services/billing/billingParser.ts` | `parseClassicBilling(workbook, fileName)` — parses Summary, Bare Metal, Virtual Servers, Detailed Billing sheets |
| `src/services/billing/billingHostMatcher.ts` | `matchBillingToHosts(billing, rvtoolsHostnames)` — exact + FQDN prefix matching |
| `src/services/parser/fileDetector.ts` | `detectFileType(workbook)` — unified file type detection |

### Data Flow

1. User uploads billing `.xls` via Source BOM tab (Tile + "Upload Billing File" button) or main drop zone
2. `isClassicBillingFormat()` detects billing format → `parseClassicBilling()` extracts data
3. Billing data stored in `DataContext` (`billingData` state, `SET_BILLING_DATA` action)
4. `useSourceBOM` hook receives billing data → calls `matchBillingToHosts()` then `buildSourceBOMWithBilling()`
5. Matched ESXi hosts get actual invoiced costs; unmatched RVTools hosts keep estimated costs
6. Unmatched billing servers (non-ESXi infrastructure: backup vaults, gateways, firewalls) are shown as an info notification and their costs flow into the "Additional Costs" section
7. Additional billing categories (networking, OS, software) appear as new line items
8. Cost Comparison tab automatically uses actual source costs

### Host Matching

Billing hostnames (FQDNs like `green01esx000.green01.greencore.vcs`) matched to RVTools vHost names in two passes:
1. **Exact match** (case-insensitive)
2. **FQDN prefix match** (first segment before `.`)

Match rate is calculated as matched hosts / total RVTools hosts (not total billing servers), since billing includes non-ESXi infrastructure that is not expected to match. Unmatched billing servers are displayed as informational (not warnings) with their costs included under Additional Costs.

### Billing File Structure

IBM Cloud Classic billing exports have 4 sheets:
- **Summary**: Hierarchical category totals (Bare Metal, Virtual Servers, Unattached Services, Platform Services)
- **Bare Metal Servers**: Server hostname + total recurring fee per server
- **Virtual Servers**: VM hostname + total recurring fee
- **Detailed Billing**: Per-server line items grouped by server name (categories: Server, RAM, Hard Drives, Operating System, Network, etc.)

## Subnet Management

Inline editing of subnet values for network port groups. Multi-CIDR support (comma-separated). Auto-guessing from VM IPs with "Guessed" tag. Stored in localStorage (`vcf-subnet-overrides`). Validation: `isValidCIDR()`, `isValidCIDRList()`, `parseCIDRList()` in `src/hooks/useSubnetOverrides.ts`.

## UI Layout Patterns

- **Equal-height tiles**: CSS Grid with `align-items: stretch` and `.cds--tile { height: 100% }`
- **Top-aligned tiles**: Flexbox with `align-items: flex-start`
- **Carbon Grid vertical spacing**: Use inline `style={{ marginBottom: '1rem' }}` on Column components (Carbon Grid doesn't auto-space rows)
- Carbon spacing: `spacing-05` = 1rem (16px), `spacing-07` = 2rem (32px)

## Reusable Components

- **FilterableVMTable** (`src/components/tables/FilterableVMTable.tsx`): VM table with ClickableTile filter bar, sorting, pagination. Props: `vms`, `filterKey`, `filterValue`, `filterOptions`, `onFilterChange`.
- **WaveVMTable** (`src/components/migration/WaveVMTable.tsx`): VMs by migration wave with wave selection tiles. Props: `waves`, `selectedWave`, `onWaveSelect`.