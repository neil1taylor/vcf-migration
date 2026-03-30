/** Per-server summary from Bare Metal / Virtual Servers sheets */
export interface BillingServerSummary {
  hostname: string;
  totalRecurringFee: number;
  serverType: 'bare-metal' | 'virtual-server';
}

/** Granular line item from Detailed Billing sheet */
export interface BillingDetailLineItem {
  serverOrServiceName: string;
  description: string;
  category: string;
  location: string;
  recurringFee: number;
}

/** Summary sheet top-level category totals */
export interface BillingSummary {
  bareMetalTotal: number;
  virtualServerTotal: number;
  unattachedServicesTotal: number;
  platformServicesTotal: number;
  grandTotal: number;
}

/** Full parsed billing result */
export interface ClassicBillingData {
  summary: BillingSummary;
  bareMetalServers: BillingServerSummary[];
  virtualServers: BillingServerSummary[];
  detailedLineItems: BillingDetailLineItem[];
  fileName: string;
  parseWarnings: string[];
}

/** Result of matching a single billing host to RVTools */
export interface BillingHostMatch {
  billingHostname: string;
  rvtoolsHostname: string | null;
  totalRecurringFee: number;
  detailItems: BillingDetailLineItem[];
  matchMethod: 'exact' | 'fqdn-prefix' | 'unmatched';
}

/** Aggregate matching result */
export interface BillingMatchResult {
  matched: BillingHostMatch[];
  unmatchedBilling: BillingServerSummary[];
  unmatchedRvtools: string[];
  matchRate: number;
  warnings: string[];
}
