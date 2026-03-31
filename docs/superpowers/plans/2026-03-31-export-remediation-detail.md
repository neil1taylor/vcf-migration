# Export Remediation Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance DOCX and PPTX exports with per-OS remediation detail, migration partner scope, and client remediation responsibilities.

**Architecture:** Expose `additionalLinks` through the OS compatibility service layer, extract migration phases to a shared data file, enhance the DOCX OS Compatibility section with remediation subsections, add a new DOCX "Migration Scope & Remediation Plan" section, and add a PPTX remediation actions slide.

**Tech Stack:** TypeScript, docx library, pptxgenjs, Vitest

---

### Task 1: Expose `additionalLinks` in OS Compatibility Service

**Files:**
- Modify: `src/services/migration/osCompatibility.ts`

- [ ] **Step 1: Add `additionalLinks` to `VSIOSCompatibility` interface**

```typescript
// In src/services/migration/osCompatibility.ts, update the interface:
export interface VSIOSCompatibility {
  id: string;
  displayName: string;
  status: 'supported' | 'byol' | 'unsupported';
  imageType: 'stock' | 'custom' | 'none';
  notes: string;
  documentationLink?: string;
  eolDate?: string;
  additionalLinks?: Record<string, string>;
}
```

- [ ] **Step 2: Add `additionalLinks` to `ROKSOSCompatibility` interface**

```typescript
// In the same file, update ROKSOSCompatibility:
export interface ROKSOSCompatibility {
  id: string;
  displayName: string;
  patterns: string[];
  compatibilityStatus: 'fully-supported' | 'supported-with-caveats' | 'unsupported';
  compatibilityScore: number;
  notes: string;
  supportTier?: ROKSSupportTier;
  documentationLink?: string;
  recommendedUpgrade?: string;
  eolDate?: string;
  additionalLinks?: Record<string, string>;
}
```

- [ ] **Step 3: Map `additionalLinks` in `getVSIOSCompatibility()`**

In the `for` loop body that builds the return object, add:

```typescript
additionalLinks: (entry as { additionalLinks?: Record<string, string> }).additionalLinks,
```

- [ ] **Step 4: Map `additionalLinks` in `getROKSOSCompatibility()`**

In the `for` loop body that builds the return object, add:

```typescript
additionalLinks: (entry as { additionalLinks?: Record<string, string> }).additionalLinks,
```

- [ ] **Step 5: Run tests to verify no regressions**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -5`
Expected: All tests pass (the new optional field doesn't break anything).

- [ ] **Step 6: Commit**

```bash
git add src/services/migration/osCompatibility.ts
git commit -m "feat: expose additionalLinks in OS compatibility service"
```

---

### Task 2: Extract Migration Phases to Shared Data

**Files:**
- Create: `src/data/migrationPhases.ts`
- Modify: `src/services/export/pptx/sections/migrationExecutionSlide.ts`

- [ ] **Step 1: Create shared migration phases data file**

Create `src/data/migrationPhases.ts`:

```typescript
/** Migration execution phases — shared between DOCX and PPTX exports */
export interface MigrationPhase {
  heading: string;
  bullets: string[];
}

