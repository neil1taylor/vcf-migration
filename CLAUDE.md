# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Clarification and Planning

### Ask Questions Before Acting
- If requirements are ambiguous or incomplete, STOP and ask clarifying questions
- Don't make assumptions about implementation details
- Use the AskQuestions feature to gather necessary information before proceeding
- Better to ask upfront than to build the wrong thing

### When to Ask Questions
- Unclear requirements or acceptance criteria
- Multiple valid implementation approaches
- Missing information about:
  - Expected behavior or edge cases
  - Performance requirements
  - Integration points or dependencies
  - Data formats or validation rules
  - User experience preferences
- Ambiguous error handling strategies
- Uncertainty about project conventions or patterns

### What to Ask About
- **Scope**: What's in scope vs. out of scope for this task?
- **Constraints**: Are there performance, security, or compatibility requirements?
- **Dependencies**: What systems or services will this integrate with?
- **Edge Cases**: How should the system handle unusual inputs or error conditions?
- **Preferences**: Are there preferred libraries, patterns, or approaches?
- **Validation**: What constitutes success? How will we know it works?

### Planning Before Implementation
- After gathering requirements, propose a plan before coding
- Break down complex tasks into steps
- Identify potential challenges or risks upfront
- Confirm approach aligns with expectations

### Example Questions to Ask
- "Should this handle concurrent requests, or is single-threaded access acceptable?"
- "What should happen if the API call fails - retry, fallback, or error?"
- "Do you want this to follow the existing pattern in module X, or create a new approach?"
- "Should validation be strict (reject invalid data) or lenient (sanitize and accept)?"

## Decision-Making Framework

### Don't Assume - Verify
- When facing a choice between approaches, ask which is preferred
- If standard patterns exist in the codebase, confirm before deviating
- Check assumptions about data structures, formats, or protocols

### Propose Options
When multiple valid solutions exist:
1. Present 2-3 viable options
2. Explain tradeoffs of each
3. Recommend one with reasoning
4. Ask for preference before implementing

### Start Simple
- If requirements allow multiple complexity levels, start with simplest solution
- Ask before adding sophisticated features
- Validate the simple version works before enhancing

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
npm run update-pricing  # Update IBM Cloud pricing from Global Catalog (requires API key)
npm run update-all      # Update both profiles and pricing
```

## Testing Requirements

### Test-First Approach
- Always run existing tests before making changes to understand current behavior
- Write or update tests before implementing new features
- Run tests after each significant change to get immediate feedback
- Never consider a task complete without passing tests

### Test Execution Pattern
1. Run relevant test suite first to establish baseline
2. Make incremental changes
3. Re-run tests after each change
4. Fix failures immediately before proceeding
5. Add new tests for edge cases discovered during development

### Test Coverage Expectations
- All new functions must have corresponding tests
- Bug fixes must include regression tests
- Aim for testing both happy paths and error conditions
- Test boundary conditions and edge cases

### Feedback Loop
- Use test output to guide next steps
- Don't make assumptions - let tests verify behavior
- If tests fail, analyze output before making further changes
- Treat test failures as valuable information, not obstacles

### Language-Specific Commands

#### Python
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_module.py

# Run with verbose output
pytest -v

# Run with coverage
pytest --cov=src
```

#### JavaScript/TypeScript
```bash
# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- path/to/test.spec.js
```

#### Go
```bash
# Run all tests
go test ./...

# Run with verbose output
go test -v ./...

# Run specific package
go test ./pkg/mypackage
```

### When Tests Don't Exist
- Create minimal test cases before making changes
- Start with a simple smoke test to verify basic functionality
- Expand test coverage as you develop

### Continuous Verification
- After completing a feature, run the full test suite
- Verify tests pass in clean environment if possible
- Document any test requirements or setup needed

## UI Testing with Browser

### Browser Testing Requirements
- Test UI changes in an actual browser, not just by reading code
- Use Chrome for visual verification and interaction testing
- Verify responsive behavior at different screen sizes
- Test user interactions (clicks, form submissions, navigation)

### When to Use Browser Testing
- After implementing new UI components or pages
- When modifying CSS/styling
- After changing JavaScript interactions
- When fixing visual bugs
- Before marking UI tasks complete

### Browser Testing Workflow
1. Start the development server if not already running
2. Open Chrome and navigate to the relevant page
3. Interact with the UI to verify functionality
4. Test edge cases and error states
5. Check browser console for errors or warnings
6. Verify responsive design at different viewport sizes
7. Take screenshots if documenting behavior

### Testing Checklist
- [ ] Visual elements render correctly
- [ ] Interactive elements respond as expected
- [ ] Forms validate and submit properly
- [ ] Navigation works correctly
- [ ] No console errors or warnings
- [ ] Responsive layout works on different screen sizes
- [ ] Accessibility basics (keyboard navigation, labels)

### Browser Automation
For automated UI testing, use appropriate tools:
- Playwright for end-to-end testing
- Selenium for cross-browser testing
- Jest + Testing Library for component testing

### Visual Regression Testing
- Take screenshots of key UI states
- Compare before/after for visual changes
- Document any intentional visual differences

### Example Testing Commands

#### Start Dev Server
```bash
# Adjust based on your project
npm run dev
# or
python -m http.server 8000
# or
rails server
```

#### Run Browser-Based Tests
```bash
# Playwright
npx playwright test

# Selenium
pytest tests/ui/

# Cypress
npx cypress open
```

