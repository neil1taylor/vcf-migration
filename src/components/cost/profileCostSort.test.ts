import { describe, it, expect } from 'vitest';
import { sortProfileCosts, findBestValueProfileId, type ProfileCostEntry } from './profileCostSort';
import type { CostEstimate } from '@/services/costEstimation';

function makeEntry(overrides: {
  id?: string;
  isCustom?: boolean;
  monthlyRate?: number;
  totalMonthly?: number | string;
  totalAnnual?: number | string;
  cpuViable?: boolean;
}): ProfileCostEntry {
  const id = overrides.id ?? 'profile-1';
  const isCustom = overrides.isCustom ?? false;
  const monthlyRate = overrides.monthlyRate ?? 100;
  const totalMonthly = 'totalMonthly' in overrides ? overrides.totalMonthly : 1000;
  const totalAnnual = 'totalAnnual' in overrides ? overrides.totalAnnual : 12000;
  const cpuViable = overrides.cpuViable ?? true;
  return {
    profile: { id, isCustom, monthlyRate },
    estimate: { totalMonthly, totalAnnual } as unknown as CostEstimate,
    cpuViable,
  };
}

describe('sortProfileCosts', () => {
  it('sorts by totalMonthly ascending', () => {
    const entries = [
      makeEntry({ id: 'expensive', totalMonthly: 3000 }),
      makeEntry({ id: 'cheap', totalMonthly: 1000 }),
      makeEntry({ id: 'mid', totalMonthly: 2000 }),
    ];
    const sorted = sortProfileCosts(entries);
    expect(sorted.map(e => e.profile.id)).toEqual(['cheap', 'mid', 'expensive']);
  });

  it('puts non-viable profiles at the end', () => {
    const entries = [
      makeEntry({ id: 'non-viable', cpuViable: false, totalMonthly: 100 }),
      makeEntry({ id: 'viable', cpuViable: true, totalMonthly: 5000 }),
    ];
    const sorted = sortProfileCosts(entries);
    expect(sorted.map(e => e.profile.id)).toEqual(['viable', 'non-viable']);
  });

  it('puts unpriced custom profiles after priced profiles but before non-viable', () => {
    const entries = [
      makeEntry({ id: 'non-viable', cpuViable: false, totalMonthly: 100 }),
      makeEntry({ id: 'unpriced-custom', isCustom: true, monthlyRate: 0, totalMonthly: 0 }),
      makeEntry({ id: 'priced', totalMonthly: 2000 }),
    ];
    const sorted = sortProfileCosts(entries);
    expect(sorted.map(e => e.profile.id)).toEqual(['priced', 'unpriced-custom', 'non-viable']);
  });

  it('handles NaN totalMonthly by sorting to end of priced group', () => {
    const entries = [
      makeEntry({ id: 'nan', totalMonthly: NaN }),
      makeEntry({ id: 'normal', totalMonthly: 1500 }),
    ];
    const sorted = sortProfileCosts(entries);
    expect(sorted.map(e => e.profile.id)).toEqual(['normal', 'nan']);
  });

  it('handles string totalMonthly from proxy data by coercing to number', () => {
    const entries = [
      makeEntry({ id: 'string-cost', totalMonthly: '2000' as unknown as number }),
      makeEntry({ id: 'normal', totalMonthly: 1500 }),
    ];
    const sorted = sortProfileCosts(entries);
    expect(sorted.map(e => e.profile.id)).toEqual(['normal', 'string-cost']);
  });

  it('handles undefined totalMonthly by sorting to end of priced group', () => {
    const entries = [
      makeEntry({ id: 'undef-cost', totalMonthly: undefined as unknown as number }),
      makeEntry({ id: 'normal', totalMonthly: 1500 }),
    ];
    const sorted = sortProfileCosts(entries);
    expect(sorted.map(e => e.profile.id)).toEqual(['normal', 'undef-cost']);
  });

  it('interleaves custom and non-custom profiles by cost when both are priced', () => {
    const entries = [
      makeEntry({ id: 'std-expensive', totalMonthly: 3000 }),
      makeEntry({ id: 'custom-cheap', isCustom: true, monthlyRate: 50, totalMonthly: 1000 }),
      makeEntry({ id: 'std-cheap', totalMonthly: 2000 }),
    ];
    const sorted = sortProfileCosts(entries);
    expect(sorted.map(e => e.profile.id)).toEqual(['custom-cheap', 'std-cheap', 'std-expensive']);
  });

  it('does not mutate the input array', () => {
    const entries = [
      makeEntry({ id: 'b', totalMonthly: 2000 }),
      makeEntry({ id: 'a', totalMonthly: 1000 }),
    ];
    const original = [...entries];
    sortProfileCosts(entries);
    expect(entries.map(e => e.profile.id)).toEqual(original.map(e => e.profile.id));
  });
});

describe('findBestValueProfileId', () => {
  it('returns the cheapest CPU-viable priced profile', () => {
    const entries = [
      makeEntry({ id: 'expensive', totalMonthly: 5000, totalAnnual: 60000 }),
      makeEntry({ id: 'cheap', totalMonthly: 1000, totalAnnual: 12000 }),
    ];
    expect(findBestValueProfileId(entries)).toBe('cheap');
  });

  it('excludes non-viable profiles', () => {
    const entries = [
      makeEntry({ id: 'cheap-nonviable', cpuViable: false, totalMonthly: 100, totalAnnual: 1200 }),
      makeEntry({ id: 'expensive-viable', totalMonthly: 5000, totalAnnual: 60000 }),
    ];
    expect(findBestValueProfileId(entries)).toBe('expensive-viable');
  });

  it('excludes unpriced custom profiles', () => {
    const entries = [
      makeEntry({ id: 'unpriced', isCustom: true, monthlyRate: 0, totalMonthly: 0, totalAnnual: 0 }),
      makeEntry({ id: 'priced', totalMonthly: 3000, totalAnnual: 36000 }),
    ];
    expect(findBestValueProfileId(entries)).toBe('priced');
  });

  it('excludes profiles with NaN totalAnnual', () => {
    const entries = [
      makeEntry({ id: 'nan-annual', totalMonthly: 100, totalAnnual: NaN }),
      makeEntry({ id: 'valid', totalMonthly: 2000, totalAnnual: 24000 }),
    ];
    expect(findBestValueProfileId(entries)).toBe('valid');
  });

  it('returns undefined when no profiles are priceable', () => {
    const entries = [
      makeEntry({ id: 'non-viable', cpuViable: false, totalMonthly: 100, totalAnnual: 1200 }),
    ];
    expect(findBestValueProfileId(entries)).toBeUndefined();
  });
});