export const MIGRATION_PHASES: MigrationPhase[] = [
  {
    heading: 'Discover',
    bullets: [
      'Discover all VLANs, bare metals, VSIs, file/block storage, DNS, and security groups in IBM Cloud Classic',
      'Discover all ESXi hosts, vSphere clusters, NSX networking, vSAN/NFS datastores, and VM inventory',
    ],
  },
  {
    heading: 'Design & Configure',
    bullets: [
      'Design the target VPC environment (subnets, security groups, routing, transit gateways)',
      'Configure IAM policies, access groups, and service-to-service authorizations',
      'Translate NSX firewall rules and micro-segmentation to VPC security groups and ACLs',
      'Map source VLANs and port groups to target VPC subnets and address ranges',
      'Assess application readiness and dependency mapping for migration wave planning',
      'Reconcile Classic and VMware configurations into a unified target architecture',
    ],
  },
  {
    heading: 'Migration',
    bullets: [
      'Migrate bare metal and VSI workloads from Classic infrastructure to VPC',
      'Migrate SQL databases and application data with minimal downtime',
      'Migrate VMware Classic VMs to VPC VSIs using RackWare or similar tooling',
      'Migrate Classic VMware workloads to IBM Cloud for VMware as a Service (VCF as a Service)',
      'Map and validate infrastructure configurations (DNS, load balancers, certificates)',
      'Leverage IBM Migration Partner automation suite for repeatable, auditable migrations',
    ],
  },
];
```

- [ ] **Step 2: Update PPTX migration execution slide to import from shared data**

In `src/services/export/pptx/sections/migrationExecutionSlide.ts`, replace the inline `PHASES` constant:

```typescript
// Remove the inline PHASES constant (lines 7-37) and replace with:
import { MIGRATION_PHASES } from '@/data/migrationPhases';
```

Then update all references from `PHASES` to `MIGRATION_PHASES` in the `addMigrationExecutionSlide` function:
- Line `for (let i = 0; i < PHASES.length; i++)` → `for (let i = 0; i < MIGRATION_PHASES.length; i++)`
- Line `const phase = PHASES[i]` → `const phase = MIGRATION_PHASES[i]`

- [ ] **Step 3: Run tests to verify PPTX still works**

Run: `npx vitest run src/services/export/pptx/ --reporter=verbose 2>&1 | tail -10`
Expected: All PPTX tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/migrationPhases.ts src/services/export/pptx/sections/migrationExecutionSlide.ts
git commit -m "refactor: extract migration phases to shared data file"
```

---

### Task 3: Enhance DOCX OS Compatibility with Remediation Subsection

**Files:**
- Modify: `src/services/export/docx/sections/osCompatibility.ts`
- Modify: `src/services/export/docx/sections/osCompatibility.test.ts`

- [ ] **Step 1: Write failing tests for remediation subsection**

Add these tests to `src/services/export/docx/sections/osCompatibility.test.ts`:

```typescript
it('includes remediation subsection when unsupported OS VMs exist for VSI', () => {
  const vms = [
    makeVM({ vmName: 'legacy-vm', guestOS: 'Microsoft Windows Server 2003' }),
    makeVM({ vmName: 'modern-vm', guestOS: 'Red Hat Enterprise Linux 9' }),
  ];
  const rawData = makeRawData(vms);
  const result = buildOSCompatibilitySection(rawData, { includeROKS: false, includeVSI: true });

  // Should have more elements than a clean environment (remediation subsection added)
  const cleanResult = buildOSCompatibilitySection(
    makeRawData([makeVM({ guestOS: 'Red Hat Enterprise Linux 9' })]),
    { includeROKS: false, includeVSI: true },
  );
  expect(result.length).toBeGreaterThan(cleanResult.length);
});

it('includes remediation subsection when unsupported OS VMs exist for ROKS', () => {
  const vms = [
    makeVM({ vmName: 'legacy-vm', guestOS: 'Microsoft Windows Server 2003' }),
    makeVM({ vmName: 'modern-vm', guestOS: 'Red Hat Enterprise Linux 9' }),
  ];
  const rawData = makeRawData(vms);
  const result = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: false });

  const cleanResult = buildOSCompatibilitySection(
    makeRawData([makeVM({ guestOS: 'Red Hat Enterprise Linux 9' })]),
    { includeROKS: true, includeVSI: false },
  );
  expect(result.length).toBeGreaterThan(cleanResult.length);
});

it('does not include remediation subsection when all OSes are supported', () => {
  const vms = [
    makeVM({ vmName: 'vm-1', guestOS: 'Red Hat Enterprise Linux 9' }),
    makeVM({ vmName: 'vm-2', guestOS: 'Microsoft Windows Server 2022' }),
  ];
  const rawData = makeRawData(vms);
  const resultClean = buildOSCompatibilitySection(rawData, { includeROKS: true, includeVSI: true });

  // Compare with an unsupported-OS environment
  const vmsUnsupported = [
    ...vms,
    makeVM({ vmName: 'legacy-vm', guestOS: 'Microsoft Windows Server 2003' }),
  ];
  const resultUnsupported = buildOSCompatibilitySection(makeRawData(vmsUnsupported), { includeROKS: true, includeVSI: true });

  expect(resultUnsupported.length).toBeGreaterThan(resultClean.length);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/export/docx/sections/osCompatibility.test.ts --reporter=verbose 2>&1 | tail -15`
