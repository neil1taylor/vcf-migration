import type {
  ClassicBillingData,
  BillingHostMatch,
  BillingMatchResult,
  BillingDetailLineItem,
} from './types';

/**
 * Match billing bare-metal server hostnames to RVTools vHost hostnames.
 *
 * Strategy (first match wins):
 * 1. Exact case-insensitive match
 * 2. FQDN prefix match (first segment before '.')
 */
export function matchBillingToHosts(
  billing: ClassicBillingData,
  rvtoolsHostnames: string[],
): BillingMatchResult {
  const warnings: string[] = [];
  const matched: BillingHostMatch[] = [];
  const unmatchedBilling = [...billing.bareMetalServers];
  const rvtoolsRemaining = new Set(rvtoolsHostnames);

  // Build lookup maps for RVTools hostnames
  const rvtoolsLower = new Map<string, string>(); // lowercase full → original
  const rvtoolsPrefix = new Map<string, string>(); // lowercase prefix → original
  for (const h of rvtoolsHostnames) {
    rvtoolsLower.set(h.toLowerCase(), h);
    const prefix = h.toLowerCase().split('.')[0];
    // Only use prefix if it's not already taken (avoid ambiguity)
    if (!rvtoolsPrefix.has(prefix)) {
      rvtoolsPrefix.set(prefix, h);
    }
  }

  // Group detail items by server name for quick lookup
  const detailByServer = groupDetailItems(billing.detailedLineItems);

  // Pass 1: Exact match
  for (let i = unmatchedBilling.length - 1; i >= 0; i--) {
    const server = unmatchedBilling[i];
    const billingLower = server.hostname.toLowerCase();
    const rvMatch = rvtoolsLower.get(billingLower);
    if (rvMatch) {
      matched.push({
        billingHostname: server.hostname,
        rvtoolsHostname: rvMatch,
        totalRecurringFee: server.totalRecurringFee,
        detailItems: detailByServer.get(server.hostname) ?? [],
        matchMethod: 'exact',
      });
      rvtoolsRemaining.delete(rvMatch);
      unmatchedBilling.splice(i, 1);
    }
  }

  // Pass 2: FQDN prefix match
  for (let i = unmatchedBilling.length - 1; i >= 0; i--) {
    const server = unmatchedBilling[i];
    const billingPrefix = server.hostname.toLowerCase().split('.')[0];
    const rvMatch = rvtoolsPrefix.get(billingPrefix);
    if (rvMatch && rvtoolsRemaining.has(rvMatch)) {
      matched.push({
        billingHostname: server.hostname,
        rvtoolsHostname: rvMatch,
        totalRecurringFee: server.totalRecurringFee,
        detailItems: detailByServer.get(server.hostname) ?? [],
        matchMethod: 'fqdn-prefix',
      });
      rvtoolsRemaining.delete(rvMatch);
      unmatchedBilling.splice(i, 1);
    }
  }

  // Build unmatched lists
  const unmatchedRvtools = Array.from(rvtoolsRemaining);

  if (unmatchedRvtools.length > 0) {
    warnings.push(
      `${unmatchedRvtools.length} RVTools host(s) have no billing data (estimated costs used): ${unmatchedRvtools.join(', ')}`,
    );
  }

  // Match rate based on RVTools hosts matched (what matters for Source BOM accuracy)
  const totalRvtools = rvtoolsHostnames.length;
  const matchRate = totalRvtools > 0 ? matched.length / totalRvtools : 0;

  return {
    matched,
    unmatchedBilling,
    unmatchedRvtools,
    matchRate,
    warnings,
  };
}

function groupDetailItems(
  items: BillingDetailLineItem[],
): Map<string, BillingDetailLineItem[]> {
  const map = new Map<string, BillingDetailLineItem[]>();
  for (const item of items) {
    const existing = map.get(item.serverOrServiceName);
    if (existing) {
      existing.push(item);
    } else {
      map.set(item.serverOrServiceName, [item]);
    }
  }
  return map;
}
