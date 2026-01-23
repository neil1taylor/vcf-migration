# Todo

## Feature Enhancements

### 10. Scenario Management & Comparison

**Current Gap:** No ability to save, load, or compare migration scenarios. Users must manually track different analysis runs.

**Proposed Implementation:**
- Create `src/services/scenarios/` with scenario CRUD operations
- Add localStorage persistence with versioning (fallback to IndexedDB for larger datasets)
- Build comparison dashboard showing side-by-side: cost differences, resource allocation, wave strategies
- Support scenario templates: "Cost-optimized", "Performance-optimized", "Network-optimized"
- Export comparison reports with recommendations

**Key Components:**
- `useScenarioManager.ts` hook - save/load/delete/compare operations
- `ScenarioSelector.tsx` - dropdown to switch active scenario
- `ScenarioComparison.tsx` - side-by-side comparison view
- `scenarioStorage.ts` - persistence layer with versioning

**Effort:** Medium (3-4 days) | **Impact:** High

---

### 11. Remediation Workflow Tracking

**Current Gap:** Remediation items are informational only. No tracking of which fixes have been addressed.

**Proposed Implementation:**
- Add status field to RemediationItem: `'pending' | 'in_progress' | 'addressed' | 'skipped'`
- Store remediation status in localStorage with timestamps and notes
- Show progress indicators (e.g., "5/12 blockers addressed")
- Generate remediation progress reports for stakeholders
- Allow attaching evidence/notes to each remediation item

**Key Components:**
- `useRemediationTracking.ts` hook - status updates and persistence
- `RemediationChecklist.tsx` - interactive checklist with status toggles
- `RemediationProgressReport.tsx` - exportable progress summary
- Update `RemediationPanel.tsx` to show tracking controls

**Data Structure:**
```typescript
interface RemediationStatus {
  itemId: string;
  status: 'pending' | 'in_progress' | 'addressed' | 'skipped';
  notes?: string;
  updatedAt: string;
  updatedBy?: string;
}
```

**Effort:** Low-Medium (2-3 days) | **Impact:** Medium

---

### 12. Wave Planning Persistence & Import

**Current Gap:** Wave plans are ephemeral - recalculated on each page load. No import for saved plans.

**Proposed Implementation:**
- Add localStorage persistence for wave configurations with save/load UI
- Support manual wave editing (move VMs between waves, rename waves, add descriptions)
- Create wave plan manager with version history
- Import previously-exported YAML wave plans as starting point
- Compare different wave planning strategies side-by-side

**Key Components:**
- `useWavePlanPersistence.ts` hook - save/load/versioning
- `WavePlanManager.tsx` - list of saved wave plans with CRUD
- `WaveEditor.tsx` - drag-and-drop VM reassignment between waves
- Update `yamlGenerator.ts` to support import (parse YAML back to wave structure)

**Wave Plan Schema:**
```typescript
interface SavedWavePlan {
  id: string;
  name: string;
  createdAt: string;
  mode: 'complexity' | 'network';
  waves: Wave[];
  notes?: string;
  tags?: string[];
}
```

**Effort:** Medium (3-4 days) | **Impact:** High

---

### 13. Custom Profile Validation & Families

**Current Gap:** Custom profiles don't validate CPU:memory ratios against profile family standards.

**Proposed Implementation:**
- Add profile family selection (Balanced/Compute/Memory) with ratio enforcement:
  - Balanced (bx2): 1:4 ratio (e.g., 4 vCPU = 16 GB)
  - Compute (cx2): 1:2 ratio (e.g., 4 vCPU = 8 GB)
  - Memory (mx2): 1:8 ratio (e.g., 4 vCPU = 32 GB)
- Warn if custom profile closely matches existing IBM Cloud profile
- Validate hourly rates against actual pricing ranges (catch typos)
- Add cost-per-performance metrics ($/vCPU, $/GB)
- Profile templates for common workloads (SAP HANA, Database, Web Server)

**Key Components:**
- Update `CustomProfileEditor.tsx` with family selector and ratio validation
- Add `profileValidation.ts` - family constraints, similarity detection
- `ProfileTemplates.tsx` - preset profiles for common workloads
- Show warnings when specs don't match family ratios

**Effort:** Low (1-2 days) | **Impact:** Medium

---

### 14. Import/Export Ecosystem

**Current Gap:** Strong export capabilities but no import for configs, scenarios, or custom profiles.

**Proposed Implementation:**
- Import custom profiles from JSON with schema validation
- Import saved scenarios to continue previous analysis
- Import wave plans from exported YAML/JSON
- Shareable analysis bundles (profiles + scenarios + wave plans as single file)
- Team library for shared custom profiles

**Key Components:**
- `importValidation.ts` - JSON schema validation for all import types
- `AnalysisBundleExport.tsx` - export complete analysis state
- `AnalysisBundleImport.tsx` - import and restore analysis state
- Update existing export services to include metadata for re-import

**Bundle Schema:**
```typescript
interface AnalysisBundle {
  version: string;
  exportedAt: string;
  scenarios: SavedScenario[];
  customProfiles: CustomProfile[];
  wavePlans: SavedWavePlan[];
  remediationStatus: RemediationStatus[];
}
```

**Effort:** Medium (2-3 days) | **Impact:** Medium

---

### 15. Additional Enhancement Ideas

**Bulk VM Operations**
- Select multiple VMs to exclude/include from migration
- Bulk assign to specific waves
- Bulk apply profile overrides

**Dependency Mapping**
- Identify VM dependencies based on network patterns (same port group/VLAN)
- Visualize dependency graph
- Warn when dependent VMs are in different waves

**Historical Tracking**
- Compare changes between RVTools exports over time
- Track infrastructure growth/changes
- Trend analysis for capacity planning

**Integration Options**
- Export to Terraform configurations
- Export to Ansible playbooks
- Integration with IBM Cloud Schematics

**Collaboration Features**
- Share analysis via URL (encoded state)
- Export analysis to shareable format
- Comments/annotations on VMs or waves

---

## Recommended Feature Roadmap

| Phase | Feature | Effort | Impact | Dependencies |
|-------|---------|--------|--------|--------------|
| 1 | Scenario Management | 3-4 days | High | None |
| 2 | Wave Planning Persistence | 3-4 days | High | None |
| 3 | Remediation Tracking | 2-3 days | Medium | None |
| 4 | Custom Profile Validation | 1-2 days | Medium | None |
| 5 | Import/Export Ecosystem | 2-3 days | Medium | Phases 1-3 |
| 6 | Bulk VM Operations | 2 days | Medium | Phase 2 |
| 7 | Dependency Mapping | 3-4 days | Medium | None |


### Fix Updates

Remove API capability. The updates are to be done as follows

Maintainer runs the update scripts to update the pricing, vpc profiles and ROKS profiles before updating code engine
User browses to website and app tries to update using the proxy. If succedees the app is labelled with Live API, if not labbeled with cache