Expected: New tests FAIL (remediation subsection doesn't exist yet).

- [ ] **Step 3: Enhance `OSGroup` interface to carry remediation data**

In `src/services/export/docx/sections/osCompatibility.ts`, update the `OSGroup` interface:

```typescript
interface OSGroup {
  displayName: string;
  vmCount: number;
  status: string;
  notes: string;
  documentationLink?: string;
  additionalLinks?: Record<string, string>;
  eolDate?: string;
  recommendedUpgrade?: string;
}
```

Update `groupByOSFamily` to accept and pass through new fields:

```typescript
function groupByOSFamily<T>(
  vms: Array<{ guestOS: string }>,
  getCompat: (os: string) => T,
  getKey: (c: T) => string,
  getStatus: (c: T) => string,
  getNotes: (c: T) => string,
  getExtra?: (c: T) => Partial<Pick<OSGroup, 'documentationLink' | 'additionalLinks' | 'eolDate' | 'recommendedUpgrade'>>,
): OSGroup[] {
  const groups = new Map<string, OSGroup>();

  for (const vm of vms) {
    const compat = getCompat(vm.guestOS);
    const key = getKey(compat);
    const existing = groups.get(key);
    if (existing) {
      existing.vmCount++;
    } else {
      const extra = getExtra?.(compat) ?? {};
      groups.set(key, {
        displayName: key,
        vmCount: 1,
        status: getStatus(compat),
        notes: getNotes(compat),
        ...extra,
      });
    }
  }

  return [...groups.values()].sort((a, b) => b.vmCount - a.vmCount);
}
```

- [ ] **Step 4: Update VSI and ROKS grouping calls to pass extra fields**

For VSI:
```typescript
const vsiGroups = groupByOSFamily<VSIOSCompatibility>(
  poweredOnVMs,
  os => getVSIOSCompatibility(os),
  c => c.displayName,
  c => c.status === 'supported' ? 'Supported' : c.status === 'byol' ? 'BYOL' : 'Unsupported',
  c => c.notes,
  c => ({
    documentationLink: c.documentationLink,
    additionalLinks: c.additionalLinks,
    eolDate: c.eolDate,
  }),
);
```

For ROKS:
```typescript
const roksGroups = groupByOSFamily<ROKSOSCompatibility>(
  poweredOnVMs,
  os => getROKSOSCompatibility(os),
  c => c.displayName,
  c => c.compatibilityStatus === 'fully-supported' ? 'Fully Supported'
    : c.compatibilityStatus === 'supported-with-caveats' ? 'Supported (Caveats)'
    : 'Unsupported',
  c => c.notes,
  c => ({
    documentationLink: c.documentationLink,
    additionalLinks: c.additionalLinks,
    eolDate: c.eolDate,
    recommendedUpgrade: c.recommendedUpgrade,
  }),
);
```

- [ ] **Step 5: Add `buildRemediationSubsection` helper and integrate**

Add this helper function and the `ExternalHyperlink` import at the top of `osCompatibility.ts`:

```typescript
import { Paragraph, PageBreak, HeadingLevel, AlignmentType, ExternalHyperlink, TextRun } from 'docx';
// ... existing imports ...
import { STYLES, FONT_FAMILY } from '../types';
```

Add the helper:

```typescript
function buildRemediationSubsection(
  groups: OSGroup[],
  platformLabel: string,
): DocumentContent[] {
  const needsRemediation = groups.filter(g => g.status === 'Unsupported' || g.status === 'BYOL');
  if (needsRemediation.length === 0) return [];

  const items: DocumentContent[] = [
    createHeading('Remediation Required', HeadingLevel.HEADING_3),
    createParagraph(
      `The following operating systems require remediation before migration to ${platformLabel}. OS upgrades, re-platforming, and licence compliance activities are the client's responsibility to complete prior to migration. The Migration Partner will provide guidance and validate completion.`
    ),
  ];

  for (const group of needsRemediation) {
    items.push(
      createHeading(`${group.displayName} (${group.vmCount} VM${group.vmCount !== 1 ? 's' : ''})`, HeadingLevel.HEADING_4),
      createParagraph(group.notes),
    );

    if (group.eolDate) {
      items.push(createParagraph(`End of Life: ${group.eolDate}`));
    }

    if (group.recommendedUpgrade) {
      items.push(createParagraph(`Upgrade Path: ${group.recommendedUpgrade}`));
    }

    // Documentation links
    const links: { label: string; url: string }[] = [];
    if (group.documentationLink) {
      links.push({ label: 'Platform Documentation', url: group.documentationLink });
    }
    if (group.additionalLinks) {
      const linkLabels: Record<string, string> = {
        virtioDriverEOL: 'VirtIO Driver Status',
        microsoftLifecycle: 'Microsoft Lifecycle',
        ibmCloudEOSConsiderations: 'IBM Cloud EOS Considerations',
        vmCompatibilityChecker: 'Red Hat VM Compatibility Checker',
        vendorLifecycle: 'Vendor Lifecycle',
      };
      for (const [key, url] of Object.entries(group.additionalLinks)) {
        links.push({ label: linkLabels[key] || key, url });
      }
    }

    if (links.length > 0) {
      for (const link of links) {
        items.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: `${link.label}: `,
                size: STYLES.smallSize,
                color: STYLES.secondaryColor,
                font: FONT_FAMILY,
              }),
              new ExternalHyperlink({
                link: link.url,
                children: [
                  new TextRun({
                    text: link.url,
                    style: 'Hyperlink',
                    size: STYLES.smallSize,
                    color: STYLES.primaryColor,
                    underline: {},
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          })
        );
      }
    }
  }

  return items;
}
```

- [ ] **Step 6: Call `buildRemediationSubsection` after each platform table**

After the VSI table (after `createTableLabel('VSI OS Compatibility')`):

```typescript
sections.push(
  ...buildRemediationSubsection(vsiGroups, 'IBM Cloud VPC VSI'),
);
```

After the ROKS table (after `createTableLabel('ROKS OS Compatibility')`):

```typescript
sections.push(
  ...buildRemediationSubsection(roksGroups, 'ROKS / OpenShift Virtualization'),
);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/services/export/docx/sections/osCompatibility.test.ts --reporter=verbose 2>&1 | tail -15`
Expected: All tests pass including the new ones.

- [ ] **Step 8: Commit**

```bash
git add src/services/export/docx/sections/osCompatibility.ts src/services/export/docx/sections/osCompatibility.test.ts
git commit -m "feat: add OS remediation subsections to DOCX compatibility section"
```

---

### Task 4: Create DOCX "Migration Scope & Remediation Plan" Section

**Files:**
- Create: `src/services/export/docx/sections/remediationPlan.ts`
- Create: `src/services/export/docx/sections/remediationPlan.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/export/docx/sections/remediationPlan.test.ts`:

```typescript
// Remediation Plan Section Tests
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from 'vitest';
vi.mock('docx', () => ({
  Paragraph: class { constructor(public opts?: any) {} },
  PageBreak: class { constructor() {} },
  HeadingLevel: { HEADING_1: 'heading1', HEADING_2: 'heading2', HEADING_3: 'heading3', HEADING_4: 'heading4' },
  TextRun: class { constructor(public opts?: any) {} },
  Table: class { constructor(public opts?: any) {} },
  TableRow: class { constructor(public opts?: any) {} },
  TableCell: class { constructor(public opts?: any) {} },
  WidthType: { PERCENTAGE: 'pct' },
  AlignmentType: { LEFT: 'left', RIGHT: 'right', CENTER: 'center' },
  BorderStyle: { SINGLE: 'single' },
  ShadingType: { SOLID: 'solid' },
  Bookmark: class { constructor() {} },
  ExternalHyperlink: class { constructor(public opts?: any) {} },
}));