### Manual Testing Protocol
When opening browser manually:
1. Navigate to: [your local URL, e.g., http://localhost:3000]
2. Test the specific feature implemented
3. Verify related functionality still works
4. Check for console errors
5. Test on both desktop and mobile viewports
6. Report findings before proceeding

## Browser Interaction Guidelines

### Using Computer Tools for Browser Testing
- Can open Chrome browser using bash commands
- Can navigate to URLs and interact with pages
- Can capture screenshots for verification
- Can inspect elements and check console output

### Automated Browser Commands
```bash
# Open Chrome (macOS)
open -a "Google Chrome" http://localhost:3000

# Open Chrome (Linux)
google-chrome http://localhost:3000 &

# Capture screenshot with headless Chrome
google-chrome --headless --screenshot=output.png http://localhost:3000
```

### What to Verify in Browser
- Layout and positioning match design
- Colors, fonts, and spacing are correct
- Animations and transitions work smoothly
- Interactive states (hover, focus, active) display correctly
- Loading states and error messages appear appropriately
- Data displays correctly from API/backend



## Documentation

Document all changes, in the following:

- CLAUDE.md
- README.md

If adding new technologies then add these to TECHNOLOGIES.md. If the changes impact the user then the documentation in the application needs to be updated.

Add the changes, updates or fixes to the changelog. Only update the version if requested.

### User Guide

Comprehensive user documentation is available in two locations:

| Location | Purpose |
|----------|---------|
| `docs/USER_GUIDE.md` | Standalone markdown for version control and external reference |
| `/user-guide` route | In-app page (`src/pages/UserGuidePage.tsx`) with same content |

The User Guide covers:
- Quick start (5-step overview)
- Getting started and prerequisites
- Importing RVTools data
- Understanding the Dashboard
- Infrastructure analysis (Compute, Storage, Network, Clusters, Hosts, Resource Pools)
- Workload discovery
- VM management (exclude/include, workload overrides, notes)
- Migration assessment (ROKS and VSI)
- Wave planning
- Cost estimation
- Generating reports (PDF, Excel, Word, BOM, YAML, RackWare CSV)
- Reference documentation and glossary

## Architecture Overview

This is a React 18 + TypeScript + Vite application for VMware Cloud Foundation migration planning. It analyzes RVTools Excel exports and provides migration assessments for IBM Cloud ROKS (OpenShift) and VPC VSI targets.

### Key Architectural Patterns

**Data Flow:**
- RVTools Excel files are parsed client-side using SheetJS (`xlsx`)
- Parsed data flows through `DataContext` (React Context + useReducer) to all components
- Types defined in `src/types/rvtools.ts` model the RVTools sheet structure

**State Management:**
- `src/context/DataContext.tsx` - Global state for parsed RVTools data and analysis results
- `src/context/dataReducer.ts` - Reducer for state mutations
- Hooks in `src/hooks/` encapsulate complex logic (pricing, profiles, exports)

**VM Management:**
- `src/hooks/useVMOverrides.ts` - Manages VM exclusions, workload overrides, and notes with localStorage persistence
- `src/components/discovery/VMManagementTab.tsx` - Full VM listing with exclude/include, workload type, and notes
- `src/utils/vmIdentifier.ts` - VM identification and environment fingerprinting utilities

**IBM Cloud Integration:**
- `src/services/pricing/globalCatalogApi.ts` - Fetches live pricing via Code Engine proxy
- `src/services/ibmCloudProfilesApi.ts` - Fetches VSI/bare metal profiles via Code Engine proxy
- Proxies keep API credentials server-side (secure) and handle CORS
- Fallback static data in `src/data/ibmCloudConfig.json` when proxy unavailable

**Export Pipeline:**
- `src/services/export/` contains generators for different formats:
  - `bomXlsxGenerator.ts` - Excel BOM with formulas (uses ExcelJS)
  - `pdfGenerator.ts` - PDF reports (uses jsPDF)
  - `excelGenerator.ts` - Analysis workbooks
  - `docxGenerator.ts` - Word documents
  - `yamlGenerator.ts` - MTV YAML configs

### Key Directories

- `src/pages/` - Route components. Main pages: `ROKSMigrationPage.tsx`, `VSIMigrationPage.tsx`
- `src/components/` - Organized by feature: `charts/`, `sizing/`, `pricing/`, `tables/`, `export/`
- `src/services/` - Business logic: cost estimation, pricing APIs, export generation
- `src/data/` - Static JSON: IBM Cloud config, MTV requirements, OS compatibility matrices
- `src/types/` - TypeScript interfaces for RVTools data, MTV types, analysis results

### Path Alias

`@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`)

### UI Framework

IBM Carbon Design System (`@carbon/react`) - all UI components follow Carbon patterns.

## Environment Variables

```bash
VITE_PRICING_PROXY_URL=...      # Code Engine pricing proxy URL (for live pricing data)
VITE_PROFILES_PROXY_URL=...     # Code Engine profiles proxy URL (for live profile data)
VITE_AI_PROXY_URL=...           # Code Engine AI proxy URL (for watsonx.ai features)
VITE_AI_PROXY_API_KEY=...       # Shared secret for AI proxy authentication
```

Without proxy URLs configured, the app uses static data from `src/data/ibmCloudConfig.json`. Run `npm run update-all` to refresh static data before deployment.

## Updating IBM Cloud Data

The static fallback data in `src/data/ibmCloudConfig.json` can be updated with fresh data from IBM Cloud APIs.

### Update Scripts

```bash
# Set your IBM Cloud API key
export IBM_CLOUD_API_KEY=your-api-key

# Update profiles only (VSI specs, bare metal specs, ROKS support)
npm run update-profiles

# Update pricing only (hourly/monthly rates from Global Catalog)
npm run update-pricing

# Update both profiles and pricing
npm run update-all
```

### Profile Update Script (`scripts/update-profiles.ts`)

1. Authenticates with IBM Cloud IAM
2. Fetches VPC instance profiles from `GET /v1/instance/profiles`
3. Fetches VPC bare metal profiles from `GET /v1/bare_metal_server/profiles`
4. Fetches ROKS machine types from `GET /v2/getFlavors?provider=vpc-gen2`
5. **Auto-detects ROKS support** by matching bare metal profiles against ROKS machine types
6. Preserves existing pricing data (blockStorage, networking, regions, discounts, etc.)
7. Updates `src/data/ibmCloudConfig.json`

#### ROKS Support Detection

The script automatically determines which bare metal profiles support ROKS worker nodes:

```typescript
// Profiles returned by the Kubernetes Service API are ROKS-supported
const roksTypes = await fetch('/v2/getFlavors?zone=us-south-1&provider=vpc-gen2');

// Each bare metal profile is checked against this list
for (const profile of bareMetalProfiles) {
  profile.roksSupported = roksTypes.has(profile.name);
}
```

This data is used in the UI to show "ROKS" or "VPC Only" tags on bare metal profile cards.

