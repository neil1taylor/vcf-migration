// Infrastructure tab - VMware environment details and IBM Cloud target location selector
import { useMemo } from 'react';
import {
  Grid, Column, Tile, Dropdown, Tag,
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
} from '@carbon/react';
import { MetricCard } from '@/components/common';
import { useTargetLocation, DATA_CENTERS, MZR_OPTIONS } from '@/hooks/useTargetLocation';
import type { DataCenter, MZROption } from '@/hooks/useTargetLocation';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import type { RVToolsData } from '@/types/rvtools';
import './InfrastructureTab.scss';

interface InfrastructureTabProps {
  rawData: RVToolsData;
}

const MAX_TABLE_ROWS = 20;

const clusterHeaders = [
  { key: 'name', header: 'Name' },
  { key: 'datacenter', header: 'Datacenter' },
  { key: 'hostCount', header: 'Hosts' },
  { key: 'vmCount', header: 'VMs' },
  { key: 'numCpuCores', header: 'CPU Cores' },
  { key: 'memoryGiB', header: 'Memory (GiB)' },
  { key: 'haEnabled', header: 'HA' },
  { key: 'drsEnabled', header: 'DRS' },
];

const hostHeaders = [
  { key: 'name', header: 'Name' },
  { key: 'cluster', header: 'Cluster' },
  { key: 'cpuModel', header: 'CPU Model' },
  { key: 'cpuSockets', header: 'Sockets' },
  { key: 'totalCpuCores', header: 'Cores' },
  { key: 'memoryGiB', header: 'Memory (GiB)' },
  { key: 'esxiVersion', header: 'ESXi Version' },
];

const datastoreHeaders = [
  { key: 'name', header: 'Name' },
  { key: 'type', header: 'Type' },
  { key: 'capacityGiB', header: 'Capacity (GiB)' },
  { key: 'freeGiB', header: 'Free (GiB)' },
  { key: 'hosts', header: 'Hosts' },
];