vi.mock('@/services/preflightChecks', () => ({
  runPreFlightChecks: vi.fn(() => []),
  derivePreflightCounts: vi.fn(() => ({
    vmsWithoutTools: 0, vmsWithoutToolsList: [],
    vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
    vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
    vmsWithRDM: 0, vmsWithRDMList: [],
    vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
    vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
    hwVersionOutdated: 0, hwVersionOutdatedList: [],
    vmsWithUnsupportedOS: 0, vmsWithUnsupportedOSList: [],
    vmsWithUnsupportedROKSOS: 0, vmsWithUnsupportedROKSOSList: [],
  })),
  CHECK_DEFINITIONS: [],
}));

vi.mock('@/services/migration', () => ({
  generateRemediationItems: vi.fn(() => []),
}));

import { buildRemediationPlanSection } from './remediationPlan';
import type { RVToolsData } from '@/types/rvtools';

function makeRawData(): RVToolsData {
  return {
    metadata: { fileName: 'test.xlsx', collectionDate: new Date(), vCenterVersion: '7.0', environment: 'test' },
    vInfo: [],
    vCPU: [], vMemory: [], vDisk: [], vPartition: [], vNetwork: [], vCD: [],
    vSnapshot: [], vTools: [], vCluster: [], vHost: [], vDatastore: [],
    vResourcePool: [], vLicense: [], vHealth: [], vSource: [],
  } as RVToolsData;
}