#### ROKS Support Fallback

When the proxy doesn't return valid ROKS support data (i.e., no profiles have `roksSupported: true`), the `useDynamicProfiles` hook falls back to the static JSON configuration:

```typescript
// In transformProxyResponse() - src/hooks/useDynamicProfiles.ts
const proxyHasRoksData = proxyData.bareMetalProfiles.some(p => p.roksSupported === true);
if (!proxyHasRoksData) {
  // Fall back to static config for roksSupported values
  const staticRoksMap = getStaticRoksSupportMap();
  roksSupported = staticRoksMap.get(profile.name) ?? false;
}
```

This ensures the static JSON (`src/data/ibmCloudConfig.json`) remains the source of truth for ROKS support when the proxy's ROKS flavors API is unavailable.

### Pricing Update Script (`scripts/update-pricing.ts`)

1. Authenticates with IBM Cloud IAM
2. Fetches VSI pricing from Global Catalog API
3. Fetches Bare Metal pricing from Global Catalog API
4. Extracts hourly rates for us-south region
5. Calculates monthly rates (hourly × 730 hours)
6. Updates pricing in `src/data/ibmCloudConfig.json`
7. Preserves all other configuration (storage, networking, regions, etc.)

### Dynamic vs Static Data

- **Runtime (dynamic)**: The app fetches live data via `useDynamicProfiles()` and `useDynamicPricing()` hooks when proxy URLs are configured
- **Fallback (static)**: When proxy is unavailable, the app uses `src/data/ibmCloudConfig.json`
- **Update scripts**: Run `npm run update-all` to refresh static data before deployment

**Data Source Labels in UI:**
- **Live API** (green checkmark): Proxy confirmed available OR cached data from proxy (not expired)
- **Cache** (gray): Proxy confirmed unavailable OR using static bundled data

The label logic prioritizes user reassurance:
1. If proxy test succeeds → "Live API"
2. If proxy test fails → "Cache"
3. If proxy test was cancelled (e.g., React StrictMode cleanup) but we have valid cached proxy data → "Live API"
4. If using static bundled data → "Cache"

### Debugging Profile Data

Open browser DevTools Console to see detailed profile logs:
- `[IBM Cloud API] Bare Metal Profiles Summary` - Raw API data
- `[IBM Cloud API] ROKS Bare Metal Flavors` - ROKS machine types
- `[Dynamic Profiles] FINAL Bare Metal Profiles in App` - Merged profiles used by the app

## Custom Bare Metal Profiles

Maintainers can define custom bare metal profiles (e.g., on-premises hardware) in `src/data/ibmCloudConfig.json` under the `customBareMetalProfiles` top-level array. Custom profiles appear alongside standard IBM Cloud profiles in the ROKS Sizing Calculator.

### JSON Structure

