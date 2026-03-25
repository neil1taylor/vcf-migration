import { useMemo } from 'react';
import {
  Grid, Column, Tile,
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
  InlineNotification,
} from '@carbon/react';
import { MetricCard } from '@/components/common';
import { useTargetLocation } from '@/hooks/useTargetLocation';
import { useDynamicPricing } from '@/hooks/useDynamicPricing';
import { useSourceBOM } from '@/hooks/useSourceBOM';
import { formatNumber } from '@/utils/formatters';
import { formatCurrency } from '@/services/costEstimation';
import type { RVToolsData } from '@/types/rvtools';

interface SourceBOMTabProps {
  rawData: RVToolsData;
}

const hostMappingHeaders = [
  { key: 'hostName', header: 'Host Name' },
  { key: 'cluster', header: 'Cluster' },
  { key: 'sourceCores', header: 'Source Cores' },
  { key: 'sourceMemoryGiB', header: 'Source Memory (GiB)' },
  { key: 'sourceCpuModel', header: 'CPU Model' },
  { key: 'matchedCpu', header: 'Classic BM CPU' },
  { key: 'matchedCpuCores', header: 'BM Cores' },
  { key: 'matchedRam', header: 'Classic BM RAM' },
  { key: 'monthlyCost', header: 'Monthly Cost' },
];

const storageHeaders = [
  { key: 'datastoreName', header: 'Datastore' },
  { key: 'datastoreType', header: 'Type' },
  { key: 'capacityGiB', header: 'Capacity (GiB)' },
  { key: 'ibmCloudTarget', header: 'IBM Cloud Target' },
  { key: 'monthlyCost', header: 'Monthly Cost' },
];

const lineItemHeaders = [
  { key: 'category', header: 'Category' },
  { key: 'description', header: 'Description' },
  { key: 'quantity', header: 'Qty' },
  { key: 'unit', header: 'Unit' },
  { key: 'unitCost', header: 'Unit Cost' },
  { key: 'monthlyCost', header: 'Monthly' },
  { key: 'annualCost', header: 'Annual' },
];

const TARGET_LABELS: Record<string, string> = {
  'file-storage': 'File Storage',
  'block-storage': 'Block Storage',
  'local-nvme': 'Local NVMe (included)',
};

export function SourceBOMTab({ rawData }: SourceBOMTabProps) {
  const { targetMzr } = useTargetLocation();
  const { pricing } = useDynamicPricing();
  const bom = useSourceBOM(rawData, targetMzr ?? 'us-south', pricing);

  const hostRows = useMemo(() => {
    if (!bom) return [];
    return bom.hostMappings.map((m, i) => ({
      id: String(i),
      hostName: m.hostName,
      cluster: m.cluster,
      sourceCores: formatNumber(m.sourceCores),
      sourceMemoryGiB: formatNumber(m.sourceMemoryGiB),
      sourceCpuModel: m.sourceCpuModel,
      matchedCpu: m.matchedCpu,
      matchedCpuCores: formatNumber(m.matchedCpuCores),
      matchedRam: m.matchedRam,
      monthlyCost: formatCurrency(m.profileMonthlyCost),
    }));
  }, [bom]);

  const storageRows = useMemo(() => {
    if (!bom) return [];
    return bom.storageItems.map((s, i) => ({
      id: String(i),
      datastoreName: s.datastoreName,
      datastoreType: s.datastoreType,
      capacityGiB: formatNumber(s.capacityGiB),
      ibmCloudTarget: TARGET_LABELS[s.ibmCloudTarget] ?? s.ibmCloudTarget,
      monthlyCost: s.monthlyCost > 0 ? formatCurrency(s.monthlyCost) : 'Included',
    }));
  }, [bom]);

  const lineItemRows = useMemo(() => {
    if (!bom) return [];
    return bom.estimate.lineItems.map((li, i) => ({
      id: String(i),
      category: li.category,
      description: li.description,
      quantity: formatNumber(li.quantity),
      unit: li.unit,
      unitCost: formatCurrency(li.unitCost),
      monthlyCost: formatCurrency(li.monthlyCost),
      annualCost: formatCurrency(li.annualCost),
    }));
  }, [bom]);

  if (!bom) {
    return (
      <Tile style={{ marginTop: '1rem' }}>
        <p>No host data available to generate source infrastructure BOM.</p>
      </Tile>
    );
  }

  const computeMonthly = bom.hostGroups.reduce((sum, g) => sum + g.totalMonthlyCost, 0);
  const storageMonthly = bom.storageItems.reduce((sum, s) => sum + s.monthlyCost, 0);

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Summary Metrics */}
      <Grid narrow>
        <Column lg={4} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <MetricCard
            label="Source Hosts"
            value={formatNumber(bom.hostMappings.length)}
            detail={`${bom.hostGroups.length} unique configuration(s)`}
            variant="primary"
          />
        </Column>
        <Column lg={4} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <MetricCard
            label="Monthly Compute"
            value={formatCurrency(computeMonthly)}
            detail={`${bom.vcfLicensing.totalPhysicalCores} total cores`}
            variant="teal"
          />
        </Column>
        <Column lg={4} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <MetricCard
            label="Monthly Storage"
            value={formatCurrency(storageMonthly)}
            detail={`${bom.storageItems.length} datastore(s)`}
            variant="purple"
          />
        </Column>
        <Column lg={4} md={4} sm={4} style={{ marginBottom: '1rem' }}>
          <MetricCard
            label="Total Monthly Cost"
            value={formatCurrency(bom.estimate.totalMonthly)}
            detail={`${formatCurrency(bom.estimate.totalAnnual)}/yr`}
            variant="info"
          />
        </Column>
      </Grid>

      {/* Warnings */}
      {bom.warnings.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {bom.warnings.map((w, i) => (
            <InlineNotification
              key={i}
              kind="warning"
              title="Matching Warning"
              subtitle={w}
              lowContrast
              hideCloseButton
              style={{ marginBottom: '0.5rem' }}
            />
          ))}
        </div>
      )}

      {/* Host-to-Bare-Metal Mapping */}
      <Tile style={{ marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>Host-to-Classic-Bare-Metal Mapping</h4>
        <DataTable rows={hostRows} headers={hostMappingHeaders}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <Table {...getTableProps()} size="md">
              <TableHead>
                <TableRow>
                  {headers.map(header => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(row => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map(cell => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTable>
      </Tile>

      {/* Storage Breakdown */}
      {bom.storageItems.length > 0 && (
        <Tile style={{ marginBottom: '1rem' }}>
          <h4 style={{ marginBottom: '1rem' }}>Storage Mapping</h4>
          <DataTable rows={storageRows} headers={storageHeaders}>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <Table {...getTableProps()} size="md">
                <TableHead>
                  <TableRow>
                    {headers.map(header => (
                      <TableHeader {...getHeaderProps({ header })} key={header.key}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(row => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map(cell => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTable>
        </Tile>
      )}

      {/* Cost Summary */}
      <Tile style={{ marginBottom: '1rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>Cost Summary</h4>
        <DataTable rows={lineItemRows} headers={lineItemHeaders}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <Table {...getTableProps()} size="md">
              <TableHead>
                <TableRow>
                  {headers.map(header => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(row => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map(cell => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataTable>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <p><strong>Monthly Total: {formatCurrency(bom.estimate.totalMonthly)}</strong></p>
          <p style={{ color: '#525252' }}>Annual Total: {formatCurrency(bom.estimate.totalAnnual)}</p>
        </div>
      </Tile>
    </div>
  );
}
