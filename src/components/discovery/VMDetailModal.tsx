/**
 * VMDetailModal Component
 *
 * Read-only modal showing all available RVTools data for a selected VM.
 * Tabs are conditionally rendered based on data availability.
 */

import { useMemo } from 'react';
import {
  Modal,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  InlineNotification,
} from '@carbon/react';
import { useData } from '@/hooks/useData';
import {
  formatMiB,
  formatNumber,
  formatDateTime,
  formatPowerState,
  formatHardwareVersion,
  formatPercent,
} from '@/utils/formatters';
import type {
  VirtualMachine,
  VCPUInfo,
  VMemoryInfo,
  VDiskInfo,
  VNetworkInfo,
  VSnapshotInfo,
  VToolsInfo,
  VPartitionInfo,
  VCDInfo,
} from '@/types/rvtools';
import './VMDetailModal.scss';

interface VMDetailModalProps {
  vmName: string | null;
  onClose: () => void;
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return value ? 'Yes' : 'No';
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number') return formatNumber(value);
  return value || 'N/A';
}

interface KVRow {
  label: string;
  value: string;
}

function KeyValueList({ rows }: { rows: KVRow[] }) {
  return (
    <StructuredListWrapper isCondensed>
      <StructuredListHead>
        <StructuredListRow head>
          <StructuredListCell head>Property</StructuredListCell>
          <StructuredListCell head>Value</StructuredListCell>
        </StructuredListRow>
      </StructuredListHead>
      <StructuredListBody>
        {rows.map(({ label, value }) => (
          <StructuredListRow key={label}>
            <StructuredListCell className="vm-detail-modal__label">
              {label}
            </StructuredListCell>
            <StructuredListCell>{value}</StructuredListCell>
          </StructuredListRow>
        ))}
      </StructuredListBody>
    </StructuredListWrapper>
  );
}

function buildGeneralRows(vm: VirtualMachine): KVRow[] {
  return [
    { label: 'VM Name', value: vm.vmName },
    { label: 'Power State', value: formatPowerState(vm.powerState) },
    { label: 'Template', value: formatBoolean(vm.template) },
    { label: 'Guest OS', value: vm.guestOS },
    { label: 'DNS Name', value: formatValue(vm.dnsName) },
    { label: 'Guest Hostname', value: formatValue(vm.guestHostname) },
    { label: 'Guest IP', value: formatValue(vm.guestIP) },
    { label: 'vCPUs', value: formatNumber(vm.cpus) },
    { label: 'Memory', value: formatMiB(vm.memory) },
    { label: 'NICs', value: formatNumber(vm.nics) },
    { label: 'Disks', value: formatNumber(vm.disks) },
    { label: 'Provisioned Storage', value: formatMiB(vm.provisionedMiB) },
    { label: 'In Use Storage', value: formatMiB(vm.inUseMiB) },
    { label: 'Hardware Version', value: formatHardwareVersion(vm.hardwareVersion) },
    { label: 'Firmware', value: formatValue(vm.firmwareType) },
    { label: 'Datacenter', value: vm.datacenter },
    { label: 'Cluster', value: vm.cluster },
    { label: 'Host', value: vm.host },
    { label: 'Resource Pool', value: formatValue(vm.resourcePool) },
    { label: 'Folder', value: formatValue(vm.folder) },
    { label: 'UUID', value: formatValue(vm.uuid) },
    { label: 'Connection State', value: vm.connectionState },
    { label: 'Config Status', value: vm.configStatus },
    { label: 'Guest State', value: vm.guestState },
    { label: 'CBT Enabled', value: formatBoolean(vm.cbtEnabled) },
    { label: 'Consolidation Needed', value: formatBoolean(vm.consolidationNeeded) },
    { label: 'FT State', value: formatValue(vm.ftState) },
    { label: 'Power On Date', value: formatDateTime(vm.powerOnDate) },
    { label: 'Creation Date', value: formatDateTime(vm.creationDate) },
    { label: 'Annotation', value: formatValue(vm.annotation) },
  ];
}