```json
"customBareMetalProfiles": [
  {
    "name": "custom-metal-64x512",
    "tag": "On-Prem",
    "physicalCores": 32,
    "vcpus": 64,
    "memoryGiB": 512,
    "hasNvme": true,
    "nvmeDisks": 6,
    "nvmeSizeGiB": 3200,
    "totalNvmeGiB": 19200,
    "roksSupported": true,
    "hourlyRate": 0,
    "monthlyRate": 0,
    "useCase": "Custom on-premises bare metal",
    "description": "Custom - 32 cores, 512 GiB RAM, 6x3.2TB NVMe"
  }
]
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique profile name (used as identifier) |
| `tag` | No | Display label shown as a Carbon Tag in the UI (e.g., "On-Prem", "Lab"). Defaults to "Custom" |
| `physicalCores` | Yes | Number of physical CPU cores |
| `vcpus` | Yes | Number of vCPUs (threads) |
| `memoryGiB` | Yes | RAM in GiB |
| `hasNvme` | Yes | Whether the profile has local NVMe storage |
| `nvmeDisks` | Conditional | Number of NVMe disks (required if `hasNvme: true`) |
| `nvmeSizeGiB` | Conditional | Size per NVMe disk in GiB |
| `totalNvmeGiB` | Conditional | Total NVMe capacity in GiB |
| `roksSupported` | No | Set to `true` if this profile should be treated as ROKS-capable. Defaults to `false` |
| `hourlyRate` | No | Hourly cost in USD. If 0 or absent, cost estimation shows "Custom profile - no pricing available" |
| `monthlyRate` | No | Monthly cost in USD. If 0 or absent, cost estimation shows "Custom profile - no pricing available" |
| `useCase` | No | Short description of intended use |
| `description` | No | Longer description shown in cost estimation notes |

### UI Behavior

- Custom profiles appear in the Sizing Calculator profile dropdown with their `tag` value (e.g., `[On-Prem]`) instead of `[✓ ROKS]` / `[✗ VPC Only]`
- A purple Carbon Tag is shown in the profile details section
- Sort order: Standard ROKS profiles > Custom ROKS profiles > Standard non-ROKS > Custom non-ROKS
- Sizing calculations (node count, storage) work identically to standard profiles
- Cost estimation handles missing pricing gracefully (shows $0 with explanatory note)

### Custom Profiles and Dynamic Data

Custom profiles are always sourced from the static JSON configuration. They are never returned by the IBM Cloud profiles proxy. When proxy data is merged with static data, custom profiles are included automatically.

## Updating OS Compatibility Data

OS compatibility matrices are **manually maintained** (no automated scripts). Update when IBM Cloud or Red Hat changes supported OS versions.

### Data Files

| File | Purpose | Source |
|------|---------|--------|
| `src/data/ibmCloudOSCompatibility.json` | VPC VSI image support | [IBM Cloud VPC Images](https://cloud.ibm.com/docs/vpc?topic=vpc-about-images) |
| `src/data/redhatOSCompatibility.json` | ROKS/OpenShift Virtualization support | [Red Hat Certified Guest OS](https://access.redhat.com/articles/973163) |

### When to Update

- New OS versions released (e.g., RHEL 10, Ubuntu 26.04)
- OS reaches end-of-life
- IBM Cloud adds/removes stock images
- Red Hat updates OpenShift Virtualization compatibility matrix

### File Structure

**IBM Cloud VSI (`ibmCloudOSCompatibility.json`):**
```json
{
  "metadata": {
    "lastUpdated": "2025-01-22",
    "source": "https://cloud.ibm.com/docs/vpc?topic=vpc-about-images"
  },
  "osEntries": [
    {
      "id": "rhel-9",
      "displayName": "Red Hat Enterprise Linux 9.x",
      "patterns": ["red hat enterprise linux 9", "rhel 9", "rhel9"],
      "status": "supported",        // supported | byol | unsupported
      "imageType": "stock",         // stock | custom | none
      "notes": "IBM stock image available",
      "documentationLink": "...",
      "eolDate": "2036-05-31"       // optional
    }
  ]
}
```

**ROKS (`redhatOSCompatibility.json`):**
```json
{
  "osEntries": [
    {
      "id": "rhel-9",
      "displayName": "Red Hat Enterprise Linux 9.x",
      "patterns": ["red hat enterprise linux 9", "rhel 9"],
      "compatibilityStatus": "fully-supported",  // fully-supported | supported-with-caveats | unsupported
      "compatibilityScore": 100,
      "notes": "Optimal for OpenShift Virtualization",
      "recommendedUpgrade": null    // or target OS id
    }
  ]
}
```

### Update Process

1. Check the official documentation links above for changes
2. Edit the appropriate JSON file in `src/data/`
3. Update the `metadata.lastUpdated` field
4. Add new entries or modify existing ones:
   - Add patterns that match RVTools guest OS strings (case-insensitive)
   - Set appropriate status and notes
   - Include EOL dates where known
5. Test by uploading an RVTools file with affected OS types
6. Commit changes

### Pattern Matching

The `patterns` array contains lowercase strings matched against RVTools "Guest OS" field. Include common variations:
```json
"patterns": ["red hat enterprise linux 9", "rhel 9", "rhel9", "red hat 9"]
```

The service (`src/services/migration/osCompatibility.ts`) performs case-insensitive substring matching.

## Virtualization Overhead Configuration

OpenShift Virtualization (KubeVirt) resource overhead is configured in `src/data/virtualizationOverhead.json`. This data is used by the Sizing Calculator to account for additional resources required when running VMs.

### Overhead Calculation

Overhead is calculated using a **fixed + proportional** formula based on actual VM count and sizes:

| Type | Fixed (per VM) | Proportional | Formula |
|------|----------------|--------------|---------|
| CPU | 0.27 vCPU | 3% of guest vCPUs | `(VM Count × 0.27) + (Guest vCPUs × 3%)` |
| Memory | 378 MiB | 3% of guest RAM | `(VM Count × 378 MiB) + (Guest RAM × 3%)` |
| Storage | N/A | 15% (user adjustable) | `Base Storage × 1.15` |

### Configuration File Structure

```json
{
  "cpuOverhead": {
    "perVM": {
      "virtLauncher": { "value": 0.1, "unit": "vCPU" },
      "qemuBase": { "value": 0.1, "unit": "vCPU" },
      "ioThreads": { "value": 0.05, "unit": "vCPU" },
      "kubeletTracking": { "value": 0.02, "unit": "vCPU" }
    },
    "totalFixedPerVM": 0.27,
    "proportional": { "emulationOverhead": { "percent": 3 } }
  },
  "memoryOverhead": {
    "perVM": {
      "virtLauncherBase": { "value": 150, "unit": "MiB" },
      "libvirtDaemon": { "value": 50, "unit": "MiB" },
      "qemuFixed": { "value": 128, "unit": "MiB" },
      "kubeletOverhead": { "value": 50, "unit": "MiB" }
    },
    "totalFixedPerVM": 378,
    "totalProportionalPercent": 3
  },
  "systemReserved": { "cpu": 1, "memory": 4 },
  "odfReserved": {
    "base": { "cpu": 5, "memory": 21 },
    "perNvmeDevice": { "cpu": 2, "memory": 5 }
  }
}
```

### UI Integration

The Sizing Calculator (`src/components/sizing/SizingCalculator.tsx`) displays:
- **Storage overhead slider** (user adjustable, 0-25%)
- **CPU/Memory overhead info box** with link to reference page (auto-calculated, not user adjustable)
- **4-segment breakdown visualizations** showing: VM requirements, Virt overhead, ODF reserved, System reserved
- Both per-node and total cluster overhead in breakdown tooltips

### Overhead Reference Page

The `/overhead-reference` page (`src/pages/OverheadReferencePage.tsx`) displays:
- Detailed per-component values from the JSON file
- Calculation formulas with copyable code snippets
- ODF example calculations for 8 NVMe devices
- External reference links to Red Hat/KubeVirt documentation

### When to Update

- Red Hat changes OpenShift Virtualization architecture
- KubeVirt/QEMU resource requirements change
- New overhead components are identified
- Per-VM fixed values need adjustment based on production data

## AI Integration (watsonx.ai)

The application includes optional AI-powered features using IBM watsonx.ai via a Code Engine proxy.

### Architecture

```
  ┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
  │   Browser        │ ──────> │  Code Engine         │ ──────> │  IBM watsonx.ai │
  │   (Frontend)     │         │  AI Proxy            │         │  (Granite)      │
  │                  │ <────── │  (30-min cache)      │ <────── │                 │
  └─────────────────┘         └──────────────────────┘         └─────────────────┘
         │                              │
   VITE_AI_PROXY_URL            API Key + Project ID
   VITE_AI_PROXY_API_KEY        (server-side only)
