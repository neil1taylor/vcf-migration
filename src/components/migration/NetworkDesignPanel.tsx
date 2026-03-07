// Network Design Panel — VPC Topology Design (embedded in VSI Migration page)
import { useMemo } from 'react';
import {
  Grid,
  Column,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Dropdown,
  Button,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TextInput,
  Tag,
  Tile,
  InlineNotification,
} from '@carbon/react';
import { Reset, Add, TrashCan } from '@carbon/icons-react';
import { useData } from '@/hooks';
import { useVPCDesign } from '@/hooks/useVPCDesign';
import { MetricCard } from '@/components/common';
import { VPCTopologyDiagram } from '@/components/charts/VPCTopologyDiagram';
import { IBM_CLOUD_REGIONS, getZonesForRegion } from '@/types/vpcDesign';
import '@/pages/NetworkDesignPage.scss';

export function NetworkDesignPanel() {
  const { rawData } = useData();

  // Build a simple workload map — in production this would come from classification
  const workloadMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (rawData) {
      rawData.vInfo.forEach(vm => {
        map[vm.vmName] = 'Default';
      });
    }
    return map;
  }, [rawData]);

  const {
    design,
    region,
    setRegion,
    updateSubnetZone,
    updateSubnetCIDR,
    updateSubnetName,
    addTransitGateway,
    removeTransitGateway,
    updateTransitGateway,
    addConnection,
    removeConnection,
    updateConnection,
    regenerateDesign,
  } = useVPCDesign(workloadMap);

  const connectionTypeLabels: Record<string, string> = { vpc: 'VPC', classic: 'Classic Infrastructure', directlink: 'Direct Link', gre: 'GRE Tunnel' };

  if (!rawData) {
    return null;
  }

  const hasVNetwork = rawData.vNetwork.length > 0;
  const zones = getZonesForRegion(region);
  const totalVMs = design.subnets.reduce((sum, s) => sum + s.vmCount, 0);

  return (
    <Grid className="migration-page__tab-content">
      <Column sm={4} md={8} lg={16}>
        <div className="network-design__header">
          <h3>Network Design</h3>
          <div className="network-design__actions">
            <Dropdown
              id="region-select"
              titleText="Region"
              label="Select region"
              items={IBM_CLOUD_REGIONS.map(r => r)}
              itemToString={(item: (typeof IBM_CLOUD_REGIONS)[number] | null) => item?.label ?? ''}
              selectedItem={IBM_CLOUD_REGIONS.find(r => r.id === region) ?? IBM_CLOUD_REGIONS[0]}
              onChange={({ selectedItem }: { selectedItem: (typeof IBM_CLOUD_REGIONS)[number] | null }) => {
                if (selectedItem) setRegion(selectedItem.id);
              }}
              size="sm"
              style={{ minWidth: '200px' }}
            />
            <Button kind="ghost" size="sm" renderIcon={Reset} onClick={regenerateDesign}>
              Regenerate
            </Button>
          </div>
        </div>
      </Column>

      {!hasVNetwork && (
        <Column sm={4} md={8} lg={16} style={{ marginBottom: '1rem' }}>
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            title="Limited data:"
            subtitle="The uploaded file does not contain a vNetwork sheet. Network design is based on VM data only and may be incomplete. Re-export with the vNetwork tab for full port group mapping."
          />
        </Column>
      )}

      {/* Metric Cards */}
      <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
        <MetricCard label="Subnets" value={design.subnets.length} variant="primary" />
      </Column>
      <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
        <MetricCard label="Zones" value={design.zones.filter(z => z.subnets.length > 0).length} variant="teal" />
      </Column>
      <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
        <MetricCard label="Security Groups" value={design.securityGroups.length} variant="info" />
      </Column>
      <Column sm={4} md={2} lg={4} style={{ marginBottom: '1rem' }}>
        <MetricCard label="VMs Mapped" value={totalVMs} variant="purple" />
      </Column>

      {/* Topology Diagram */}
      <Column sm={4} md={8} lg={16} style={{ marginBottom: '2rem' }}>
        <VPCTopologyDiagram
          design={design}
          subtitle={`${design.subnets.length} subnets across ${design.zones.filter(z => z.subnets.length > 0).length} zones`}
          height={450}
        />
      </Column>

      {/* Tabbed Details */}
      <Column sm={4} md={8} lg={16}>
        <Tabs>
          <TabList aria-label="Network design tabs">
            <Tab>Subnets</Tab>
            <Tab>Security Groups</Tab>
            <Tab>ACLs</Tab>
            <Tab>Transit Gateway</Tab>
          </TabList>
          <TabPanels>
            {/* Subnets Tab */}
            <TabPanel>
              <Table size="md">
                <TableHead>
                  <TableRow>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>CIDR</TableHeader>
                    <TableHeader>Zone</TableHeader>
                    <TableHeader>Source Port Group</TableHeader>
                    <TableHeader>VMs</TableHeader>
                    <TableHeader>Purpose</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {design.subnets.map(subnet => (
                    <TableRow key={subnet.id}>
                      <TableCell>
                        <TextInput
                          id={`sn-name-${subnet.id}`}
                          labelText=""
                          hideLabel
                          size="sm"
                          value={subnet.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSubnetName(subnet.id, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          id={`sn-cidr-${subnet.id}`}
                          labelText=""
                          hideLabel
                          size="sm"
                          value={subnet.cidr}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSubnetCIDR(subnet.id, e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Dropdown
                          id={`sn-zone-${subnet.id}`}
                          label=""
                          titleText=""
                          hideLabel
                          items={zones}
                          selectedItem={subnet.zone}
                          itemToString={(item: string | null) => item ?? ''}
                          onChange={({ selectedItem }: { selectedItem: string | null }) => {
                            if (selectedItem) updateSubnetZone(subnet.id, selectedItem);
                          }}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>{subnet.sourcePortGroup}</TableCell>
                      <TableCell>{subnet.vmCount}</TableCell>
                      <TableCell>
                        <Tag type="blue" size="sm">{subnet.purpose}</Tag>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabPanel>

            {/* Security Groups Tab */}
            <TabPanel>
              {design.securityGroups.map(sg => (
                <div key={sg.id} style={{ marginBottom: '1rem' }}>
                  <h4>{sg.name} <Tag type="blue" size="sm">{sg.workloadType}</Tag></h4>
                  <Table size="sm">
                    <TableHead>
                      <TableRow>
                        <TableHeader>Direction</TableHeader>
                        <TableHeader>Protocol</TableHeader>
                        <TableHeader>Port Range</TableHeader>
                        <TableHeader>Source/Dest</TableHeader>
                        <TableHeader>Description</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...sg.inboundRules, ...sg.outboundRules].map((rule, ri) => (
                        <TableRow key={ri}>
                          <TableCell>
                            <Tag type={rule.direction === 'inbound' ? 'green' : 'blue'} size="sm">
                              {rule.direction}
                            </Tag>
                          </TableCell>
                          <TableCell>{rule.protocol}</TableCell>
                          <TableCell>
                            {rule.portMin && rule.portMax
                              ? rule.portMin === rule.portMax ? rule.portMin : `${rule.portMin}–${rule.portMax}`
                              : 'All'}
                          </TableCell>
                          <TableCell>{rule.source}</TableCell>
                          <TableCell>{rule.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </TabPanel>

            {/* ACLs Tab */}
            <TabPanel>
              {design.aclSuggestions.map(acl => (
                <div key={acl.subnetId} style={{ marginBottom: '1rem' }}>
                  <h4>{acl.subnetName}</h4>
                  <Table size="sm">
                    <TableHead>
                      <TableRow>
                        <TableHeader>Rule</TableHeader>
                        <TableHeader>Direction</TableHeader>
                        <TableHeader>Action</TableHeader>
                        <TableHeader>Protocol</TableHeader>
                        <TableHeader>Source</TableHeader>
                        <TableHeader>Destination</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {acl.rules.map((rule, ri) => (
                        <TableRow key={ri}>
                          <TableCell>{rule.name}</TableCell>
                          <TableCell>{rule.direction}</TableCell>
                          <TableCell>
                            <Tag type={rule.action === 'allow' ? 'green' : 'red'} size="sm">
                              {rule.action}
                            </Tag>
                          </TableCell>
                          <TableCell>{rule.protocol}</TableCell>
                          <TableCell>{rule.source}</TableCell>
                          <TableCell>{rule.destination}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </TabPanel>

            {/* Transit Gateway Tab */}
            <TabPanel>
              <div style={{ marginBottom: '1rem' }}>
                <Button kind="ghost" size="sm" renderIcon={Add} onClick={addTransitGateway}>
                  Add Transit Gateway
                </Button>
              </div>
              {design.transitGateways.length === 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                  No transit gateways configured. Add one to connect your VPC to other networks.
                </p>
              )}
              {design.transitGateways.map(gw => (
                <Tile key={gw.id} style={{ marginBottom: '1rem', padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
                    <TextInput
                      id={`tgw-name-${gw.id}`}
                      labelText="Gateway Name"
                      size="sm"
                      value={gw.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTransitGateway(gw.id, { name: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <Button
                      kind="danger--ghost"
                      size="sm"
                      renderIcon={TrashCan}
                      iconDescription="Delete gateway"
                      hasIconOnly
                      onClick={() => removeTransitGateway(gw.id)}
                    />
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <Button kind="ghost" size="sm" renderIcon={Add} onClick={() => addConnection(gw.id)}>
                      Add Connection
                    </Button>
                  </div>
                  {gw.connections.length > 0 && (
                    <Table size="sm">
                      <TableHead>
                        <TableRow>
                          <TableHeader>Connection Name</TableHeader>
                          <TableHeader>Type</TableHeader>
                          <TableHeader style={{ width: '4rem' }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {gw.connections.map(conn => (
                          <TableRow key={conn.id}>
                            <TableCell>
                              <TextInput
                                id={`conn-name-${conn.id}`}
                                labelText=""
                                hideLabel
                                size="sm"
                                value={conn.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConnection(gw.id, conn.id, { name: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Dropdown
                                id={`conn-type-${conn.id}`}
                                label=""
                                titleText=""
                                hideLabel
                                items={['vpc', 'classic', 'directlink', 'gre']}
                                selectedItem={conn.connectionType}
                                itemToString={(item: string | null) => item ? connectionTypeLabels[item] ?? item : ''}
                                onChange={({ selectedItem }: { selectedItem: string | null }) => {
                                  if (selectedItem) updateConnection(gw.id, conn.id, { connectionType: selectedItem as 'vpc' | 'classic' | 'directlink' | 'gre' });
                                }}
                                size="sm"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                kind="danger--ghost"
                                size="sm"
                                renderIcon={TrashCan}
                                iconDescription="Delete connection"
                                hasIconOnly
                                onClick={() => removeConnection(gw.id, conn.id)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {gw.connections.length === 0 && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginTop: '0.5rem' }}>
                      No connections. Add a connection to link this gateway.
                    </p>
                  )}
                </Tile>
              ))}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Column>
    </Grid>
  );
}
