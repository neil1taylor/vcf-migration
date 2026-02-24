// Data tables page with enhanced TanStack Table integration
import { useMemo } from 'react';
import { Grid, Column, Tile, Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useData } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber } from '@/utils/formatters';
import { EnhancedDataTable } from '@/components/tables';
import { useTablesData } from '@/pages/tables/useTablesData';
import {
  createVMColumns,
  createDatastoreColumns,
  createSnapshotColumns,
  createHostColumns,
  createNetworkColumns,
  createResourcePoolColumns,
  createClusterColumns,
  createVCPUColumns,
  createVMemoryColumns,
  createVDiskColumns,
  createVCDColumns,
  createVToolsColumns,
  createVLicenseColumns,
  createVSourceColumns,
} from '@/pages/tables/tableDefinitions';
import './TablesPage.scss';

// Tab slug to index mapping
const TAB_SLUGS: Record<string, number> = {
  vms: 0,
  hosts: 1,
  clusters: 2,
  datastores: 3,
  networks: 4,
  'resource-pools': 5,
  vcpu: 6,
  vmemory: 7,
  vdisk: 8,
  snapshots: 9,
  'vmware-tools': 10,
  'cd-roms': 11,
  licenses: 12,
  vcenter: 13,
};

// Reverse mapping: index to slug
const TAB_INDEX_TO_SLUG = Object.entries(TAB_SLUGS).reduce(
  (acc, [slug, index]) => { acc[index] = slug; return acc; },
  {} as Record<number, string>
);