```

### Key Files

| Directory | Purpose |
|-----------|---------|
| `functions/ai-proxy/` | Code Engine Express.js proxy (index.js, watsonx.js, prompts.js) |
| `src/services/ai/` | Client API, cache, context builder, types |
| `src/hooks/useAI*.ts` | React hooks (classification, rightsizing, insights, chat, settings, status) |
| `src/components/ai/` | UI components (AIInsightsPanel, ChatWidget, ChatPanel, AIStatusBadge) |
| `src/pages/ChatPage.tsx` | Full-page chat interface at `/chat` |
| `src/pages/SettingsPage.tsx` | Settings page with AI toggle, proxy status, cache management |

### AI Features

| Feature | Proxy Endpoint | Hook | Description |
|---------|---------------|------|-------------|
| Classification | `/api/classify` | `useAIClassification` | LLM workload detection with confidence |
| Right-sizing | `/api/rightsizing` | `useAIRightsizing` | AI profile recommendations |
| Insights | `/api/insights` | `useAIInsights` | Executive summary and risk assessment |
| Chat | `/api/chat` | `useAIChat` | Conversational assistant |

### Settings

- AI features are disabled by default
- Users enable AI via the Settings page at `/settings` (stored in localStorage as `vcf-ai-settings`)
- Consent notice shown on first enable explaining what data is sent
- All AI hooks check `useAISettings().settings.enabled` before making requests
- `useAIStatus` hook provides unified access to configuration, enablement, and proxy health state

### AI Availability Indicators

| Location | Indicator | Description |
|----------|-----------|-------------|
| SideNav | "Off" tag on AI Assistant link | When proxy configured but AI disabled |
| Chat Widget | Disabled button with tooltip | When proxy configured but AI disabled; fully hidden when unconfigured |
| AI Insights Panel | "AI Unavailable" tile with Settings link | When proxy configured but AI disabled; hidden when unconfigured |
| Workload VM Table | Purple "AI" tag in Source column | When AI classification was used for that VM |
| VSI Migration Page | Purple "AI" tag in Recommendation column | When AI rightsizing was used for that VM |
| Settings Page | Green "Connected" / Red "Unavailable" tag | Proxy connectivity status with test button |

### Data Privacy

- Only aggregated summaries sent (VM counts, resource totals, workload categories)
- Never sends individual VM names, IPs, or raw RVTools data
- Context builder (`chatContextBuilder.ts`) constructs safe summaries from DataContext

### Fallback Behavior

- Without AI proxy configured: AI components render nothing, hooks return empty data
- With proxy configured but unavailable: Falls back to rule-based logic, no errors shown to user
- With proxy configured and AI disabled in settings: Same as unconfigured

### Proxy Authentication

The AI proxy validates an `X-API-Key` header set via `VITE_AI_PROXY_API_KEY`. The `/health` endpoint is unauthenticated (used for connectivity checks).

### Caching

| Layer | TTL | Key |
|-------|-----|-----|
| Proxy (in-memory) | 30 min | Task type + input hash |
| Client (localStorage) | 24 hours | Environment fingerprint |

## Version Management

The application version and metadata are displayed on the About page (`/about`) and injected at build time.

### Version Configuration

Version info is sourced from `package.json` and injected via Vite's `define` option in `vite.config.ts`:

| Field | Source | Description |
|-------|--------|-------------|
| `__APP_VERSION__` | `package.json` version | Semantic version (e.g., "1.0.0") |
| `__APP_NAME__` | `package.json` name | Package name |
| `__APP_DESCRIPTION__` | `package.json` description | App description |
| `__APP_AUTHOR__` | `package.json` author | Author name |
| `__APP_LICENSE__` | `package.json` license | License type |
| `__BUILD_TIME__` | Generated at build | ISO timestamp of build |

TypeScript declarations for these globals are in `src/vite-env.d.ts`.

### Updating the Version

1. **Update version in `package.json`:**
   ```json
   {
     "version": "1.1.0"
   }
   ```

2. **Add changelog entry in `src/data/changelog.json`:**
   ```json
   {
     "releases": [
       {
         "version": "1.1.0",
         "date": "2026-02-15",
         "sections": {
           "added": ["New feature description"],
           "changed": ["Modified behavior description"],
           "fixed": ["Bug fix description"],
           "removed": ["Removed feature description"]
         }
       },
       // ... previous releases
     ]
   }
   ```

3. **Rebuild the application** - version is injected at build time

### Changelog Format

The changelog follows [Keep a Changelog](https://keepachangelog.com/) conventions:

| Section | Use For |
|---------|---------|
| `added` | New features |
| `changed` | Changes to existing functionality |
| `fixed` | Bug fixes |
| `removed` | Removed features |
| `deprecated` | Features marked for future removal |
| `security` | Security-related changes |

Only include sections that have entries for a given release.

### About Page

The About page (`src/pages/AboutPage.tsx`) displays:
- Application version and metadata
- Build timestamp
- Technology stack
- Changelog with expandable release notes
- Resource links to documentation

## Utilities

### Retry Logic (`src/utils/retry.ts`)

Provides exponential backoff retry for API calls:

```typescript
import { withRetry, isRetryableError } from '@/utils/retry';

// Basic usage
const data = await withRetry(() => fetchFromApi('/endpoint'), {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
});

// With custom retry conditions and callbacks
const result = await withRetry(fetchData, {
  retryableErrors: (error) => !error.message.includes('401'), // Don't retry auth errors
  onRetry: (error, attempt, delayMs) => {
    console.log(`Retry ${attempt} after ${delayMs}ms: ${error.message}`);
  },
});
```

### Logging (`src/utils/logger.ts`)

Standardized logging with module context:

```typescript
import { createLogger, parseApiError, getUserFriendlyMessage } from '@/utils/logger';

const logger = createLogger('MyModule');

logger.debug('Debug message', { context: 'value' });  // Only in dev
logger.info('Info message');
logger.warn('Warning message', { details: '...' });
logger.error('Error occurred', error, { operation: 'fetch' });

// Parse API errors for better messages
if (!response.ok) {
  const apiError = await parseApiError(response, 'Fetch profiles');
  throw new Error(apiError.message);
}

// Get user-friendly error messages
catch (error) {
  const message = getUserFriendlyMessage(error); // Handles CORS, auth, timeout, etc.
}
```

### Input Validation (`src/services/costEstimation.ts`)

Validation functions for cost estimation inputs:

```typescript
import {
  validateROKSSizingInput,
  validateVSISizingInput,
  validateRegion,
  validateDiscountType
} from '@/services/costEstimation';

