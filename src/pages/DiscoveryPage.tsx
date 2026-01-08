// Discovery page - Workload detection and infrastructure insights
import { Grid, Column, Tile, Tag, Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
import { Navigate } from 'react-router-dom';
import { useData, useVMs } from '@/hooks';
import { ROUTES } from '@/utils/constants';
import { formatNumber, mibToGiB } from '@/utils/formatters';
import { HorizontalBarChart } from '@/components/charts';
import { MetricCard, RedHatDocLink } from '@/components/common';
import workloadPatterns from '@/data/workloadPatterns.json';
import esxiVersions from '@/data/esxiVersions.json';
import './DiscoveryPage.scss';

// Types for workload detection
interface WorkloadMatch {
  vmName: string;
  category: string;
  categoryName: string;
  matchedPattern: string;
  source: 'name' | 'annotation';
}

interface ApplianceMatch {
  vmName: string;
  matchedPattern: string;
  source: 'name' | 'annotation';
}

// Detect workloads from VM names and annotations
function detectWorkloads(vms: { vmName: string; annotation: string | null }[]): WorkloadMatch[] {
  const matches: WorkloadMatch[] = [];
  const categories = workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>;

  for (const vm of vms) {
    const vmNameLower = vm.vmName.toLowerCase();
    const annotationLower = (vm.annotation || '').toLowerCase();

    for (const [categoryKey, category] of Object.entries(categories)) {
      for (const pattern of category.patterns) {
        if (vmNameLower.includes(pattern)) {
          matches.push({
            vmName: vm.vmName,
            category: categoryKey,
            categoryName: category.name,
            matchedPattern: pattern,
            source: 'name',
          });
          break; // Only match once per category per VM
        } else if (annotationLower.includes(pattern)) {
          matches.push({
            vmName: vm.vmName,
            category: categoryKey,
            categoryName: category.name,
            matchedPattern: pattern,
            source: 'annotation',
          });
          break;
        }
      }
    }
  }

  return matches;
}

// Detect appliances from VM names and annotations
function detectAppliances(vms: { vmName: string; annotation: string | null }[]): ApplianceMatch[] {
  const matches: ApplianceMatch[] = [];
  const applianceConfig = workloadPatterns.appliances;

  for (const vm of vms) {
    const vmNameLower = vm.vmName.toLowerCase();
    const annotationLower = (vm.annotation || '').toLowerCase();

    // Check name patterns
    for (const pattern of applianceConfig.patterns) {
      if (vmNameLower.includes(pattern)) {
        matches.push({
          vmName: vm.vmName,
          matchedPattern: pattern,
          source: 'name',
        });
        break;
      }
    }

    // Check annotation patterns
    if (!matches.find(m => m.vmName === vm.vmName)) {
      for (const pattern of applianceConfig.annotationPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(annotationLower)) {
          matches.push({
            vmName: vm.vmName,
            matchedPattern: pattern,
            source: 'annotation',
          });
          break;
        }
      }
    }
  }

  return matches;
}

// Get ESXi version status
function getEsxiVersionStatus(version: string): { status: string; label: string; color: string } {
  const versions = esxiVersions.versions as Record<string, { status: string; statusLabel: string; color: string }>;

  // Try to match version prefix
  for (const [key, info] of Object.entries(versions)) {
    if (version.includes(key)) {
      return { status: info.status, label: info.statusLabel, color: info.color };
    }
  }

  // Default for unknown versions
  return { status: 'unknown', label: 'Unknown', color: 'gray' };
}