function buildCPURows(cpu: VCPUInfo): KVRow[] {
  return [
    { label: 'vCPUs', value: formatNumber(cpu.cpus) },
    { label: 'Sockets', value: formatNumber(cpu.sockets) },
    { label: 'Cores per Socket', value: formatNumber(cpu.coresPerSocket) },
    { label: 'Max CPU', value: formatNumber(cpu.maxCpu) },
    { label: 'Shares', value: formatNumber(cpu.shares) },
    { label: 'Reservation', value: `${formatNumber(cpu.reservation)} MHz` },
    { label: 'Limit', value: cpu.limit === -1 ? 'Unlimited' : `${formatNumber(cpu.limit)} MHz` },
    { label: 'Hot Add Enabled', value: formatBoolean(cpu.hotAddEnabled) },
    { label: 'Overall Level', value: formatValue(cpu.overallLevel) },
    { label: 'Affinity Rule', value: formatValue(cpu.affinityRule) },
  ];
}

function buildMemoryRows(mem: VMemoryInfo): KVRow[] {
  return [
    { label: 'Memory', value: formatMiB(mem.memoryMiB) },
    { label: 'Shares', value: formatNumber(mem.shares) },
    { label: 'Reservation', value: formatMiB(mem.reservation) },
    { label: 'Limit', value: mem.limit === -1 ? 'Unlimited' : formatMiB(mem.limit) },
    { label: 'Hot Add Enabled', value: formatBoolean(mem.hotAddEnabled) },
    { label: 'Overall Level', value: formatValue(mem.overallLevel) },
    { label: 'Active', value: mem.active !== null ? formatMiB(mem.active) : 'N/A' },
    { label: 'Consumed', value: mem.consumed !== null ? formatMiB(mem.consumed) : 'N/A' },
    { label: 'Ballooned', value: mem.ballooned !== null ? formatMiB(mem.ballooned) : 'N/A' },
    { label: 'Swapped', value: mem.swapped !== null ? formatMiB(mem.swapped) : 'N/A' },
    { label: 'Compressed', value: mem.compressed !== null ? formatMiB(mem.compressed) : 'N/A' },
  ];
}

function buildToolsRows(tools: VToolsInfo): KVRow[] {
  return [
    { label: 'Tools Status', value: tools.toolsStatus },
    { label: 'Tools Version', value: formatValue(tools.toolsVersion) },
    { label: 'Required Version', value: formatValue(tools.requiredVersion) },
    { label: 'Upgradeable', value: formatBoolean(tools.upgradeable) },
    { label: 'Upgrade Policy', value: tools.upgradePolicy },
    { label: 'Sync Time', value: formatBoolean(tools.syncTime) },
    { label: 'VM Version', value: tools.vmVersion },
    { label: 'App Status', value: formatValue(tools.appStatus) },
    { label: 'Heartbeat Status', value: formatValue(tools.heartbeatStatus) },
    { label: 'Operation Ready', value: formatBoolean(tools.operationReady) },
  ];
}

interface TabDef {
  label: string;
  content: React.ReactNode;
}