describe('buildRemediationPlanSection', () => {
  it('returns DocumentContent[] with migration partner scope', () => {
    const result = buildRemediationPlanSection(makeRawData(), 'vsi', 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes all three migration phases', () => {
    const result = buildRemediationPlanSection(makeRawData(), 'roks', 5);
    // Should have headings for Discover, Design & Configure, Migration
    expect(result.length).toBeGreaterThan(5);
  });

  it('includes client remediation section even when no blockers', () => {
    const result = buildRemediationPlanSection(makeRawData(), 'vsi', 5);
    // Should still have the section with "no remediation items identified" or similar
    expect(result.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/export/docx/sections/remediationPlan.test.ts --reporter=verbose 2>&1 | tail -10`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildRemediationPlanSection`**

Create `src/services/export/docx/sections/remediationPlan.ts`:

```typescript
// Migration Scope & Remediation Plan Section

import { Paragraph, PageBreak, HeadingLevel, ExternalHyperlink, TextRun, AlignmentType } from 'docx';
import type { DocumentContent } from '../types';
import { STYLES, FONT_FAMILY } from '../types';
import { MIGRATION_PHASES } from '@/data/migrationPhases';
import { runPreFlightChecks, derivePreflightCounts } from '@/services/preflightChecks';
import { generateRemediationItems } from '@/services/migration';
import type { RVToolsData } from '@/types/rvtools';
import type { MigrationMode } from '@/services/migration/osCompatibility';
import {
  createHeading,
  createParagraph,
  createBulletList,
  createStyledTable,
  createTableDescription,
  createTableLabel,
} from '../utils/helpers';

const MAX_AFFECTED_VMS = 10;

export function buildRemediationPlanSection(
  rawData: RVToolsData,
  leaning: string,
  sectionNum: number,
): DocumentContent[] {
  const s = sectionNum;
  let sub = 0;
  const nextSub = () => ++sub;

  const sections: DocumentContent[] = [
    createHeading(`${s}. Migration Scope & Remediation Plan`, HeadingLevel.HEADING_1),
    createParagraph(
      'This section outlines the Migration Partner\'s scope of work across three phases, followed by pre-migration remediation items that must be resolved by the client before migration can proceed.'
    ),
  ];

  // §X.1 Migration Partner Scope
  const scopeNum = nextSub();
  sections.push(
    createHeading(`${s}.${scopeNum} Migration Partner Scope`, HeadingLevel.HEADING_2),
    createParagraph(
      'The migration follows a structured three-phase approach. Each phase builds on the outputs of the previous stage to ensure a controlled, repeatable migration.'
    ),
  );

  for (const phase of MIGRATION_PHASES) {
    sections.push(
      createHeading(`Phase: ${phase.heading}`, HeadingLevel.HEADING_3),
      ...createBulletList(phase.bullets),
    );
  }

  // §X.2 Client Pre-Migration Remediation
  const remNum = nextSub();
  sections.push(
    createHeading(`${s}.${remNum} Client Pre-Migration Remediation`, HeadingLevel.HEADING_2),
    createParagraph(
      'The following items must be resolved by the client prior to Phase 3 (Migration). The Migration Partner will identify these items during Phase 1 (Discover) and provide guidance during Phase 2 (Design & Configure), but the client team is responsible for executing the remediation work (OS upgrades, snapshot cleanup, storage reconfiguration, etc.) on their source environment.'
    ),
  );

  // Run pre-flight checks
  const mode: MigrationMode = leaning === 'roks' ? 'roks' : 'vsi';
  const checkResults = runPreFlightChecks(rawData, mode);
  const counts = derivePreflightCounts(checkResults, mode);
  const includeAllChecks = mode === 'vsi';
  const items = generateRemediationItems(counts, mode, includeAllChecks);

  // Filter to blockers and warnings only
  const actionableItems = items.filter(
    item => !item.isUnverifiable && (item.severity === 'blocker' || item.severity === 'warning') && item.affectedCount > 0
  );

  if (actionableItems.length === 0) {
    sections.push(
      createParagraph(
        'No pre-migration remediation items were identified. All pre-flight checks passed for the selected migration target.'
      ),
    );
    sections.push(new Paragraph({ children: [new PageBreak()] }));
    return sections;
  }

  // §X.2.1 Remediation Summary Table
  sections.push(
    createHeading(`${s}.${remNum}.1 Remediation Summary`, HeadingLevel.HEADING_3),
    ...createTableDescription('Remediation Summary', 'Pre-migration remediation items requiring client action.'),
    createStyledTable(
      ['Check', 'Severity', 'Affected VMs', 'Remediation'],
      actionableItems.map(item => [
        item.name,
        item.severity === 'blocker' ? 'Blocker' : 'Warning',
        `${item.affectedCount}`,
        item.remediation.length > 100 ? item.remediation.substring(0, 97) + '...' : item.remediation,
      ]),
      { columnAligns: [AlignmentType.LEFT, AlignmentType.LEFT, AlignmentType.RIGHT, AlignmentType.LEFT] },
    ),
    createTableLabel('Remediation Summary'),
  );

  // §X.2.2 Detailed Remediation Actions
  sections.push(
    createHeading(`${s}.${remNum}.2 Detailed Remediation Actions`, HeadingLevel.HEADING_3),
  );

  for (const item of actionableItems) {
    const severityTag = item.severity === 'blocker' ? 'BLOCKER' : 'WARNING';
    sections.push(
      createHeading(
        `${item.name} — ${item.affectedCount} VM${item.affectedCount !== 1 ? 's' : ''} [${severityTag}]`,
        HeadingLevel.HEADING_4,
      ),
      createParagraph(item.description),
      createParagraph(`Remediation: ${item.remediation}`),
    );

    // Documentation link
    if (item.documentationLink) {
      sections.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({
              text: 'Documentation: ',
              size: STYLES.smallSize,
              bold: true,
              color: STYLES.secondaryColor,
              font: FONT_FAMILY,
            }),
            new ExternalHyperlink({
              link: item.documentationLink,
              children: [
                new TextRun({
                  text: item.documentationLink,
                  style: 'Hyperlink',
                  size: STYLES.smallSize,
                  color: STYLES.primaryColor,
                  underline: {},
                  font: FONT_FAMILY,
                }),
              ],
            }),
          ],
        }),
      );
    }

    // Affected VM names
    if (item.affectedVMs && item.affectedVMs.length > 0) {
      const displayVMs = item.affectedVMs.slice(0, MAX_AFFECTED_VMS);
      const vmBullets = displayVMs.map(vm => vm);
      if (item.affectedVMs.length > MAX_AFFECTED_VMS) {
        vmBullets.push(`...and ${item.affectedVMs.length - MAX_AFFECTED_VMS} more`);
      }
      sections.push(
        createParagraph('Affected VMs:'),
        ...createBulletList(vmBullets),
      );
    }
  }

  sections.push(new Paragraph({ children: [new PageBreak()] }));
  return sections;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/export/docx/sections/remediationPlan.test.ts --reporter=verbose 2>&1 | tail -10`
Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/export/docx/sections/remediationPlan.ts src/services/export/docx/sections/remediationPlan.test.ts
git commit -m "feat: add Migration Scope & Remediation Plan DOCX section"
```

---

### Task 5: Wire Remediation Plan into DOCX Orchestrator

**Files:**
- Modify: `src/services/export/docx/sections/index.ts`
- Modify: `src/services/export/docx/index.ts`

- [ ] **Step 1: Add export to barrel file**

In `src/services/export/docx/sections/index.ts`, add:

```typescript
export { buildRemediationPlanSection } from './remediationPlan';
```

- [ ] **Step 2: Import in orchestrator**

In `src/services/export/docx/index.ts`, add `buildRemediationPlanSection` to the imports from `'./sections'`:

```typescript
import {
  // ... existing imports ...
  buildRemediationPlanSection,
} from './sections';
```

- [ ] **Step 3: Add section to document flow**

In `src/services/export/docx/index.ts`, after the OS Compatibility section (line ~179) and before `buildMigrationOptions`, add:

```typescript
// §X Migration Scope & Remediation Plan
const remediationLeaning = finalOptions.platformSelection?.score?.leaning || 'vsi';
sections.push(...buildRemediationPlanSection(filteredRawData, remediationLeaning, sec.next()));
```

The resulting code should look like:

```typescript
sections.push(
  ...buildOSCompatibilitySection(filteredRawData, { includeROKS: finalOptions.includeROKS, includeVSI: finalOptions.includeVSI }, sec.next()),
);

// Migration Scope & Remediation Plan
const remediationLeaning = finalOptions.platformSelection?.score?.leaning || 'vsi';
sections.push(...buildRemediationPlanSection(filteredRawData, remediationLeaning, sec.next()));

sections.push(
  ...buildMigrationOptions(sec.next()),
);
```

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -5`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/export/docx/sections/index.ts src/services/export/docx/index.ts
git commit -m "feat: wire remediation plan section into DOCX report"
```

---

### Task 6: Add PPTX Remediation Actions Slide

**Files:**
- Modify: `src/services/export/pptx/sections/migrationStatsSlide.ts`

- [ ] **Step 1: Add `addRemediationActionsSlide` function**

At the bottom of `src/services/export/pptx/sections/migrationStatsSlide.ts`, add:

```typescript
export function addRemediationActionsSlide(
  pres: PptxGenJS,
  rawData: RVToolsData,
  leaning: string
): void {
  const mode: MigrationMode = leaning === 'roks' ? 'roks' : 'vsi';

  const checkResults = runPreFlightChecks(rawData, mode);
  const counts = derivePreflightCounts(checkResults, mode);
  const includeAllChecks = mode === 'vsi';
  const items = generateRemediationItems(counts, mode, includeAllChecks);

  // Filter to actionable items only
  const actionableItems = items.filter(
    item => !item.isUnverifiable && (item.severity === 'blocker' || item.severity === 'warning') && item.affectedCount > 0
  );

  if (actionableItems.length === 0) return;

  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Remediation Actions');

  // Blue subtitle
  slide.addText('Required actions before migration', {
    x: 1.33, y: 1.25, w: 24.0, h: 0.93,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  const headerOpts = {
    bold: true,
    fill: { color: COLORS.ibmBlue },
    color: COLORS.white,
    fontSize: 24,
    fontFace: FONTS.face,
    valign: 'middle' as const,
    align: 'left' as const,
  };

  const tableRows: PptxGenJS.TableRow[] = [];

  // Header row
  tableRows.push([
    { text: 'Check', options: headerOpts },
    { text: 'Severity', options: headerOpts },
    { text: 'VMs', options: headerOpts },
    { text: 'Remediation', options: headerOpts },
  ]);

  for (let i = 0; i < actionableItems.length; i++) {
    const item = actionableItems[i];
    const rowFill = i % 2 === 0 ? COLORS.white : COLORS.lightGray;
    const baseCellOpts = {
      fontSize: 21,
      fontFace: FONTS.face,
      color: COLORS.darkGray,
      fill: { color: rowFill },
      valign: 'middle' as const,
      align: 'left' as const,
    };

    const truncatedRemediation = item.remediation.length > 80
      ? item.remediation.substring(0, 77) + '...'
      : item.remediation;

    tableRows.push([
      { text: item.name, options: baseCellOpts },
      {
        text: item.severity === 'blocker' ? 'Blocker' : 'Warning',
        options: {
          fontSize: 21,
          fontFace: FONTS.face,
          color: COLORS.white,
          bold: true,
          fill: { color: severityFillColor(item.severity) },
          valign: 'middle' as const,
          align: 'center' as const,
        },
      },
      { text: `${item.affectedCount}`, options: { ...baseCellOpts, align: 'right' as const } },
      { text: truncatedRemediation, options: baseCellOpts },
    ]);
  }

  slide.addTable(tableRows, {
    x: 1.33,
    y: 2.67,
    w: 24.0,
    colW: [5.33, 3.33, 2.67, 12.67],
    border: { type: 'solid', pt: 0.5, color: COLORS.mediumGray },
    autoPage: false,
  });

  // Footer note
  slide.addText(
    'Remediation is the client\'s responsibility prior to migration. See detailed assessment report (DOCX) for full guidance.',
    {
      x: 1.33, y: 13.07, w: 24.0, h: 0.67,
      fontSize: 18,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      italic: true,
    },
  );
}
```

- [ ] **Step 2: Add required import for `MigrationMode`**

At the top of the file, add:

```typescript
import type { MigrationMode } from '@/services/migration/osCompatibility';
```

- [ ] **Step 3: Export `addRemediationActionsSlide` from sections barrel**

In `src/services/export/pptx/sections/index.ts`, add:

```typescript
export { addRemediationActionsSlide } from './migrationStatsSlide';
```

- [ ] **Step 4: Wire into PPTX orchestrator**

In `src/services/export/pptx/index.ts`, import `addRemediationActionsSlide` and call it after `addMigrationStatsSlide`:

Find where `addMigrationStatsSlide` is called and add immediately after:

```typescript
addRemediationActionsSlide(pres, rawData, leaning);
```

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -5`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/export/pptx/sections/migrationStatsSlide.ts src/services/export/pptx/sections/index.ts src/services/export/pptx/index.ts
git commit -m "feat: add PPTX remediation actions slide"
```

---

### Task 7: Update DOCX Integration Test

**Files:**
- Modify: `src/services/export/docx/index.test.ts`

- [ ] **Step 1: Add mock for remediation plan section**

In `src/services/export/docx/index.test.ts`, find where section builders are mocked (the `vi.mock('./sections', ...)` call) and add:

```typescript
buildRemediationPlanSection: vi.fn(() => []),
```

- [ ] **Step 2: Add mock for preflightChecks if not already present**

Check if `@/services/preflightChecks` is mocked. If not, add:

```typescript
vi.mock('@/services/preflightChecks', () => ({
  runPreFlightChecks: vi.fn(() => []),
  derivePreflightCounts: vi.fn(() => ({
    vmsWithoutTools: 0, vmsWithoutToolsList: [],
    vmsWithToolsNotRunning: 0, vmsWithToolsNotRunningList: [],
    vmsWithOldSnapshots: 0, vmsWithOldSnapshotsList: [],
    vmsWithRDM: 0, vmsWithRDMList: [],
    vmsWithSharedDisks: 0, vmsWithSharedDisksList: [],
    vmsWithLargeDisks: 0, vmsWithLargeDisksList: [],
    hwVersionOutdated: 0, hwVersionOutdatedList: [],
  })),
  CHECK_DEFINITIONS: [],
}));
```

- [ ] **Step 3: Run DOCX integration tests**

Run: `npx vitest run src/services/export/docx/index.test.ts --reporter=verbose 2>&1 | tail -10`
Expected: All tests pass.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -5`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/export/docx/index.test.ts
git commit -m "test: update DOCX integration test for remediation plan section"
```

---

### Task 8: Visual Verification

**Files:** None (verification only)

- [ ] **Step 1: Generate DOCX preview**

Run: `npm run preview:docx`

Open the generated DOCX and verify:
- OS Compatibility section has "Remediation Required" subsections for unsupported/BYOL OS entries
- Each remediation entry shows full notes, EOL date, upgrade path, clickable documentation links
- New "Migration Scope & Remediation Plan" section appears with:
  - Migration Partner Scope with three phases
  - Client Pre-Migration Remediation with summary table and detailed actions
  - Client responsibility language is clear

- [ ] **Step 2: Generate PPTX preview**

Run: `npm run preview:pptx`

Open the generated PPTX and verify:
- Migration Readiness slide still looks correct
- New Remediation Actions slide appears after it (if blockers/warnings exist)
- Color-coded severity, VM counts, truncated remediation text
- Footer note about client responsibility

- [ ] **Step 3: Run full test suite one final time**

Run: `npx vitest run --reporter=verbose 2>&1 | tail -5`
Expected: All tests pass.

- [ ] **Step 4: Commit any final adjustments**

If visual inspection reveals issues, fix and commit.