const result = validateROKSSizingInput(input);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
  // errors: [{ field: 'computeNodes', message: 'Must be non-negative integer' }]
}
```

## Error Handling Patterns

### API Calls

All IBM Cloud API calls use retry logic with exponential backoff:
- Network errors, timeouts, and 5xx errors trigger retries
- Auth errors (401/403) fail immediately without retry
- AbortErrors are NOT retried (they indicate intentional cancellation, e.g., React StrictMode cleanup)
- CORS errors are detected and reported with helpful suggestions

### Silent Failure Prevention

Proxy test functions return detailed status:

```typescript
// testProxyConnection and testProfilesProxyConnection return:
{
  success: boolean,    // true if proxy responded with data
  error?: string,      // error message if failed
  cancelled?: boolean  // true if request was aborted (e.g., React StrictMode cleanup)
}
```

When `cancelled: true`, the hooks skip updating state to avoid false "unavailable" status during React's development mode double-invocation.

### Logging Standards

- Use `createLogger(moduleName)` for consistent log formatting
- `logger.error()` for failures that affect functionality
- `logger.warn()` for recoverable issues or fallbacks
- `logger.info()` for significant operations (API calls, cache updates)
- `logger.debug()` for detailed tracing (only shows in development)

## VM Management

The VM Management feature allows users to customize which VMs are included in migration analysis. It includes automatic exclusion of VMs that shouldn't be migrated, with user overrides.

### Auto-Exclusion

All auto-exclusion rules are **fully maintainer-configurable** in `src/data/workloadPatterns.json` under `autoExclusionRules`. There is no hardcoded exclusion logic — everything is driven by the JSON config.

Auto-exclusion is computed (deterministic from VM data) and never stored. Only user overrides are persisted.

#### Rule Types

**Field Rules** — match on VM properties:

```json
"fieldRules": [
  {
    "id": "template",
    "label": "Template",
    "field": "template",
    "value": true,
    "description": "VM is a template, not a running workload"
  },
  {
    "id": "powered-off",
    "label": "Powered Off",
    "field": "powerState",
    "operator": "notEquals",
    "value": "poweredOn",
    "description": "VM is not powered on"
  }
]
```

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `id` | Yes | Any string | Unique rule identifier (used in reasons array) |
| `label` | Yes | Any string | Shown as a magenta tag in the UI |
| `field` | Yes | Any VM property name | The VirtualMachine property to check |
| `operator` | No | `equals` (default), `notEquals` | Comparison operator |
| `value` | Yes | Any value | The value to compare against |

**Name Pattern Rules** — match on VM names:

```json
"namePatterns": [
  {
    "id": "vmware-vcls",
    "label": "VMware Infrastructure",
    "match": "startsWith",
    "patterns": ["vcls-", "vcls"],
    "description": "vCLS (vSphere Cluster Services) VMs"
  },
  {
    "id": "vmware-nsx-edge-regex",
    "label": "VMware Infrastructure",
    "match": "regex",
    "patterns": ["\\bedge[-_]?\\d", "t[01][-_]?edge"],
    "excludePatterns": ["cust-edge", "service-edge"],
    "description": "NSX edge patterns excluding network appliances"
  },
  {
    "id": "network-edge-appliance",
    "label": "Network Edge Appliance",
    "match": "contains",
    "patterns": ["cust-edge", "service-edge"],
    "description": "Network edge appliances (e.g., Cisco routers)"
  }
]
```

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `id` | Yes | Any string | Unique rule identifier |
| `label` | Yes | Any string | Shown as a magenta tag in the UI (deduplicated when multiple rules share a label) |
| `match` | Yes | `contains`, `startsWith`, `endsWith`, `exact`, `regex` | How to match patterns against the VM name |
| `patterns` | Yes | Array of strings | Patterns to match (case-insensitive). For `regex`, each is a JavaScript regex string |
| `excludePatterns` | No | Array of strings | If the VM name contains any of these, the rule does NOT match (case-insensitive) |

#### Default Rules

The shipped `workloadPatterns.json` includes rules for:

| Label | Rule IDs | Description |
|-------|----------|-------------|
| Template | `template` | Field rule: `template === true` |
| Powered Off | `powered-off` | Field rule: `powerState !== 'poweredOn'` |
| VMware Infrastructure | `vmware-nsx-edge`, `vmware-nsx-edge-regex`, `vmware-nsx-controller`, `vmware-usage-meter`, `vmware-vcls`, `vmware-vcenter` | NSX, vCLS, vCenter, and other VMware components |
| Windows AD/DNS | `windows-adns` | ADNSvcs* infrastructure servers |
| Network Edge Appliance | `network-edge-appliance` | cust-edge, service-edge network appliances |

#### Adding New Exclusion Rules

To exclude a new category of VMs, add an entry to `namePatterns` (or `fieldRules`) in `workloadPatterns.json`:

```json
{
  "id": "my-custom-rule",
  "label": "My Custom Label",
  "match": "contains",
  "patterns": ["pattern1", "pattern2"],
  "description": "Why these VMs are excluded"
}
```

The label appears as a magenta tag in the UI. No code changes required.

### Three-Tier Exclusion Model

For any VM, the effective exclusion state is resolved in priority order:

1. **User force-included** (`forceIncluded: true` in overrides) -> **INCLUDED** regardless of auto-rules
2. **User manually excluded** (`excluded: true` in overrides) -> **EXCLUDED**
3. **Auto-exclusion rule matches** (template, powered-off, VMware infra) -> **AUTO-EXCLUDED**
4. **Default** -> **INCLUDED**

### Features

| Feature | Description |
|---------|-------------|
| **Auto-Exclusion** | Templates, powered-off VMs, and VMware infrastructure VMs are automatically excluded |
| **Force-Include** | Override auto-exclusion to include specific VMs in migration scope |
| **Exclude/Include VMs** | Manually exclude/include VMs from migration scope |
| **Bulk Operations** | Select multiple VMs and exclude/include in one action |
| **Status Filter** | Filter VM list by: All, Included, Auto-Excluded, Manually Excluded, Overridden |
| **Workload Type Override** | Override auto-detected workload types or set custom types |
| **Notes** | Add user notes per VM for migration planning |
| **Persistence** | All customizations saved to localStorage |
| **Export/Import** | Share settings as JSON between sessions or users |

### Key Files

| File | Purpose |
|------|---------|
| `src/utils/autoExclusion.ts` | Pure utility for auto-exclusion logic (rules, map computation) |
| `src/hooks/useAutoExclusion.ts` | React hook wrapping auto-exclusion utility |
| `src/hooks/useVMOverrides.ts` | Hook for managing VM overrides with localStorage persistence |
| `src/components/discovery/VMManagementTab.tsx` | VMs tab component with DataTable |
| `src/utils/vmIdentifier.ts` | VM identification and environment fingerprinting |

### VM Identification

VMs are identified using a composite key to handle cases where UUID may not be available:

```typescript
// With UUID (preferred)
`${vmName}::${uuid}`

