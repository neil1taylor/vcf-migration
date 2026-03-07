import { describe, it, expect, vi } from 'vitest';
import { buildPlatformSelectionSection } from './platformSelection';
import type { PlatformSelectionExport } from '../types';
import factorsData from '@/data/platformSelectionFactors.json';

// Mock docx Paragraph/Table classes
vi.mock('docx', () => ({
  HeadingLevel: { HEADING_1: 'HEADING_1', HEADING_2: 'HEADING_2' },
  Paragraph: class Paragraph {
    constructor(public options: unknown) {}
  },
  Table: class Table {
    constructor(public options: unknown) {}
  },
  TableRow: class TableRow {
    constructor(public options: unknown) {}
  },
  TableCell: class TableCell {
    constructor(public options: unknown) {}
  },
  TextRun: class TextRun {
    constructor(public options: unknown) {}
  },
  WidthType: { PERCENTAGE: 'PERCENTAGE' },
  AlignmentType: { LEFT: 'LEFT', CENTER: 'CENTER' },
  BorderStyle: { SINGLE: 'SINGLE', NONE: 'NONE' },
  ShadingType: { SOLID: 'SOLID' },
  Bookmark: class Bookmark {
    constructor(public options: unknown) {}
  },
  ExternalHyperlink: class ExternalHyperlink {
    constructor(public options: unknown) {}
  },
}));

function extractText(sections: unknown[]): string[] {
  return sections
    .filter((s: any) => s?.options?.children || s?.options?.text)
    .map((s: any) => {
      if (s?.options?.text) return s.options.text;
      const children = s?.options?.children ?? [];
      return children
        .map((c: any) => c?.options?.text ?? c?.options ?? '')
        .join('');
    })
    .filter(Boolean);
}

function makeData(answers: Record<string, string>, overrides?: Partial<PlatformSelectionExport['score']>): PlatformSelectionExport {
  return {
    score: {
      vsiCount: 0,
      roksCount: 0,
      answeredCount: Object.keys(answers).length,
      leaning: 'neutral',
      roksVariant: 'full',
      ...overrides,
    },
    answers,
  };
}

describe('buildPlatformSelectionSection', () => {
  it('includes not-sure callout when answers contain not-sure', () => {
    const answers: Record<string, string> = {};
    factorsData.factors.forEach((f, i) => {
      answers[f.id] = i === 0 ? 'not-sure' : 'yes';
    });
    const sections = buildPlatformSelectionSection(makeData(answers));
    const texts = extractText(sections);
    const callout = texts.find(t => t.includes('should be resolved with your IBM representative'));
    expect(callout).toBeDefined();
    expect(callout).toContain('1 question answered');
  });

  it('includes not-sure callout when answers are unanswered', () => {
    // Only answer some factors
    const answers: Record<string, string> = {};
    factorsData.factors.slice(0, 2).forEach(f => {
      answers[f.id] = 'yes';
    });
    const unansweredCount = factorsData.factors.length - 2;
    const sections = buildPlatformSelectionSection(makeData(answers));
    const texts = extractText(sections);
    const callout = texts.find(t => t.includes('should be resolved with your IBM representative'));
    expect(callout).toBeDefined();
    expect(callout).toContain(`${unansweredCount} questions`);
  });

  it('does not include not-sure callout when all factors are answered', () => {
    const answers: Record<string, string> = {};
    factorsData.factors.forEach(f => {
      answers[f.id] = 'yes';
    });
    const sections = buildPlatformSelectionSection(makeData(answers));
    const texts = extractText(sections);
    const callout = texts.find(t => t.includes('should be resolved with your IBM representative'));
    expect(callout).toBeUndefined();
  });

  it('uses plural for multiple not-sure/unanswered questions', () => {
    const answers: Record<string, string> = {};
    factorsData.factors.forEach((f, i) => {
      answers[f.id] = i < 2 ? 'not-sure' : 'yes';
    });
    const sections = buildPlatformSelectionSection(makeData(answers));
    const texts = extractText(sections);
    const callout = texts.find(t => t.includes('should be resolved'));
    expect(callout).toContain('2 questions');
  });

  it('uses singular for exactly one not-sure/unanswered question', () => {
    const answers: Record<string, string> = {};
    factorsData.factors.forEach((f, i) => {
      answers[f.id] = i === 0 ? 'not-sure' : 'yes';
    });
    const sections = buildPlatformSelectionSection(makeData(answers));
    const texts = extractText(sections);
    const callout = texts.find(t => t.includes('should be resolved'));
    expect(callout).toContain('1 question answered');
    expect(callout).not.toContain('1 questions');
  });

  it('includes ROV recommendation paragraph when roksVariant is rov', () => {
    const answers: Record<string, string> = {};
    factorsData.factors.forEach(f => {
      answers[f.id] = 'yes';
    });
    const sections = buildPlatformSelectionSection(makeData(answers, { roksVariant: 'rov', leaning: 'roks', roksCount: 5 }));
    const texts = extractText(sections);
    const rovCallout = texts.find(t => t.includes('ROV'));
    expect(rovCallout).toBeDefined();
    expect(rovCallout).toContain('Red Hat OpenShift Virtualization');
  });

  it('does not include ROV paragraph when roksVariant is full', () => {
    const answers: Record<string, string> = {};
    factorsData.factors.forEach(f => {
      answers[f.id] = 'yes';
    });
    const sections = buildPlatformSelectionSection(makeData(answers, { roksVariant: 'full' }));
    const texts = extractText(sections);
    const rovCallout = texts.find(t => t.includes('ROV'));
    expect(rovCallout).toBeUndefined();
  });
});