export function TablesPage() {
  const { rawData } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const selectedTabIndex = tabParam && TAB_SLUGS[tabParam] !== undefined ? TAB_SLUGS[tabParam] : 0;

  const handleTabChange = ({ selectedIndex }: { selectedIndex: number }) => {
    const slug = TAB_INDEX_TO_SLUG[selectedIndex];
    if (slug && slug !== 'vms') {
      setSearchParams({ tab: slug }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  // Data transformers
  const {
    vmData,
    datastoreData,
    snapshotData,
    hostData,
    networkData,
    resourcePoolData,
    clusterData,
    vcpuData,
    vmemoryData,
    vdiskData,
    vcdData,
    vtoolsData,
    vlicenseData,
    vsourceData,
  } = useTablesData(rawData);

  // Column definitions
  const vmColumns = useMemo(() => createVMColumns(), []);
  const datastoreColumns = useMemo(() => createDatastoreColumns(), []);
  const snapshotColumns = useMemo(() => createSnapshotColumns(), []);
  const hostColumns = useMemo(() => createHostColumns(), []);
  const networkColumns = useMemo(() => createNetworkColumns(), []);
  const resourcePoolColumns = useMemo(() => createResourcePoolColumns(), []);
  const clusterColumns = useMemo(() => createClusterColumns(), []);
  const vcpuColumns = useMemo(() => createVCPUColumns(), []);
  const vmemoryColumns = useMemo(() => createVMemoryColumns(), []);
  const vdiskColumns = useMemo(() => createVDiskColumns(), []);
  const vcdColumns = useMemo(() => createVCDColumns(), []);
  const vtoolsColumns = useMemo(() => createVToolsColumns(), []);
  const vlicenseColumns = useMemo(() => createVLicenseColumns(), []);
  const vsourceColumns = useMemo(() => createVSourceColumns(), []);

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <div className="tables-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="tables-page__title">Data Tables</h1>
          <p className="tables-page__subtitle">
            Detailed infrastructure data with search, sort, and export capabilities
          </p>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile className="tables-page__table-tile">
            <Tabs selectedIndex={selectedTabIndex} onChange={handleTabChange}>
              <TabList aria-label="Data tables" contained>
                <Tab>VMs ({formatNumber(vmData.length)})</Tab>
                <Tab>Hosts ({formatNumber(hostData.length)})</Tab>
                <Tab>Clusters ({formatNumber(clusterData.length)})</Tab>
                <Tab>Datastores ({formatNumber(datastoreData.length)})</Tab>
                <Tab>Networks ({formatNumber(networkData.length)})</Tab>
                <Tab>Resource Pools ({formatNumber(resourcePoolData.length)})</Tab>
                <Tab>vCPU ({formatNumber(vcpuData.length)})</Tab>
                <Tab>vMemory ({formatNumber(vmemoryData.length)})</Tab>
                <Tab>vDisk ({formatNumber(vdiskData.length)})</Tab>
                <Tab>Snapshots ({formatNumber(snapshotData.length)})</Tab>
                <Tab>VMware Tools ({formatNumber(vtoolsData.length)})</Tab>
                <Tab>CD-ROMs ({formatNumber(vcdData.length)})</Tab>
                <Tab>Licenses ({formatNumber(vlicenseData.length)})</Tab>
                <Tab>vCenter ({formatNumber(vsourceData.length)})</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <EnhancedDataTable
                    data={vmData}
                    columns={vmColumns}
                    title="Virtual Machines"
                    description={`${formatNumber(vmData.length)} VMs in inventory`}
                    exportFilename="vm-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={hostData}
                    columns={hostColumns}
                    title="ESXi Hosts"
                    description={`${formatNumber(hostData.length)} hosts in inventory`}
                    exportFilename="host-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={clusterData}
                    columns={clusterColumns}
                    title="Clusters"
                    description={`${formatNumber(clusterData.length)} clusters in inventory`}
                    exportFilename="cluster-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={datastoreData}
                    columns={datastoreColumns}
                    title="Datastores"
                    description={`${formatNumber(datastoreData.length)} datastores in inventory`}
                    exportFilename="datastore-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={networkData}
                    columns={networkColumns}
                    title="Network Adapters"
                    description={`${formatNumber(networkData.length)} network adapters in inventory`}
                    exportFilename="network-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={resourcePoolData}
                    columns={resourcePoolColumns}
                    title="Resource Pools"
                    description={`${formatNumber(resourcePoolData.length)} resource pools in inventory`}
                    exportFilename="resourcepool-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vcpuData}
                    columns={vcpuColumns}
                    title="vCPU Configuration"
                    description={`${formatNumber(vcpuData.length)} VM CPU configurations`}
                    exportFilename="vcpu-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vmemoryData}
                    columns={vmemoryColumns}
                    title="vMemory Configuration"
                    description={`${formatNumber(vmemoryData.length)} VM memory configurations`}
                    exportFilename="vmemory-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vdiskData}
                    columns={vdiskColumns}
                    title="Virtual Disks"
                    description={`${formatNumber(vdiskData.length)} virtual disks in inventory`}
                    exportFilename="vdisk-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={snapshotData}
                    columns={snapshotColumns}
                    title="Snapshots"
                    description={`${formatNumber(snapshotData.length)} snapshots found`}
                    exportFilename="snapshot-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vtoolsData}
                    columns={vtoolsColumns}
                    title="VMware Tools"
                    description={`${formatNumber(vtoolsData.length)} VMs with Tools info`}
                    exportFilename="vmtools-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vcdData}
                    columns={vcdColumns}
                    title="CD-ROM Devices"
                    description={`${formatNumber(vcdData.length)} CD-ROM devices in inventory`}
                    exportFilename="cdrom-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vlicenseData}
                    columns={vlicenseColumns}
                    title="VMware Licenses"
                    description={`${formatNumber(vlicenseData.length)} licenses in inventory`}
                    exportFilename="license-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
                <TabPanel>
                  <EnhancedDataTable
                    data={vsourceData}
                    columns={vsourceColumns}
                    title="vCenter Sources"
                    description={`${formatNumber(vsourceData.length)} vCenter servers`}
                    exportFilename="vcenter-inventory"
                    defaultPageSize={25}
                  />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
