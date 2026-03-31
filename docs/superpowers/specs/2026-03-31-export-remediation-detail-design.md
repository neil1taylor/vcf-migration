# Export Remediation Detail — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Enhance DOCX and PPTX exports with per-OS remediation detail, upgrade paths, EOL dates, and documentation links

## Problem

The app identifies migration blockers (unsupported OS, RDM disks, missing VMware Tools, etc.) and has rich remediation data — upgrade paths, EOL dates, documentation links, VirtIO driver status. But the DOCX and PPTX exports only show summary counts and short labels. A stakeholder reading the report can't see *which* OS versions are affected, *why* they're blocked, *what to do*, or *where to go* for more info.

## Design

### 1. Data Layer: Expose `additionalLinks`

The `additionalLinks` field exists in both OS compatibility JSON files but isn't mapped through the TypeScript service layer.

**Changes to `src/services/migration/osCompatibility.ts`:**

- Add `additionalLinks?: Record<string, string>` to `VSIOSCompatibility` interface
- Add `additionalLinks?: Record<string, string>` to `ROKSOSCompatibility` interface
- Map the field through in `getVSIOSCompatibility()` and `getROKSOSCompatibility()`

### 2. DOCX: Enhance OS Compatibility Section

**File:** `src/services/export/docx/sections/osCompatibility.ts`

**2a. Add "Remediation Required" subsection** below each platform table (VSI and ROKS). Only appears if unsupported or BYOL entries exist. Opens with a note that OS remediation (upgrades, re-platforming) must be completed by the client prior to migration. For each affected OS family:

- OS display name, affected VM count, status
- Full notes text (not truncated — the 60-char ROKS truncation stays in the summary table but full text appears here)
- EOL date (if available)
- Upgrade path (`recommendedUpgrade` for ROKS; derived action text for VSI)
- Documentation links as clickable hyperlinks — primary `documentationLink` plus all `additionalLinks` entries with descriptive labels

**Data flow:** The existing `groupByOSFamily` function groups VMs by OS. Enhance the group interface to carry through `documentationLink`, `additionalLinks`, `eolDate`, and `recommendedUpgrade` from the compatibility result. Filter to only unsupported/BYOL groups for the remediation subsection.

### 3. DOCX: New "Pre-Migration Remediation Plan" Section

**New file:** `src/services/export/docx/sections/remediationPlan.ts`

A consolidated section covering ALL blocker types (not just OS). Appears after Migration Readiness in the document.

**Structure:**

```
§X. Pre-Migration Remediation Plan

  Introduction paragraph — states that remediation items identified in this
  section are the CLIENT's responsibility to complete prior to migration.
  The migration partner will provide guidance and validate completion, but
  the client team must execute the remediation work (OS upgrades, snapshot
  cleanup, storage reconfiguration, etc.) on their source environment.

  §X.1 Remediation Summary
    Table: Check Name | Severity | Affected VMs | Remediation Action
    One row per blocker/warning from RemediationItem[] (skip passed/info/success)

  §X.2 Detailed Remediation Actions
    For each blocker/warning item with affectedCount > 0:
      Heading 3: "{Check Name} ({N} VMs)"
      Paragraph: description
      Paragraph: "Remediation: " + remediation text
      Paragraph: "Documentation: " + clickable hyperlink (if documentationLink present)
      Bullet list: affected VM names (capped at 10, "and X more..." if overflow)
```

**Data source:** Calls `runPreFlightChecks()` and `derivePreflightCounts()` from the shared preflight service, then `generateRemediationItems()` — same pipeline the PPTX slide and UI use. Mode determined by platform leaning.

**Integration:** Add to the DOCX orchestrator (`src/services/export/docx/index.ts`) as a new section, positioned after Migration Readiness. Section numbering follows the existing auto-numbering pattern.

### 4. PPTX: Add Remediation Actions Slide

**File:** `src/services/export/pptx/sections/migrationStatsSlide.ts`

Add a second slide after the existing Migration Readiness slide. Only generated if there are blockers or warnings.

**"Remediation Actions" slide:**

- Title: "Remediation Actions"
- Subtitle: "Required actions before migration"
- Table columns: **Check** | **Severity** | **VMs** | **Remediation**
- Only blocker and warning items (filter out passed/info/success/unverifiable)
- Severity column color-coded same as existing slide (red for blocker, orange for warning)
- Remediation text truncated to ~80 chars to fit the slide
- Footer note: *"Remediation is the client's responsibility prior to migration. See detailed assessment report (DOCX) for full guidance."*
- If no blockers/warnings exist, skip the slide entirely

## Files Changed

| File | Change |
|------|--------|
| `src/services/migration/osCompatibility.ts` | Add `additionalLinks` to interfaces and mapping |
| `src/services/export/docx/sections/osCompatibility.ts` | Add "Remediation Required" subsection with per-OS detail and links |
| `src/services/export/docx/sections/remediationPlan.ts` | **New file** — consolidated remediation plan section |
| `src/services/export/docx/sections/index.ts` | Export new section builder |
| `src/services/export/docx/index.ts` | Wire in remediation plan section |
| `src/services/export/pptx/sections/migrationStatsSlide.ts` | Add remediation actions slide |

## Testing

- Existing tests should continue to pass (no breaking changes to existing interfaces)
- New tests for `remediationPlan.ts` section builder
- Update DOCX integration test to verify new section is included
- Update PPTX test to verify remediation slide generation
- Verify with `npm run preview:docx` for visual inspection

## Out of Scope

- Changing the UI RemediationPanel (already shows this detail)
- Modifying the Excel/PDF export formats
- Adding remediation to the YAML export