export function InfrastructureTab({ rawData }: InfrastructureTabProps) {
  const { location, setLocation, targetMzr, setTargetMzr } = useTargetLocation();

  const selectedItem = useMemo(
    () => DATA_CENTERS.find(o => o.id === location) ?? DATA_CENTERS[0],
    [location]
  );

  const selectedMzr = useMemo(
    () => MZR_OPTIONS.find(o => o.id === targetMzr) ?? null,
    [targetMzr]
  );

  const vCenter = rawData.vSource[0];

  const clusterRows = useMemo(() =>
    rawData.vCluster.map((c, i) => ({
      id: String(i),
      name: c.name,
      datacenter: c.datacenter,
      hostCount: formatNumber(c.hostCount),
      vmCount: formatNumber(c.vmCount),
      numCpuCores: formatNumber(c.numCpuCores),
      memoryGiB: formatNumber(Math.round(mibToGiB(c.totalMemoryMiB))),
      haEnabled: c.haEnabled ? 'Yes' : 'No',
      drsEnabled: c.drsEnabled ? 'Yes' : 'No',
    })),
    [rawData.vCluster]
  );

  const hostRows = useMemo(() =>
    rawData.vHost.slice(0, MAX_TABLE_ROWS).map((h, i) => ({
      id: String(i),
      name: h.name,
      cluster: h.cluster,
      cpuModel: h.cpuModel,
      cpuSockets: formatNumber(h.cpuSockets),
      totalCpuCores: formatNumber(h.totalCpuCores),
      memoryGiB: formatNumber(Math.round(mibToGiB(h.memoryMiB))),
      esxiVersion: h.esxiVersion,
    })),
    [rawData.vHost]
  );

  const datastoreRows = useMemo(() =>
    rawData.vDatastore.slice(0, MAX_TABLE_ROWS).map((d, i) => ({
      id: String(i),
      name: d.name,
      type: d.type,
      capacityGiB: formatNumber(Math.round(mibToGiB(d.capacityMiB))),
      freeGiB: formatNumber(Math.round(mibToGiB(d.freeMiB))),
      hosts: d.hosts || '-',
    })),
    [rawData.vDatastore]
  );

  return (
    <Grid className="infrastructure-tab">
      {/* Row 1 — Target Location Selector */}
      <Column lg={16} md={8} sm={4}>
        <Tile className="infrastructure-tab__table-tile">
          <div className="infrastructure-tab__location-tile">
            <Dropdown
              id="source-datacenter"
              titleText="Source Data Center"
              helperText="Source data center location — determines the closest VPC MZR for pricing and network design"
              label="Select a data center"
              items={DATA_CENTERS}
              itemToString={(item: DataCenter | null) => item?.label ?? ''}
              selectedItem={selectedItem}
              onChange={({ selectedItem: item }: { selectedItem: DataCenter | null }) => {
                if (item) setLocation(item.id);
              }}
            />
            <div className="infrastructure-tab__mzr-dropdown">
              <Dropdown
                id="target-mzr"
                titleText="Target IBM Cloud MZR"
                helperText="Target multi-zone region — auto-selected from source DC, can be overridden"
                label="Choose"
                items={MZR_OPTIONS}
                itemToString={(item: MZROption | null) => item?.label ?? ''}
                selectedItem={selectedMzr}
                onChange={({ selectedItem: item }: { selectedItem: MZROption | null }) => {
                  setTargetMzr(item?.id ?? null);
                }}
              />
              <div className="infrastructure-tab__location-tag">
                {targetMzr ? (
                  <Tag type="green" size="sm">{targetMzr}</Tag>
                ) : (
                  <Tag type="gray" size="sm">Not selected</Tag>
                )}
              </div>
            </div>
          </div>
        </Tile>
      </Column>

      {/* Row 2 — Environment Summary MetricCards */}
      <Column lg={4} md={4} sm={2}>
        <MetricCard
          label="vCenter"
          value={rawData.vSource.length > 0 ? rawData.vSource.length.toString() : '0'}
          detail={vCenter?.version ? `v${vCenter.version}` : 'No vSource data'}
          variant="info"
          tooltip="Number of vCenter servers in the environment"
        />
      </Column>
      <Column lg={4} md={4} sm={2}>
        <MetricCard
          label="Clusters"
          value={formatNumber(rawData.vCluster.length)}
          detail={rawData.vCluster.length > 0
            ? `${formatNumber(rawData.vCluster.reduce((sum, c) => sum + c.numCpuCores, 0))} total cores`
            : 'No vCluster data'}
          variant="primary"
          tooltip="Number of VMware clusters"
        />
      </Column>
      <Column lg={4} md={4} sm={2}>
        <MetricCard
          label="Hosts"
          value={formatNumber(rawData.vHost.length)}
          detail={rawData.vHost.length > 0
            ? `${formatNumber(Math.round(mibToGiB(rawData.vHost.reduce((sum, h) => sum + h.memoryMiB, 0))))} GiB total RAM`
            : 'No vHost data'}
          variant="teal"
          tooltip="Number of ESXi hosts"
        />
      </Column>
      <Column lg={4} md={4} sm={2}>
        <MetricCard
          label="Datastores"
          value={formatNumber(rawData.vDatastore.length)}
          detail={rawData.vDatastore.length > 0
            ? `${formatNumber(Math.round(mibToGiB(rawData.vDatastore.reduce((sum, d) => sum + d.capacityMiB, 0))))} GiB total`
            : 'No vDatastore data'}
          variant="purple"
          tooltip="Number of datastores"
        />
      </Column>

      {/* Row 3 — vCenter Details + Cluster Summary */}
      <Column lg={8} md={8} sm={4}>
        <Tile className="infrastructure-tab__table-tile">
          <h4>vCenter Details</h4>
          {rawData.vSource.length > 0 ? (
            <>
              {rawData.vSource.length > 1 && (
                <p style={{ marginBottom: '0.5rem' }}>{rawData.vSource.length} vCenter servers</p>
              )}
              {rawData.vSource.map((src, idx) => (
                <dl key={idx} className="infrastructure-tab__vcenter-list">
                  {rawData.vSource.length > 1 && (
                    <>
                      <dt>Server {idx + 1}</dt>
                      <dd>{src.server}</dd>
                    </>
                  )}
                  {rawData.vSource.length === 1 && (
                    <>
                      <dt>Server</dt>
                      <dd>{src.server}</dd>
                    </>
                  )}
                  <dt>Version</dt>
                  <dd>{src.version || '-'} (Build {src.build || '-'})</dd>
                  <dt>API Version</dt>
                  <dd>{src.apiVersion || '-'}</dd>
                  <dt>OS Type</dt>
                  <dd>{src.osType || '-'}</dd>
                  {src.fullName && (
                    <>
                      <dt>Full Name</dt>
                      <dd>{src.fullName}</dd>
                    </>
                  )}
                </dl>
              ))}
            </>
          ) : (
            <p className="infrastructure-tab__empty-state">No vSource data available</p>
          )}
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="infrastructure-tab__table-tile">
          <h4>Cluster Summary</h4>
          {rawData.vCluster.length > 0 ? (
            <DataTable rows={clusterRows} headers={clusterHeaders}>
              {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                <Table {...getTableProps()} size="sm">
                  <TableHead>
                    <TableRow>
                      {headers.map(header => {
                        const { key, ...headerProps } = getHeaderProps({ header });
                        return <TableHeader key={key} {...headerProps}>{header.header}</TableHeader>;
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(row => {
                      const { key, ...rowProps } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...rowProps}>
                          {row.cells.map(cell => (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </DataTable>
          ) : (
            <p className="infrastructure-tab__empty-state">No vCluster data available</p>
          )}
        </Tile>
      </Column>

      {/* Row 4 — Host Summary + Datastore Summary */}
      <Column lg={8} md={8} sm={4}>
        <Tile className="infrastructure-tab__table-tile">
          <h4>Host Summary</h4>
          {rawData.vHost.length > 0 ? (
            <>
              <DataTable rows={hostRows} headers={hostHeaders}>
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                  <Table {...getTableProps()} size="sm">
                    <TableHead>
                      <TableRow>
                        {headers.map(header => {
                          const { key, ...headerProps } = getHeaderProps({ header });
                          return <TableHeader key={key} {...headerProps}>{header.header}</TableHeader>;
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map(row => {
                        const { key, ...rowProps } = getRowProps({ row });
                        return (
                          <TableRow key={key} {...rowProps}>
                            {row.cells.map(cell => (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </DataTable>
              {rawData.vHost.length > MAX_TABLE_ROWS && (
                <p className="infrastructure-tab__row-note">
                  Showing {MAX_TABLE_ROWS} of {formatNumber(rawData.vHost.length)} hosts
                </p>
              )}
            </>
          ) : (
            <p className="infrastructure-tab__empty-state">No vHost data available</p>
          )}
        </Tile>
      </Column>

      <Column lg={8} md={8} sm={4}>
        <Tile className="infrastructure-tab__table-tile">
          <h4>Datastore Summary</h4>
          {rawData.vDatastore.length > 0 ? (
            <>
              <DataTable rows={datastoreRows} headers={datastoreHeaders}>
                {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                  <Table {...getTableProps()} size="sm">
                    <TableHead>
                      <TableRow>
                        {headers.map(header => {
                          const { key, ...headerProps } = getHeaderProps({ header });
                          return <TableHeader key={key} {...headerProps}>{header.header}</TableHeader>;
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map(row => {
                        const { key, ...rowProps } = getRowProps({ row });
                        return (
                          <TableRow key={key} {...rowProps}>
                            {row.cells.map(cell => (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </DataTable>
              {rawData.vDatastore.length > MAX_TABLE_ROWS && (
                <p className="infrastructure-tab__row-note">
                  Showing {MAX_TABLE_ROWS} of {formatNumber(rawData.vDatastore.length)} datastores
                </p>
              )}
            </>
          ) : (
            <p className="infrastructure-tab__empty-state">No vDatastore data available</p>
          )}
        </Tile>
      </Column>
    </Grid>
  );
}
