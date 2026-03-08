---
name: docx-inspection
description: Run DOCX preview, inspect formatting output, identify issues, fix code, and re-verify. Use when iterating on DOCX export formatting or debugging document structure.
---

<objective>
Iteratively inspect and fix DOCX export formatting by running `npm run preview:docx`, interpreting the structured output, identifying issues, fixing source code, and re-running until clean.
</objective>

<process>

## Step 1: Run the preview

```bash
npm run preview:docx
```

This generates a DOCX from the test fixture, unzips it, parses the XML, and prints a structured inspection report. The DOCX is also written to `tmp/preview.docx`.

## Step 2: Interpret the output sections

The report has these sections — check each one:

### Document Structure
- Lists all H1/H2/H3 headings in order with their text
- **Check**: Section numbers should be sequential (no gaps like 3.1, 3.3)
- **Check**: Heading hierarchy should be logical (H2 under H1, H3 under H2)

### Style Summary
- Fonts, colors, and font sizes found in the document
- **Check**: Body text should use consistent font size (typically 22 half-points = 11pt)
- **Check**: Colors should match the project palette (primaryColor, secondaryColor from STYLES)

### Element Counts
- Tables, paragraphs, images, page breaks
- **Check**: Table count should match expected sections (blockers, warnings, sizing, etc.)

### Formatting Lint
This is the most actionable section. Each lint issue is categorized:

- **`table-spacing-before`**: Table preceded by element with insufficient spacing. Fix by adding `spacing.after` to the element before the table, or `spacing.before` to the table description.
- **`table-spacing-after`**: Table followed by element with insufficient spacing. Fix by adding `spacing.before` to the element after the table.
- **`section-numbering-gap`**: Section numbers skip values (e.g., 3.1 → 3.3). Fix by using a local counter pattern:
  ```typescript
  let sub = 0;
  const nextSub = () => ++sub;
  ```
- **`font-inconsistency`**: Mixed font sizes or families in body text.

### Section Previews
- First ~200 characters of text per section
- **Check**: Content renders correctly, no template placeholder leaks

## Step 3: Fix issues

Source files for DOCX sections:
- `src/services/export/docx/sections/` — individual section builders
- `src/services/export/docx/utils/helpers.ts` — shared helpers (spacing, tables, captions)
- `src/services/export/docx/types.ts` — style constants

Common fixes:
- **Spacing**: Adjust `spacing: { before: N, after: N }` in Paragraph options (units are twips, 1pt = 20tw)
- **Section numbering**: Use `nextSub()` counter pattern instead of hardcoded numbers
- **Table descriptions**: Use `createTableDescription()` + `createTableLabel()` pair (description above, label below)
- **keepNext**: Set `keepNext: true` on elements that must stay with the following table

## Step 4: Re-run and verify

```bash
npm run preview:docx
```

Compare output to previous run. Repeat Steps 2-4 until the Formatting Lint section shows no issues.

## Step 5: Run tests

After all formatting fixes:

```bash
npm test -- --run src/services/export
```

Ensure export tests still pass.
</process>

<reference>

### DOCX Spacing Units
- **Twips** (twentieths of a point): Used for paragraph spacing (`before`, `after`). 240tw = 12pt.
- **Half-points**: Used for font sizes. 22 half-points = 11pt body text.
- **EMUs**: Used for image dimensions. 1 inch = 914400 EMUs.

### Key Style Constants (from `types.ts`)
- `STYLES.primaryColor` — IBM Blue for accents
- `STYLES.secondaryColor` — Dark gray for headings
- `STYLES.bodySize` — Standard body text size (half-points)
- `STYLES.smallSize` — Captions and labels (half-points)
- `STYLES.mediumGray` — Table borders

### Table Description Pattern
```typescript
// Description ABOVE table
...createTableDescription(title, description),
// The table itself
new Table({ ... }),
// Label BELOW table
createTableLabel(title),
```

### Section Counter Pattern
```typescript
let sub = 0;
const nextSub = () => ++sub;

const checksNum = nextSub(); // always 1
// conditional sections get sequential numbers
if (hasData) {
  const dataNum = nextSub(); // 2 (or skipped)
}
const risksNum = nextSub(); // 2 or 3, no gaps
```
</reference>

<success_criteria>
- `npm run preview:docx` runs without errors
- Formatting Lint section shows zero issues
- Section numbering is sequential with no gaps
- All export tests pass
- `tmp/preview.docx` can be opened and visually verified (optional)
</success_criteria>
