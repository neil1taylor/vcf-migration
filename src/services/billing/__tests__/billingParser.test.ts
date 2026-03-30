import { describe, it, expect } from 'vitest';
import { parseClassicBilling } from '../billingParser';
import * as XLSX from 'xlsx';

function makeWorkbook(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

describe('parseClassicBilling', () => {
  it('parses summary totals from category rows', () => {
    const wb = makeWorkbook({
      Summary: [
        ['Summary'],
        ['Group Description', null, null, null, null, null, null, null, 'Recurring Fee:'],
        ['Bare Metal Servers and Attached Services', null, null, null, null, null, null, '$', 194893.27],
        ['Virtual Servers and Attached Services', null, null, null, null, null, null, '$', 1373.11],
        ['Unattached Services', null, null, null, null, null, null, '$', 6684.39],
        ['Platform Services', null, null, null, null, null, null, '$', 64687.49],
        [],
        ['Total:', null, null, null, null, null, null, '$', 267638.26],
      ],
      'Bare Metal Servers and Attac': [],
      'Virtual Servers and Attached': [],
      'Detailed Billing': [],
    });

    const result = parseClassicBilling(wb, 'test.xls');
    expect(result.summary.bareMetalTotal).toBe(194893.27);
    expect(result.summary.virtualServerTotal).toBe(1373.11);
    expect(result.summary.unattachedServicesTotal).toBe(6684.39);
    expect(result.summary.platformServicesTotal).toBe(64687.49);
    expect(result.summary.grandTotal).toBe(267638.26);
  });

  it('parses bare metal server list', () => {
    const wb = makeWorkbook({
      Summary: [['Summary'], ['Total:', null, null, null, null, null, null, '$', 100]],
      'Bare Metal Servers and Attac': [
        ['Bare Metal Servers and Attached Services'],
        ['Description', null, null, null, null, null, null, null, 'Recurring Fee:'],
        ['host01.example.com', null, null, null, null, null, null, '$', 5000],
        ['host02.example.com', null, null, null, null, null, null, '$', 6000],
        ['Sub-Total:', null, null, null, null, null, null, '$', 11000],
        ['Taxes:', null, null, null, null, null, null, '$', 0],
        ['Total:', null, null, null, null, null, null, '$', 11000],
      ],
      'Virtual Servers and Attached': [],
      'Detailed Billing': [],
    });

    const result = parseClassicBilling(wb, 'test.xls');
    expect(result.bareMetalServers).toHaveLength(2);
    expect(result.bareMetalServers[0]).toEqual({
      hostname: 'host01.example.com',
      totalRecurringFee: 5000,
      serverType: 'bare-metal',
    });
    expect(result.bareMetalServers[1].totalRecurringFee).toBe(6000);
  });

  it('parses virtual server list', () => {
    const wb = makeWorkbook({
      Summary: [['Summary']],
      'Bare Metal Servers': [],
      'Virtual Servers and Attach': [
        ['Virtual Servers and Attached Services'],
        ['Description', null, null, null, null, null, null, null, 'Recurring Fee:'],
        ['vm01.example.com', null, null, null, null, null, null, '$', 757.27],
        ['Sub-Total:', null, null, null, null, null, null, '$', 757.27],
      ],
      'Detailed Billing': [],
    });

    const result = parseClassicBilling(wb, 'test.xls');
    expect(result.virtualServers).toHaveLength(1);
    expect(result.virtualServers[0].serverType).toBe('virtual-server');
    expect(result.virtualServers[0].totalRecurringFee).toBe(757.27);
  });

  it('parses detailed billing line items grouped by server', () => {
    const wb = makeWorkbook({
      Summary: [['Summary']],
      'Bare Metal Servers': [],
      'Virtual Servers': [],
      'Detailed Billing': [
        ['Detailed Billing'],
        // Server 1: name + "Category Group" header on same row
        ['host01.example.com', null, null, null, null, 'Category Group', 'Location:', 'Recurring Fee:'],
        ['Server: Xeon E3-1270', null, null, null, null, 'Server', 'London 4', 107.05, 0, 0, 0],
        ['64 GB RAM', null, null, null, null, 'RAM', 'London 4', 100.00, 0, 0, 0],
        ['Sub-Total:', null, null, null, null, null, null, 207.05, 0, 0, 0],
        [],
        // Server 2: same pattern
        ['host02.example.com', null, null, null, null, 'Category Group', 'Location:', 'Recurring Fee:'],
        ['Server: Xeon E5-2690', null, null, null, null, 'Server', 'London 6', 200.00, 0, 0, 0],
        ['Sub-Total:', null, null, null, null, null, null, 200.00],
      ],
    });

    const result = parseClassicBilling(wb, 'test.xls');
    expect(result.detailedLineItems).toHaveLength(3);
    expect(result.detailedLineItems[0]).toEqual({
      serverOrServiceName: 'host01.example.com',
      description: 'Server: Xeon E3-1270',
      category: 'Server',
      location: 'London 4',
      recurringFee: 107.05,
    });
    expect(result.detailedLineItems[1].serverOrServiceName).toBe('host01.example.com');
    expect(result.detailedLineItems[2].serverOrServiceName).toBe('host02.example.com');
  });

  it('emits warnings when no servers or detail items found', () => {
    const wb = makeWorkbook({
      Summary: [['Summary']],
      'Bare Metal Servers': [],
      'Virtual Servers': [],
      'Detailed Billing': [],
    });

    const result = parseClassicBilling(wb, 'empty.xls');
    expect(result.parseWarnings).toContain('No servers found in billing export.');
    expect(result.parseWarnings).toContain('No detailed billing line items found.');
  });

  it('sets fileName from input', () => {
    const wb = makeWorkbook({
      Summary: [['Summary']],
      'Bare Metal Servers': [],
      'Virtual Servers': [],
      'Detailed Billing': [],
    });

    const result = parseClassicBilling(wb, 'GC March 26.xls');
    expect(result.fileName).toBe('GC March 26.xls');
  });
});