// Without UUID (fallback)
`${vmName}::${datacenter}::${cluster}`
```

### Environment Fingerprinting

Each RVTools export contains identifying information about its source vCenter. A fingerprint is calculated and stored with overrides:

```typescript
function getEnvironmentFingerprint(data: RVToolsData): string {
  const server = data.vSource[0]?.server || 'unknown';
  const instanceUuid = data.vSource[0]?.instanceUuid || '';
  const clusters = data.vCluster.map(c => c.name).sort().join(',');
  return `${server}::${instanceUuid}::${clusters}`;
}
```

**Sync behavior:**

| Scenario | Behavior |
|----------|----------|
| Same RVTools file reloaded | Overrides apply automatically |
| Updated export from same vCenter | Overrides apply automatically |
| Export from different vCenter | Warning shown with options to apply, clear, or export |

### Storage Key

VM overrides are stored in localStorage under the key `vcf-vm-overrides`.

### Data Structure

```typescript
interface VMOverridesData {
  version: number;  // Currently version 2
  environmentFingerprint: string;
  overrides: Record<string, VMOverride>;
  createdAt: string;
  modifiedAt: string;
}

interface VMOverride {
  vmId: string;
  vmName: string;
  excluded: boolean;
  forceIncluded?: boolean;  // Override auto-exclusion
  workloadType?: string;    // Custom or predefined category
  notes?: string;
  modifiedAt: string;
}
```

### Integration with Migration Pages

The VSI and ROKS migration pages use the unified three-tier exclusion filter:

```typescript
// In VSIMigrationPage.tsx and ROKSMigrationPage.tsx
const allVmsRaw = useAllVMs();
const vmOverrides = useVMOverrides();
const { getAutoExclusionById } = useAutoExclusion();

const vms = useMemo(() => {
  return allVmsRaw.filter(vm => {
    const vmId = getVMIdentifier(vm);
    const autoResult = getAutoExclusionById(vmId);
    return !vmOverrides.isEffectivelyExcluded(vmId, autoResult.isAutoExcluded);
  });
}, [allVmsRaw, vmOverrides, getAutoExclusionById]);
```

### Workload Types

Users can select from predefined workload types (from `workloadPatterns.json`) or type custom values:

- **Predefined**: Databases, Middleware, Web, Enterprise Applications, etc.
- **Custom**: Any user-defined string (e.g., "Legacy Finance App", "SAP HANA")
- **Unclassified**: Clears the override and reverts to auto-detection

## Workload Discovery

The Discovery page (`src/pages/DiscoveryPage.tsx`) provides a unified single-page layout for workload detection, VM categorization, and migration scope management.

### Page Layout

```
Discovery Page (single page — no tabs)
├── Title + Subtitle
├── Metric Cards Row (4 cards)
│   ├── Total VMs (with excluded count)
│   ├── Classified VMs (count + workload types detected)
│   ├── Unclassified VMs (need attention)
│   └── VMs in Scope (included in migration)
│
├── Chart + Info Row (2 columns)
│   ├── Left: "Detected Workloads by Type" horizontal bar chart
│   │   └── Clickable bars → set workload type filter on table below
│   └── Right: Workload type description tile
│       └── Shows description of selected workload type (or detection method overview when none selected)
│
├── Unified VM Table (DiscoveryVMTable)
│   ├── Workload type filter bar (ClickableTiles — each type with count + "Unclassified")
│   │   └── Synced with chart clicks
│   ├── Status filter dropdown (All / Included / Auto-Excluded / Manually Excluded / Overridden)
│   ├── Search bar + Bulk actions (Exclude / Include)
│   ├── Columns: VM Name | Cluster | vCPUs | Memory | Storage | Workload Type | Status | Notes | Actions
│   └── Actions per row: Toggle exclusion, Edit workload type, Edit notes
│
├── Detection Patterns accordion (collapsed by default)
│
└── Export/Import toolbar (Export CSV, Export/Import overrides JSON)
```

### Classification Precedence (User > Maintainer > AI > Rule)

Each VM is classified by at most one source, following strict precedence:

1. **User override** (highest priority): If the user set a workload type via the UI, it takes effect with a cyan `User` tag. Can override everything.
   - If it maps to a standard workload type (e.g., "Databases") → classified under that type
   - If it's a custom string (e.g., "Windows AD/DNS") → classified as `_custom`
2. **Maintainer authoritative** (second priority): Classifications defined in `authoritativeClassifications` in `workloadPatterns.json`. AI **cannot** override these. Shown with a teal `Maintainer` tag.
3. **AI classification** (third priority): When AI is available, it overrides pattern matching for VMs not pinned by maintainer rules.
4. **Rule-based detection** (fallback): Pattern matching from `categories` in `workloadPatterns.json` — used when AI is not available.

Classification and auto-exclusion are **independent**. A VM can be classified as "Network Equipment" (via `authoritativeClassifications`) AND auto-excluded from migration (via `autoExclusionRules`) at the same time.

Each VM has exactly one workload type. The merge logic uses a 4-pass approach with a `classifiedVMs` set to prevent duplicates.

### Chart ↔ Table Interaction

The chart and table are linked via a shared `selectedCategory` state:
- Clicking a chart bar filters the table to that workload type
- Clicking the same bar again clears the filter
- Workload type filter tiles below the chart sync with chart selection
- An "Unclassified" tile shows VMs not yet categorized

### Key Files

| File | Purpose |
|------|---------|
| `src/pages/DiscoveryPage.tsx` | Main page with unified single-page layout |
| `src/components/discovery/DiscoveryVMTable.tsx` | Unified VM table merging VMManagementTab + WorkloadVMTable features |
| `src/data/workloadPatterns.json` | Workload type definitions, authoritative classifications, and auto-exclusion rules |
| `src/components/discovery/VMManagementTab.tsx` | Legacy VM management table (retained for reference) |
| `src/components/discovery/WorkloadVMTable.tsx` | Legacy workload table (retained for reference) |

## Subnet Management

The Subnet Management feature allows users to override auto-guessed subnet values for network port groups.

### Features

| Feature | Description |
|---------|-------------|
| **Inline Editing** | Click subnet cell in Network Summary table to edit |
| **Multi-CIDR Support** | Enter comma-separated CIDRs (e.g., "10.0.1.0/24, 10.0.2.0/24") |
| **Auto-Guessing** | System detects subnet prefixes from VM IP addresses |
| **Guessed Tag** | Shows "Guessed" tag only for auto-detected values, not manual entries |
| **Persistence** | Manual entries saved to localStorage |
| **Validation** | CIDR format validation with user feedback |

### Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useSubnetOverrides.ts` | Hook for managing subnet overrides with localStorage persistence |
| `src/hooks/useSubnetOverrides.test.ts` | Unit tests for the hook |
| `src/pages/NetworkPage.tsx` | Network page with inline subnet editing |
| `src/pages/NetworkPage.scss` | Styles for editable cells and hover effects |

