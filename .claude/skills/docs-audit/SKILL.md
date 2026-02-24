---
name: docs-audit
description: Audit project documentation for consistency and completeness
user-invocable: true
disable-model-invocation: true
---

# /docs-audit — Documentation Consistency Audit

Audit project documentation for consistency across all source-of-truth files. This is a **read-only** skill — do not modify any files.

## How to run

Perform ALL of the checks below, then produce a single summary report. Use parallel reads where possible for speed.

## Checks

### 1. Version consistency

- Read `package.json` → extract `version` field
- Read `src/data/changelog.json` → extract the first entry's `version` field
- **Error** if they don't match

### 2. npm scripts documented in CLAUDE.md

- Read `package.json` → extract all keys from `scripts`
- Read `CLAUDE.md` → search for each script name (e.g., `npm run dev`, `npm run build`, `npm test`)
- **Warning** for any script in `package.json` not mentioned in CLAUDE.md

### 3. Environment variables

- Read `.env.example` → extract all `VITE_*` variable names
- Read `CLAUDE.md` → check each variable is documented in the Environment Variables section
- Read `README.md` → check each variable is mentioned
- **Warning** for any `VITE_*` variable missing from either file

### 4. AI features table

- Glob `src/hooks/useAI*.ts` (exclude `.test.ts` files) → collect hook filenames
- Read `CLAUDE.md` → find the "AI Features" table and extract hook names listed
- Exclude utility hooks (`useAISettings`, `useAIStatus`) from the comparison — these aren't AI feature endpoints
- **Warning** for hooks that exist in code but not in the CLAUDE.md table
- **Warning** for hooks listed in CLAUDE.md table but not found as files

### 5. User Guide alignment

- Read `docs/USER_GUIDE.md` → extract `##` level headings
- Read `src/pages/UserGuidePage.tsx` → extract section headings/IDs from the component
- **Info** for any major heading present in one but not the other (exact matching not required — look for conceptual alignment)

### 6. Tech stack coverage

- Read `package.json` → extract `dependencies` keys (not devDependencies)
- Read `TECHNOLOGIES.md` → check that major libraries are mentioned
- Major libraries to check: `react`, `@carbon/react`, `chart.js`, `exceljs`, `jspdf`, `xlsx`, `docx`, `js-yaml`, `papaparse`
- **Info** for any major dependency not mentioned in TECHNOLOGIES.md

### 7. Virtualization overhead values

- Read `src/data/virtualizationOverhead.json` → extract CPU fixed, CPU proportional, memory fixed, memory proportional, storage proportional values
- Read `CLAUDE.md` → find the Virtualization Overhead table
- **Error** for any value mismatch between the JSON and CLAUDE.md

### 8. Workload pattern categories

- Read `src/data/workloadPatterns.json` → extract category names from `categories` array
- Read `CLAUDE.md` → check that workload classification is described (general check, not category-by-category)
- **Info** listing the current category count for reference

## Output Format

Produce a report like this:

```
# Documentation Audit Report

## Errors (must fix)
- [E1] Version mismatch: package.json says X, changelog.json says Y
- ...

## Warnings (should fix)
- [W1] npm script "foo" not documented in CLAUDE.md
- [W2] VITE_BAR in .env.example not mentioned in README.md
- ...

## Info
- [I1] TECHNOLOGIES.md missing mention of "docx" package
- [I2] Workload patterns: 12 categories defined in workloadPatterns.json
- ...

## Summary
- X errors, Y warnings, Z info items
- Files checked: (list all files read)
```

Include file paths and line numbers where relevant to help locate issues.

## Important

- This skill is **read-only** — do NOT modify any files
- Do NOT suggest fixes inline — just report findings
- Use Glob and Read tools, not Bash, to read files
- Run checks in parallel where possible for speed
