// Excluded VMs Slide — summary table by exclusion reason

import type PptxGenJS from 'pptxgenjs';
import type { RVToolsData, VirtualMachine } from '@/types/rvtools';
import { COLORS, FONTS } from '../types';
import { getAutoExclusion } from '@/utils/autoExclusion';
import { getVMIdentifier, getEnvironmentFingerprint, fingerprintsMatch } from '@/utils/vmIdentifier';
import { addSlideTitle, fmt } from '../utils';

interface VMOverrideEntry {
  vmId: string;
  vmName: string;
  excluded: boolean;
  forceIncluded?: boolean;
  workloadType?: string;
  notes?: string;
}

interface VMOverridesStore {
  version: number;
  environmentFingerprint: string;
  overrides: Record<string, VMOverrideEntry>;
}

function loadUserOverrides(rawData: RVToolsData): Record<string, VMOverrideEntry> {
  try {
    const stored = localStorage.getItem('vcf-vm-overrides');
    if (!stored) return {};
    const parsed: VMOverridesStore = JSON.parse(stored);
    if (parsed.version !== 2) return {};
    const currentFingerprint = getEnvironmentFingerprint(rawData);
    if (!fingerprintsMatch(currentFingerprint, parsed.environmentFingerprint)) return {};
    return parsed.overrides;
  } catch {
    return {};
  }
}

export function addExcludedVMsSlide(
  pres: PptxGenJS,
  rawData: RVToolsData
): void {
  const slide = pres.addSlide({ masterName: 'CONTENT' });
  addSlideTitle(slide, 'Excluded VMs');

  slide.addText('VMs Not Requiring Migration', {
    x: 1.33,
    y: 1.25,
    w: 24.0,
    h: 0.93,
    fontSize: FONTS.bodySize,
    fontFace: FONTS.face,
    color: COLORS.ibmBlue,
    bold: true,
  });

  slide.addText(
    'Not all VMs in the source environment require migration. VMs such as templates, powered-off instances, vCenter management appliances, and infrastructure tooling (e.g. backup proxies, monitoring agents) are automatically excluded as they will be reprovisioned natively on the target platform or are no longer needed.',
    {
      x: 1.33,
      y: 2.05,
      w: 24.0,
      h: 1.6,
      fontSize: FONTS.smallSize,
      fontFace: FONTS.face,
      color: COLORS.darkGray,
    }
  );

  // Load user overrides from localStorage
  const userOverrides = loadUserOverrides(rawData);

  // Group VMs by exclusion reason label, merging auto-exclusion with user overrides
  const labelCounts = new Map<string, number>();
  let totalExcluded = 0;
  let forceIncludedCount = 0;

  for (const vm of rawData.vInfo as VirtualMachine[]) {
    const vmId = getVMIdentifier(vm);
    const override = userOverrides[vmId];
    const result = getAutoExclusion(vm);

    // User force-included → not excluded, even if auto-excluded
    if (override?.forceIncluded) {
      if (result.isAutoExcluded) {
        forceIncludedCount++;
      }
      continue;
    }

    // User manually excluded → count under "User Excluded"
    if (override?.excluded) {
      totalExcluded++;
      labelCounts.set('User Excluded', (labelCounts.get('User Excluded') || 0) + 1);
      continue;
    }

    // Auto-excluded (no user override)
    if (result.isAutoExcluded) {
      totalExcluded++;
      for (const label of result.labels) {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }
    }
  }

  const rows = [...labelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => [label, fmt(count)]);

  if (rows.length > 0) {
    const fontSize = FONTS.smallSize;
    const headerOpts = { bold: true, fill: { color: COLORS.ibmBlue }, color: COLORS.white, fontSize, fontFace: FONTS.face, valign: 'middle' as const, align: 'left' as const };
    const cellOpts = { fontSize, fontFace: FONTS.face, color: COLORS.darkGray, valign: 'middle' as const, align: 'left' as const };
    const boldCellOpts = { ...cellOpts, bold: true };

    const tableRows: PptxGenJS.TableRow[] = [
      [
        { text: 'Exclusion Reason', options: headerOpts },
        { text: 'VM Count', options: headerOpts },
      ],
      ...rows.map((row, rowIdx) => [
        { text: row[0], options: { ...cellOpts, fill: { color: rowIdx % 2 === 0 ? COLORS.white : COLORS.lightGray } } },
        { text: row[1], options: { ...cellOpts, fill: { color: rowIdx % 2 === 0 ? COLORS.white : COLORS.lightGray } } },
      ]),
      // Bold total row
      [
        { text: 'Total Excluded', options: { ...boldCellOpts, fill: { color: rows.length % 2 === 0 ? COLORS.white : COLORS.lightGray } } },
        { text: fmt(totalExcluded), options: { ...boldCellOpts, fill: { color: rows.length % 2 === 0 ? COLORS.white : COLORS.lightGray } } },
      ],
    ];

    slide.addTable(tableRows, {
      x: 1.33,
      y: 4.0,
      w: 24.0,
      colW: [16.0, 8.0],
      border: { type: 'solid', pt: 0.5, color: COLORS.mediumGray },
      autoPage: false,
    });

    // Note about force-included VMs overriding auto-exclusion
    if (forceIncludedCount > 0) {
      const noteY = 4.0 + (rows.length + 2) * 0.53; // approximate row height
      slide.addText(
        `Note: ${forceIncludedCount} VM${forceIncludedCount > 1 ? 's were' : ' was'} force-included by the user, overriding auto-exclusion rules.`,
        {
          x: 1.33,
          y: Math.min(noteY, 13.0),
          w: 24.0,
          h: 0.67,
          fontSize: FONTS.smallSize,
          fontFace: FONTS.face,
          color: COLORS.mediumGray,
          italic: true,
        }
      );
    }
  } else {
    slide.addText('No VMs are excluded.', {
      x: 1.33,
      y: 6.67,
      w: 24.0,
      h: 5.33,
      fontSize: FONTS.bodySize,
      fontFace: FONTS.face,
      color: COLORS.mediumGray,
      align: 'center',
      valign: 'middle',
    });
  }
}