export function DiscoveryPage() {
  const { rawData } = useData();
  const vms = useVMs();

  if (!rawData) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const poweredOnVMs = vms.filter(vm => vm.powerState === 'poweredOn');
  const hosts = rawData.vHost;
  const clusters = rawData.vCluster;
  const vMemory = rawData.vMemory;
  const licenses = rawData.vLicense;

  // ===== WORKLOAD DETECTION =====
  const workloadMatches = detectWorkloads(poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    annotation: vm.annotation,
  })));

  // Group by category
  const workloadsByCategory = workloadMatches.reduce((acc, match) => {
    if (!acc[match.category]) {
      acc[match.category] = { name: match.categoryName, vms: new Set<string>() };
    }
    acc[match.category].vms.add(match.vmName);
    return acc;
  }, {} as Record<string, { name: string; vms: Set<string> }>);

  const workloadChartData = Object.entries(workloadsByCategory)
    .map(([, data]) => ({
      label: data.name,
      value: data.vms.size,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ===== APPLIANCE DETECTION =====
  const applianceMatches = detectAppliances(poweredOnVMs.map(vm => ({
    vmName: vm.vmName,
    annotation: vm.annotation,
  })));

  const uniqueAppliances = new Set(applianceMatches.map(m => m.vmName)).size;

  // Group appliances by pattern
  const appliancesByType = applianceMatches.reduce((acc, match) => {
    const type = match.matchedPattern;
    if (!acc[type]) acc[type] = [];
    acc[type].push(match.vmName);
    return acc;
  }, {} as Record<string, string[]>);

  // ===== NETWORK EQUIPMENT DETECTION =====
  const networkCategory = (workloadPatterns.categories as Record<string, { name: string; patterns: string[] }>).network;
  const networkEquipment = poweredOnVMs.filter(vm => {
    const vmNameLower = vm.vmName.toLowerCase();
    return networkCategory.patterns.some(p => vmNameLower.includes(p));
  });

  // ===== ESXi VERSION ANALYSIS =====
  const esxiVersionCounts = hosts.reduce((acc, host) => {
    const version = host.esxiVersion || 'Unknown';
    if (!acc[version]) acc[version] = { count: 0, status: getEsxiVersionStatus(version) };
    acc[version].count++;
    return acc;
  }, {} as Record<string, { count: number; status: { status: string; label: string; color: string } }>);

  const esxiEOLHosts = Object.entries(esxiVersionCounts)
    .filter(([, data]) => data.status.status === 'eol')
    .reduce((sum, [, data]) => sum + data.count, 0);

  // ===== MEMORY BALLOON DETECTION =====
  const vMemoryMap = new Map(vMemory.map(m => [m.vmName, m]));
  const vmsWithBalloon = poweredOnVMs.filter(vm => {
    const memInfo = vMemoryMap.get(vm.vmName);
    return memInfo && (memInfo.ballooned || 0) > 0;
  });

  // ===== LARGE MEMORY VMS =====
  const MEMORY_2TB_MIB = 2 * 1024 * 1024; // 2TB in MiB
  const MEMORY_6TB_MIB = 6 * 1024 * 1024; // 6TB in MiB

  const vmsOver2TB = poweredOnVMs.filter(vm => vm.memory >= MEMORY_2TB_MIB && vm.memory < MEMORY_6TB_MIB);
  const vmsOver6TB = poweredOnVMs.filter(vm => vm.memory >= MEMORY_6TB_MIB);

  // ===== LARGE HOST CORES =====
  const hostsOver64Cores = hosts.filter(h => h.totalCpuCores > 64 && h.totalCpuCores <= 128);
  const hostsOver128Cores = hosts.filter(h => h.totalCpuCores > 128);

  // ===== CLUSTER HA RISK =====
  const clustersUnder3Hosts = clusters.filter(c => c.hostCount < 3);

  // ===== HOST HARDWARE MODELS =====
  const hostModels = hosts.reduce((acc, host) => {
    const model = `${host.vendor || 'Unknown'} ${host.model || 'Unknown'}`.trim();
    if (!acc[model]) acc[model] = 0;
    acc[model]++;
    return acc;
  }, {} as Record<string, number>);

  const hostModelChartData = Object.entries(hostModels)
    .map(([label, value]) => ({ label: label.substring(0, 30), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // ===== SUMMARY METRICS =====
  const totalWorkloadVMs = new Set(workloadMatches.map(m => m.vmName)).size;
  const workloadCategories = Object.keys(workloadsByCategory).length;

  return (
    <div className="discovery-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <h1 className="discovery-page__title">Infrastructure Discovery</h1>
          <p className="discovery-page__subtitle">
            Workload detection, appliance identification, and infrastructure insights
          </p>
        </Column>

        {/* Summary Cards */}
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Workload VMs"
            value={formatNumber(totalWorkloadVMs)}
            detail={`${workloadCategories} categories detected`}
            variant="primary"
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Appliances"
            value={formatNumber(uniqueAppliances)}
            detail="OVA/Virtual appliances"
            variant="purple"
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="Network Equipment"
            value={formatNumber(networkEquipment.length)}
            detail="Cisco, F5, NSX, etc."
            variant="teal"
          />
        </Column>
        <Column lg={4} md={4} sm={2}>
          <MetricCard
            label="ESXi EOL Hosts"
            value={formatNumber(esxiEOLHosts)}
            detail="End of life versions"
            variant={esxiEOLHosts > 0 ? 'error' : 'success'}
          />
        </Column>

        {/* Tabs */}
        <Column lg={16} md={8} sm={4}>
          <Tabs>
            <TabList aria-label="Discovery tabs">
              <Tab>Workloads</Tab>
              <Tab>Appliances</Tab>
              <Tab>Infrastructure</Tab>
              <Tab>Compute Checks</Tab>
              <Tab>Licensing</Tab>
            </TabList>
            <TabPanels>
              {/* Workloads Panel */}
              <TabPanel>
                <Grid className="discovery-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__chart-tile">
                      <HorizontalBarChart
                        title="Detected Workloads by Category"
                        subtitle={`${totalWorkloadVMs} VMs with identifiable workloads`}
                        data={workloadChartData}
                        height={350}
                        valueLabel="VMs"
                        formatValue={(v) => `${v} VM${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>Workload Categories</h3>
                      <div className="discovery-page__workload-list">
                        {Object.entries(workloadsByCategory)
                          .sort((a, b) => b[1].vms.size - a[1].vms.size)
                          .map(([key, data]) => (
                            <div key={key} className="discovery-page__workload-item">
                              <span className="discovery-page__workload-name">{data.name}</span>
                              <Tag type="blue">{data.vms.size}</Tag>
                            </div>
                          ))}
                        {Object.keys(workloadsByCategory).length === 0 && (
                          <p className="discovery-page__empty">No workloads detected from VM names</p>
                        )}
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="discovery-page__info-tile">
                      <h4>Workload Detection Method</h4>
                      <p>
                        Workloads are detected by analyzing VM names and annotations for common application patterns.
                        This includes middleware (JBoss, Tomcat), databases (Oracle, PostgreSQL), enterprise apps (SAP),
                        backup solutions (Veeam), and more. Detection helps identify application dependencies
                        and plan migration priorities.
                      </p>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Appliances Panel */}
              <TabPanel>
                <Grid className="discovery-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>Detected Appliances</h3>
                      <div className="discovery-page__appliance-list">
                        {Object.entries(appliancesByType)
                          .sort((a, b) => b[1].length - a[1].length)
                          .map(([type, vms]) => (
                            <div key={type} className="discovery-page__appliance-item">
                              <span className="discovery-page__appliance-type">{type}</span>
                              <Tag type="purple">{vms.length}</Tag>
                            </div>
                          ))}
                        {Object.keys(appliancesByType).length === 0 && (
                          <p className="discovery-page__empty">No appliances detected</p>
                        )}
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>Network Equipment VMs</h3>
                      <div className="discovery-page__network-list">
                        {networkEquipment.slice(0, 20).map(vm => (
                          <div key={vm.vmName} className="discovery-page__network-item">
                            <span>{vm.vmName}</span>
                            <Tag type="teal">{vm.powerState === 'poweredOn' ? 'On' : 'Off'}</Tag>
                          </div>
                        ))}
                        {networkEquipment.length > 20 && (
                          <p className="discovery-page__more">
                            ... and {networkEquipment.length - 20} more
                          </p>
                        )}
                        {networkEquipment.length === 0 && (
                          <p className="discovery-page__empty">No network equipment detected</p>
                        )}
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="discovery-page__info-tile">
                      <h4>Appliance Migration Considerations</h4>
                      <p>
                        Virtual appliances (OVAs) often have vendor-specific migration requirements.
                        VMware infrastructure appliances (vCenter, NSX) typically need to be rebuilt
                        rather than migrated. Third-party appliances may have licensing or support
                        implications when moved to a new platform.
                      </p>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Infrastructure Panel */}
              <TabPanel>
                <Grid className="discovery-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>ESXi Version Distribution</h3>
                      <div className="discovery-page__version-list">
                        {Object.entries(esxiVersionCounts)
                          .sort((a, b) => b[1].count - a[1].count)
                          .map(([version, data]) => (
                            <div key={version} className="discovery-page__version-item">
                              <span>{version}</span>
                              <div className="discovery-page__version-tags">
                                <Tag type={data.status.color === 'green' ? 'green' : data.status.color === 'red' ? 'red' : 'gray'}>
                                  {data.status.label}
                                </Tag>
                                <Tag type="blue">{data.count} host{data.count !== 1 ? 's' : ''}</Tag>
                              </div>
                            </div>
                          ))}
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__chart-tile">
                      <HorizontalBarChart
                        title="Host Hardware Models"
                        subtitle="Physical server distribution"
                        data={hostModelChartData}
                        height={300}
                        valueLabel="Hosts"
                        formatValue={(v) => `${v} host${v !== 1 ? 's' : ''}`}
                      />
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__checks-tile">
                      <h3>Cluster HA Status</h3>
                      <div className="discovery-page__check-items">
                        <div className="discovery-page__check-item">
                          <span>Clusters with &lt;3 Hosts</span>
                          <Tag type={clustersUnder3Hosts.length === 0 ? 'green' : 'magenta'}>
                            {clustersUnder3Hosts.length}
                          </Tag>
                        </div>
                        {clustersUnder3Hosts.map(c => (
                          <div key={c.name} className="discovery-page__cluster-detail">
                            <span>{c.name}</span>
                            <Tag type="gray">{c.hostCount} host{c.hostCount !== 1 ? 's' : ''}</Tag>
                          </div>
                        ))}
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__info-tile">
                      <h4>Hardware Compatibility</h4>
                      <p>
                        Review your host hardware models against the target platform's compatibility list.
                        Some server models may require specific drivers or configurations.
                      </p>
                      <div className="discovery-page__links">
                        <RedHatDocLink
                          href="https://catalog.redhat.com/hardware"
                          label="Red Hat Hardware Catalog"
                          description="Check server compatibility for RHEL and OpenShift"
                        />
                      </div>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>

              {/* Compute Checks Panel */}
              <TabPanel>
                <Grid className="discovery-page__tab-content">
                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__checks-tile">
                      <h3>Memory Checks</h3>
                      <div className="discovery-page__check-items">
                        <div className="discovery-page__check-item">
                          <span>VMs with Memory Balloon</span>
                          <Tag type={vmsWithBalloon.length === 0 ? 'green' : 'magenta'}>
                            {vmsWithBalloon.length}
                          </Tag>
                        </div>
                        <div className="discovery-page__check-item">
                          <span>VMs with 2-6TB Memory</span>
                          <Tag type={vmsOver2TB.length === 0 ? 'green' : 'magenta'}>
                            {vmsOver2TB.length}
                          </Tag>
                        </div>
                        <div className="discovery-page__check-item">
                          <span>VMs with &gt;6TB Memory</span>
                          <Tag type={vmsOver6TB.length === 0 ? 'green' : 'red'}>
                            {vmsOver6TB.length}
                          </Tag>
                        </div>
                      </div>
                    </Tile>
                  </Column>

                  <Column lg={8} md={8} sm={4}>
                    <Tile className="discovery-page__checks-tile">
                      <h3>Host Core Counts</h3>
                      <div className="discovery-page__check-items">
                        <div className="discovery-page__check-item">
                          <span>Hosts with 64-128 Cores</span>
                          <Tag type={hostsOver64Cores.length === 0 ? 'green' : 'teal'}>
                            {hostsOver64Cores.length}
                          </Tag>
                        </div>
                        <div className="discovery-page__check-item">
                          <span>Hosts with &gt;128 Cores</span>
                          <Tag type={hostsOver128Cores.length === 0 ? 'green' : 'magenta'}>
                            {hostsOver128Cores.length}
                          </Tag>
                        </div>
                      </div>
                      {hostsOver128Cores.length > 0 && (
                        <div className="discovery-page__host-list">
                          {hostsOver128Cores.slice(0, 5).map(h => (
                            <div key={h.name} className="discovery-page__host-detail">
                              <span>{h.name}</span>
                              <Tag type="gray">{h.totalCpuCores} cores</Tag>
                            </div>
                          ))}
                        </div>
                      )}
                    </Tile>
                  </Column>

                  {vmsWithBalloon.length > 0 && (
                    <Column lg={16} md={8} sm={4}>
                      <Tile className="discovery-page__list-tile">
                        <h3>VMs with Active Memory Ballooning</h3>
                        <div className="discovery-page__balloon-list">
                          {vmsWithBalloon.slice(0, 20).map(vm => {
                            const memInfo = vMemoryMap.get(vm.vmName);
                            return (
                              <div key={vm.vmName} className="discovery-page__balloon-item">
                                <span>{vm.vmName}</span>
                                <div className="discovery-page__balloon-tags">
                                  <Tag type="gray">{mibToGiB(vm.memory).toFixed(0)} GiB configured</Tag>
                                  <Tag type="magenta">{mibToGiB(memInfo?.ballooned || 0).toFixed(0)} GiB ballooned</Tag>
                                </div>
                              </div>
                            );
                          })}
                          {vmsWithBalloon.length > 20 && (
                            <p className="discovery-page__more">
                              ... and {vmsWithBalloon.length - 20} more VMs
                            </p>
                          )}
                        </div>
                      </Tile>
                    </Column>
                  )}
                </Grid>
              </TabPanel>

              {/* Licensing Panel */}
              <TabPanel>
                <Grid className="discovery-page__tab-content">
                  <Column lg={16} md={8} sm={4}>
                    <Tile className="discovery-page__list-tile">
                      <h3>VMware Licensing</h3>
                      {licenses.length > 0 ? (
                        <div className="discovery-page__license-list">
                          {licenses.map((license, idx) => (
                            <div key={idx} className="discovery-page__license-item">
                              <div className="discovery-page__license-name">
                                <strong>{license.productName || license.name}</strong>
                                {license.productVersion && (
                                  <span className="discovery-page__license-version">
                                    v{license.productVersion}
                                  </span>
                                )}
                              </div>
                              <div className="discovery-page__license-details">
                                <Tag type="blue">{license.used}/{license.total} used</Tag>
                                {license.expirationDate && (
                                  <Tag type={new Date(license.expirationDate) < new Date() ? 'red' : 'green'}>
                                    Expires: {new Date(license.expirationDate).toLocaleDateString()}
                                  </Tag>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="discovery-page__empty">
                          No license information available in the RVTools export.
                          Ensure the vLicense tab is included in the export.
                        </p>
                      )}
                    </Tile>
                  </Column>

                  <Column lg={16} md={8} sm={4}>
                    <Tile className="discovery-page__info-tile">
                      <h4>License Migration Considerations</h4>
                      <p>
                        VMware licenses are not transferable to OpenShift Virtualization.
                        Review your current licensing to understand the scope of migration
                        and plan for new licensing requirements on the target platform.
                        Windows and other guest OS licenses may need to be re-evaluated
                        based on the new hosting environment.
                      </p>
                    </Tile>
                  </Column>
                </Grid>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Column>
      </Grid>
    </div>
  );
}