function StorageTab({ disks }: { disks: VDiskInfo[] }) {
  const totalCapacity = disks.reduce((sum, d) => sum + d.capacityMiB, 0);
  const headers = [
    { key: 'diskLabel', header: 'Label' },
    { key: 'capacity', header: 'Capacity' },
    { key: 'thin', header: 'Thin' },
    { key: 'diskMode', header: 'Mode' },
    { key: 'controllerType', header: 'Controller' },
    { key: 'diskPath', header: 'Path' },
  ];
  const rows = disks.map((d, i) => ({
    id: `disk-${i}`,
    diskLabel: d.diskLabel,
    capacity: formatMiB(d.capacityMiB),
    thin: formatBoolean(d.thin),
    diskMode: d.diskMode,
    controllerType: d.controllerType,
    diskPath: d.diskPath,
  }));

  return (
    <div>
      <p className="vm-detail-modal__summary">
        {disks.length} disk{disks.length !== 1 ? 's' : ''} — {formatMiB(totalCapacity)} total
      </p>
      <DataTable rows={rows} headers={headers}>
        {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps, getTableProps }) => (
          <Table {...getTableProps()} size="sm">
            <TableHead>
              <TableRow>
                {tableHeaders.map(h => (
                  <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map(row => (
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
    </div>
  );
}

function NetworkTab({ nics }: { nics: VNetworkInfo[] }) {
  const headers = [
    { key: 'nicLabel', header: 'Label' },
    { key: 'adapterType', header: 'Type' },
    { key: 'networkName', header: 'Network' },
    { key: 'macAddress', header: 'MAC Address' },
    { key: 'ipv4Address', header: 'IPv4' },
    { key: 'connected', header: 'Connected' },
  ];
  const rows = nics.map((n, i) => ({
    id: `nic-${i}`,
    nicLabel: n.nicLabel,
    adapterType: n.adapterType,
    networkName: n.networkName,
    macAddress: n.macAddress,
    ipv4Address: formatValue(n.ipv4Address),
    connected: formatBoolean(n.connected),
  }));

  return (
    <DataTable rows={rows} headers={headers}>
      {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps, getTableProps }) => (
        <Table {...getTableProps()} size="sm">
          <TableHead>
            <TableRow>
              {tableHeaders.map(h => (
                <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows.map(row => (
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
  );
}

function SnapshotTab({ snapshots }: { snapshots: VSnapshotInfo[] }) {
  const hasOldSnapshots = snapshots.some(s => s.ageInDays > 30);
  const headers = [
    { key: 'snapshotName', header: 'Name' },
    { key: 'dateTime', header: 'Date' },
    { key: 'ageInDays', header: 'Age (days)' },
    { key: 'sizeTotalMiB', header: 'Size' },
    { key: 'description', header: 'Description' },
    { key: 'quiesced', header: 'Quiesced' },
  ];
  const rows = snapshots.map((s, i) => ({
    id: `snap-${i}`,
    snapshotName: s.snapshotName,
    dateTime: formatDateTime(s.dateTime),
    ageInDays: formatNumber(s.ageInDays),
    sizeTotalMiB: formatMiB(s.sizeTotalMiB),
    description: formatValue(s.description),
    quiesced: formatBoolean(s.quiesced),
  }));

  return (
    <div>
      {hasOldSnapshots && (
        <InlineNotification
          kind="warning"
          title="Old snapshots detected"
          subtitle="One or more snapshots are older than 30 days. Consider consolidating before migration."
          lowContrast
          hideCloseButton
          className="vm-detail-modal__snapshot-warning"
        />
      )}
      <DataTable rows={rows} headers={headers}>
        {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps, getTableProps }) => (
          <Table {...getTableProps()} size="sm">
            <TableHead>
              <TableRow>
                {tableHeaders.map(h => (
                  <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableRows.map(row => {
                const snap = snapshots[parseInt(row.id.split('-')[1])];
                return (
                  <TableRow {...getRowProps({ row })} key={row.id} className={snap?.ageInDays > 30 ? 'vm-detail-modal__row--warning' : ''}>
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
    </div>
  );
}

function PartitionTab({ partitions }: { partitions: VPartitionInfo[] }) {
  const headers = [
    { key: 'partition', header: 'Partition' },
    { key: 'capacity', header: 'Capacity' },
    { key: 'consumed', header: 'Used' },
    { key: 'free', header: 'Free' },
    { key: 'freePercent', header: 'Free %' },
  ];
  const rows = partitions.map((p, i) => ({
    id: `part-${i}`,
    partition: p.partition,
    capacity: formatMiB(p.capacityMiB),
    consumed: formatMiB(p.consumedMiB),
    free: formatMiB(p.freeMiB),
    freePercent: formatPercent(p.freePercent),
  }));

  return (
    <DataTable rows={rows} headers={headers}>
      {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps, getTableProps }) => (
        <Table {...getTableProps()} size="sm">
          <TableHead>
            <TableRow>
              {tableHeaders.map(h => (
                <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows.map(row => (
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
  );
}

function CDTab({ cds }: { cds: VCDInfo[] }) {
  const headers = [
    { key: 'deviceNode', header: 'Device' },
    { key: 'deviceType', header: 'Type' },
    { key: 'connected', header: 'Connected' },
    { key: 'startsConnected', header: 'Starts Connected' },
  ];
  const rows = cds.map((c, i) => ({
    id: `cd-${i}`,
    deviceNode: c.deviceNode,
    deviceType: c.deviceType,
    connected: formatBoolean(c.connected),
    startsConnected: formatBoolean(c.startsConnected),
  }));

  return (
    <DataTable rows={rows} headers={headers}>
      {({ rows: tableRows, headers: tableHeaders, getHeaderProps, getRowProps, getTableProps }) => (
        <Table {...getTableProps()} size="sm">
          <TableHead>
            <TableRow>
              {tableHeaders.map(h => (
                <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {tableRows.map(row => (
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
  );
}

export function VMDetailModal({ vmName, onClose }: VMDetailModalProps) {
  const { rawData } = useData();

  const vm = useMemo(() => {
    if (!vmName || !rawData) return null;
    return rawData.vInfo.find(v => v.vmName === vmName) ?? null;
  }, [vmName, rawData]);

  const cpuInfo = useMemo(() => {
    if (!vmName || !rawData) return null;
    return rawData.vCPU.find(c => c.vmName === vmName) ?? null;
  }, [vmName, rawData]);

  const memoryInfo = useMemo(() => {
    if (!vmName || !rawData) return null;
    return rawData.vMemory.find(m => m.vmName === vmName) ?? null;
  }, [vmName, rawData]);

  const disks = useMemo(() => {
    if (!vmName || !rawData) return [];
    return rawData.vDisk.filter(d => d.vmName === vmName);
  }, [vmName, rawData]);

  const nics = useMemo(() => {
    if (!vmName || !rawData) return [];
    return rawData.vNetwork.filter(n => n.vmName === vmName);
  }, [vmName, rawData]);

  const snapshots = useMemo(() => {
    if (!vmName || !rawData) return [];
    return rawData.vSnapshot.filter(s => s.vmName === vmName);
  }, [vmName, rawData]);

  const toolsInfo = useMemo(() => {
    if (!vmName || !rawData) return null;
    return rawData.vTools.find(t => t.vmName === vmName) ?? null;
  }, [vmName, rawData]);

  const partitions = useMemo(() => {
    if (!vmName || !rawData) return [];
    return rawData.vPartition.filter(p => p.vmName === vmName);
  }, [vmName, rawData]);

  const cds = useMemo(() => {
    if (!vmName || !rawData) return [];
    return rawData.vCD.filter(c => c.vmName === vmName);
  }, [vmName, rawData]);

  const tabs = useMemo((): TabDef[] => {
    if (!vm) return [];
    const result: TabDef[] = [];

    // General — always shown
    result.push({
      label: 'General',
      content: <KeyValueList rows={buildGeneralRows(vm)} />,
    });

    if (cpuInfo) {
      result.push({
        label: 'CPU',
        content: <KeyValueList rows={buildCPURows(cpuInfo)} />,
      });
    }

    if (memoryInfo) {
      result.push({
        label: 'Memory',
        content: <KeyValueList rows={buildMemoryRows(memoryInfo)} />,
      });
    }

    if (disks.length > 0) {
      result.push({
        label: 'Storage',
        content: <StorageTab disks={disks} />,
      });
    }

    if (nics.length > 0) {
      result.push({
        label: 'Network',
        content: <NetworkTab nics={nics} />,
      });
    }

    if (snapshots.length > 0) {
      result.push({
        label: 'Snapshots',
        content: <SnapshotTab snapshots={snapshots} />,
      });
    }

    if (toolsInfo) {
      result.push({
        label: 'Tools',
        content: <KeyValueList rows={buildToolsRows(toolsInfo)} />,
      });
    }

    if (partitions.length > 0) {
      result.push({
        label: 'Partitions',
        content: <PartitionTab partitions={partitions} />,
      });
    }

    if (cds.length > 0) {
      result.push({
        label: 'CD/DVD',
        content: <CDTab cds={cds} />,
      });
    }

    return result;
  }, [vm, cpuInfo, memoryInfo, disks, nics, snapshots, toolsInfo, partitions, cds]);

  const powerStateTag = vm ? (
    vm.powerState === 'poweredOn' ? <Tag type="green" size="sm">Powered On</Tag> :
    vm.powerState === 'poweredOff' ? <Tag type="gray" size="sm">Powered Off</Tag> :
    <Tag type="magenta" size="sm">Suspended</Tag>
  ) : null;

  return (
    <Modal
      open={vmName !== null}
      onRequestClose={onClose}
      passiveModal
      size="lg"
      modalHeading={
        <span className="vm-detail-modal__heading">
          {vmName} {powerStateTag}
        </span>
      }
      modalLabel="VM Details"
      className="vm-detail-modal"
    >
      {vm && tabs.length > 0 && (
        <Tabs>
          <TabList aria-label="VM detail sections" contained>
            {tabs.map(tab => (
              <Tab key={tab.label}>{tab.label}</Tab>
            ))}
          </TabList>
          <TabPanels>
            {tabs.map(tab => (
              <TabPanel key={tab.label} className="vm-detail-modal__tab-panel">
                {tab.content}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      )}
    </Modal>
  );
}

export default VMDetailModal;
