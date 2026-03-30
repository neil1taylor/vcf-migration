import { describe, it, expect } from 'vitest';
import { matchBillingToHosts } from '../billingHostMatcher';
import type { ClassicBillingData } from '../types';

function makeBilling(hostnames: string[]): ClassicBillingData {
  return {
    summary: { bareMetalTotal: 0, virtualServerTotal: 0, unattachedServicesTotal: 0, platformServicesTotal: 0, grandTotal: 0 },
    bareMetalServers: hostnames.map(h => ({ hostname: h, totalRecurringFee: 1000, serverType: 'bare-metal' as const })),
    virtualServers: [],
    detailedLineItems: hostnames.map(h => ({
      serverOrServiceName: h,
      description: 'Server: Test',
      category: 'Server',
      location: 'London 4',
      recurringFee: 500,
    })),
    fileName: 'test.xls',
    parseWarnings: [],
  };
}

describe('matchBillingToHosts', () => {
  it('matches exactly by full hostname (case-insensitive)', () => {
    const billing = makeBilling(['host01.example.com']);
    const result = matchBillingToHosts(billing, ['host01.example.com']);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchMethod).toBe('exact');
    expect(result.matched[0].rvtoolsHostname).toBe('host01.example.com');
    expect(result.unmatchedBilling).toHaveLength(0);
    expect(result.unmatchedRvtools).toHaveLength(0);
    expect(result.matchRate).toBe(1);
  });

  it('matches case-insensitively', () => {
    const billing = makeBilling(['HOST01.EXAMPLE.COM']);
    const result = matchBillingToHosts(billing, ['host01.example.com']);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchMethod).toBe('exact');
  });

  it('matches by FQDN prefix when full name differs', () => {
    const billing = makeBilling(['esx001.domain.cloud']);
    const result = matchBillingToHosts(billing, ['esx001']);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchMethod).toBe('fqdn-prefix');
    expect(result.matched[0].rvtoolsHostname).toBe('esx001');
  });

  it('matches FQDN prefix when RVTools has different domain', () => {
    const billing = makeBilling(['green01esx000.green01.greencore.vcs']);
    const result = matchBillingToHosts(billing, ['green01esx000.local']);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchMethod).toBe('fqdn-prefix');
  });

  it('reports unmatched billing servers', () => {
    const billing = makeBilling(['host01.com', 'host02.com']);
    const result = matchBillingToHosts(billing, ['host01.com']);

    expect(result.matched).toHaveLength(1);
    expect(result.unmatchedBilling).toHaveLength(1);
    expect(result.unmatchedBilling[0].hostname).toBe('host02.com');
    expect(result.matchRate).toBe(0.5);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('reports unmatched RVTools hosts', () => {
    const billing = makeBilling(['host01.com']);
    const result = matchBillingToHosts(billing, ['host01.com', 'host03.com']);

    expect(result.matched).toHaveLength(1);
    expect(result.unmatchedRvtools).toEqual(['host03.com']);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles empty billing data', () => {
    const billing = makeBilling([]);
    const result = matchBillingToHosts(billing, ['host01.com']);

    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedRvtools).toEqual(['host01.com']);
    expect(result.matchRate).toBe(0);
  });

  it('handles empty RVTools hosts', () => {
    const billing = makeBilling(['host01.com']);
    const result = matchBillingToHosts(billing, []);

    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedBilling).toHaveLength(1);
  });

  it('includes detail items for matched hosts', () => {
    const billing = makeBilling(['host01.com']);
    const result = matchBillingToHosts(billing, ['host01.com']);

    expect(result.matched[0].detailItems).toHaveLength(1);
    expect(result.matched[0].detailItems[0].category).toBe('Server');
  });

  it('prefers exact match over FQDN prefix', () => {
    const billing = makeBilling(['host01.example.com']);
    // Both the full name and prefix would match
    const result = matchBillingToHosts(billing, ['host01.example.com', 'host01']);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].matchMethod).toBe('exact');
    expect(result.matched[0].rvtoolsHostname).toBe('host01.example.com');
    // host01 should be unmatched since the exact match consumed the billing entry
    expect(result.unmatchedRvtools).toContain('host01');
  });
});