### CIDR Validation Functions

```typescript
import { isValidCIDR, isValidCIDRList, parseCIDRList } from '@/hooks/useSubnetOverrides';

// Single CIDR validation
isValidCIDR('10.0.1.0/24');  // true
isValidCIDR('256.0.0.0/24'); // false (invalid octet)

// Multiple CIDRs validation (comma-separated)
isValidCIDRList('10.0.1.0/24, 10.0.2.0/24');  // true
isValidCIDRList('10.0.1.0/24,');               // false (trailing comma)

// Parse CIDR list to array
parseCIDRList('10.0.1.0/24, 10.0.2.0/24');  // ['10.0.1.0/24', '10.0.2.0/24']
```

### Storage Key

Subnet overrides are stored in localStorage under the key `vcf-subnet-overrides`.

### Data Structure

```typescript
interface SubnetOverridesData {
  version: number;
  overrides: Record<string, SubnetOverride>;
  createdAt: string;
  modifiedAt: string;
}

interface SubnetOverride {
  portGroup: string;  // Primary key
  subnet: string;     // CIDR notation (single or comma-separated)
  modifiedAt: string;
}
```

## UI Layout Terminology

When describing layout requirements, use these standard terms for clarity:

| Requirement | Description |
|-------------|-------------|
| **Equal-height tiles per row** | Cards/tiles in the same row should stretch to match the tallest one |
| **Top-aligned tiles** | Cards start at the same vertical position but maintain their natural height |
| **Same-width columns** | Columns should be equal width (use `grid-template-columns: 1fr 1fr`) |
| **Responsive stacking** | Columns stack vertically on mobile/small screens |
| **Vertical row spacing** | Space between rows of content in Carbon Grid layouts |

### CSS Patterns

**Equal-height tiles (CSS Grid):**
```scss
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: stretch; // Equal-height tiles per row
  gap: 1rem;

  .cds--tile {
    height: 100%; // Tiles fill grid cell
  }
}
```

**Top-aligned tiles (Flexbox):**
```scss
.settings-row {
  display: flex;
  align-items: flex-start; // Top-aligned, natural height
  gap: 1rem;
}
```

### Carbon Grid Vertical Spacing

Carbon Grid doesn't automatically add vertical spacing between rows. Use one of these approaches:

**Option 1: Inline margin on Column components (Recommended for pages with mixed layouts)**
```tsx
<Column lg={8} md={8} sm={4} style={{ marginBottom: '1rem' }}>
  <Tile>Content</Tile>
</Column>
```

**Option 2: SCSS targeting column classes (For consistent page-wide spacing)**
```scss
.my-page {
  // Target Carbon's column classes
  :global {
    .cds--css-grid-column,
    [class*='cds--col'] {
      margin-bottom: spacing.$spacing-05;
    }
  }
}
```

**Option 3: Margin on content elements (For specific elements)**
```scss
.my-page {
  &__tile {
    margin-bottom: spacing.$spacing-05;
  }
}
```

**Important Notes:**
- `height: 100%` on tiles can interfere with margin-based spacing
- When using `height: 100%` for equal-height rows, prefer Option 1 (inline margin on Column)
- Carbon spacing tokens: `spacing-05` = 1rem (16px), `spacing-07` = 2rem (32px)

## Reusable Components

### FilterableVMTable

A reusable component for displaying VMs filtered by a selected entity (cluster, datastore, etc.).

**Location:** `src/components/tables/FilterableVMTable.tsx`

**Props:**
```typescript
interface FilterableVMTableProps {
  vms: VMInfo[];
  filterKey: string;           // Property name to filter by (e.g., 'cluster')
  filterValue: string | null;  // Selected filter value
  filterOptions: string[];     // Available filter options
  onFilterChange: (value: string | null) => void;
  title?: string;
  subtitle?: string;
}
```

**Usage:**
```tsx
<FilterableVMTable
  vms={vms}
  filterKey="cluster"
  filterValue={selectedCluster}
  filterOptions={clusterNames}
  onFilterChange={setSelectedCluster}
  title="Virtual Machines"
  subtitle="Click a cluster to filter"
/>
```

**Features:**
- ClickableTile filter bar with "All" option
- EnhancedDataTable with sorting and pagination
- Columns: VM Name, Power State, vCPUs, Memory, Storage, Guest OS
- Consistent styling across Clusters and Storage pages

### WaveVMTable

A component for displaying VMs organized by migration wave with interactive wave selection.

**Location:** `src/components/migration/WaveVMTable.tsx`

**Props:**
```typescript
interface WaveVMTableProps {
  waves: WaveGroup[];
  selectedWave: string | null;
  onWaveSelect: (name: string | null) => void;
}
```

**Features:**
- ClickableTile wave filter bar
- "All" option shows all VMs across all waves
- DataTable with VM details: Name, Cluster, vCPUs, Memory, Storage, Complexity, Blockers
- Visual indicators for blocker status
