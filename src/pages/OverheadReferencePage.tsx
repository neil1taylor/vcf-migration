// OpenShift Virtualization Overhead Reference Page
import { useState } from 'react';
import {
  Grid,
  Column,
  Tile,
  Link,
  Tag,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
  CodeSnippet,
  ContentSwitcher,
  Switch,
} from '@carbon/react';
import { Information, ArrowLeft } from '@carbon/icons-react';
import { Link as RouterLink } from 'react-router-dom';
import { ROUTES } from '@/utils/constants';
import virtualizationOverhead from '@/data/virtualizationOverhead.json';
import { getOdfProfiles } from '@/utils/odfCalculation';
import type { OdfTuningProfile } from '@/utils/odfCalculation';
import './OverheadReferencePage.scss';

const odfProfiles = getOdfProfiles();

export function OverheadReferencePage() {
  const { cpuOverhead, memoryOverhead, storageOverhead, systemReserved, odfReserved, references, metadata } = virtualizationOverhead;
  const [selectedOdfProfile, setSelectedOdfProfile] = useState<OdfTuningProfile>('balanced');

  const profileData = odfReserved.profiles[selectedOdfProfile];
  const selectedProfileIndex = odfProfiles.findIndex(p => p.id === selectedOdfProfile);
  const clusterCounts = odfReserved.clusterWideCounts;

  return (
    <div className="overhead-reference-page">
      <Grid narrow>
        {/* Header */}
        <Column lg={16} md={8} sm={4}>
          <div className="overhead-reference-page__header">
            <RouterLink to={ROUTES.roksMigration} className="overhead-reference-page__back-link">
              <ArrowLeft size={16} />
              Back to ROKS Migration
            </RouterLink>
            <h1>OpenShift Virtualization Overhead Reference</h1>
            <p className="overhead-reference-page__subtitle">
              Understanding resource overhead when running VMs on OpenShift Virtualization (KubeVirt)
            </p>
            <div className="overhead-reference-page__meta">
              <Tag type="blue" size="sm">Last Updated: {metadata.lastUpdated}</Tag>
              <Tag type="gray" size="sm">Version: {metadata.version}</Tag>
            </div>
          </div>
        </Column>

        {/* Overview */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="overhead-reference-page__overview">
            <div className="overhead-reference-page__overview-icon">
              <Information size={24} />
            </div>
            <div>
              <h3>Why Overhead Matters</h3>
              <p>
                When running VMs on OpenShift Virtualization, additional resources are required beyond what the guest operating system uses.
                This overhead comes from the virtualization layer (KubeVirt/QEMU), container runtime, and Kubernetes management processes.
                The sizing calculator automatically applies these overhead values based on your VM count and sizes.
              </p>
            </div>
          </Tile>
        </Column>

        {/* CPU Overhead */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>CPU Overhead</h2>
              <Tag type="purple" size="md">{cpuOverhead.totalFixedPerVM} vCPU/VM + {cpuOverhead.proportional.emulationOverhead.percent}%</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">{cpuOverhead.description}</p>

            <h4>Fixed Overhead per VM</h4>
            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Component</StructuredListCell>
                  <StructuredListCell head>Value</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{cpuOverhead.perVM.virtLauncher.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{cpuOverhead.perVM.virtLauncher.value} {cpuOverhead.perVM.virtLauncher.unit}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{cpuOverhead.perVM.qemuBase.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{cpuOverhead.perVM.qemuBase.value} {cpuOverhead.perVM.qemuBase.unit}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{cpuOverhead.perVM.ioThreads.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{cpuOverhead.perVM.ioThreads.value} {cpuOverhead.perVM.ioThreads.unit}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{cpuOverhead.perVM.kubeletTracking.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{cpuOverhead.perVM.kubeletTracking.value} {cpuOverhead.perVM.kubeletTracking.unit}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>Total Fixed per VM</strong>
                  </StructuredListCell>
                  <StructuredListCell><strong>{cpuOverhead.totalFixedPerVM} vCPU</strong></StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>

            <h4 style={{ marginTop: '1rem' }}>Proportional Overhead</h4>
            <StructuredListWrapper>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{cpuOverhead.proportional.emulationOverhead.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{cpuOverhead.proportional.emulationOverhead.percent}% of guest vCPUs</StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>

            <div className="overhead-reference-page__formula">
              <h4>Calculation Formula</h4>
              <CodeSnippet type="single" feedback="Copied!">{cpuOverhead.formula}</CodeSnippet>
            </div>

            <div className="overhead-reference-page__notes">
              <h4>Notes</h4>
              <ul>
                {cpuOverhead.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          </Tile>
        </Column>

        {/* Memory Overhead */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>Memory Overhead</h2>
              <Tag type="teal" size="md">{memoryOverhead.totalFixedPerVM} MiB/VM + {memoryOverhead.totalProportionalPercent}%</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">{memoryOverhead.description}</p>

            <h4>Fixed Overhead per VM</h4>
            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Component</StructuredListCell>
                  <StructuredListCell head>Value</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{memoryOverhead.perVM.virtLauncherBase.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{memoryOverhead.perVM.virtLauncherBase.value} {memoryOverhead.perVM.virtLauncherBase.unit}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{memoryOverhead.perVM.libvirtDaemon.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{memoryOverhead.perVM.libvirtDaemon.value} {memoryOverhead.perVM.libvirtDaemon.unit}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{memoryOverhead.perVM.qemuFixed.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{memoryOverhead.perVM.qemuFixed.value} {memoryOverhead.perVM.qemuFixed.unit}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{memoryOverhead.perVM.kubeletOverhead.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{memoryOverhead.perVM.kubeletOverhead.value} {memoryOverhead.perVM.kubeletOverhead.unit}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>Total Fixed per VM</strong>
                  </StructuredListCell>
                  <StructuredListCell><strong>{memoryOverhead.totalFixedPerVM} MiB ({memoryOverhead.totalFixedPerVMGiB} GiB)</strong></StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>

            <h4 style={{ marginTop: '1rem' }}>Proportional Overhead</h4>
            <StructuredListWrapper>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{memoryOverhead.proportional.qemuGuestOverhead.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{memoryOverhead.proportional.qemuGuestOverhead.percent}% of guest RAM</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>{memoryOverhead.proportional.guestStructures.description}</strong>
                  </StructuredListCell>
                  <StructuredListCell>{memoryOverhead.proportional.guestStructures.percent}% of guest RAM</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell>
                    <strong>Total Proportional</strong>
                  </StructuredListCell>
                  <StructuredListCell><strong>{memoryOverhead.totalProportionalPercent}%</strong></StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>

            <div className="overhead-reference-page__formula">
              <h4>Calculation Formula</h4>
              <CodeSnippet type="single" feedback="Copied!">{memoryOverhead.formula}</CodeSnippet>
            </div>

            <div className="overhead-reference-page__notes">
              <h4>Notes</h4>
              <ul>
                {memoryOverhead.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          </Tile>
        </Column>

        {/* System Reserved */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>System Reserved</h2>
              <Tag type="warm-gray" size="md">Per Node</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">{systemReserved.description}</p>

            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Resource</StructuredListCell>
                  <StructuredListCell head>Value</StructuredListCell>
                  <StructuredListCell head>Purpose</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell><strong>CPU</strong></StructuredListCell>
                  <StructuredListCell>{systemReserved.cpu.value} {systemReserved.cpu.unit}</StructuredListCell>
                  <StructuredListCell>{systemReserved.cpu.description}</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Memory</strong></StructuredListCell>
                  <StructuredListCell>{systemReserved.memory.value} {systemReserved.memory.unit}</StructuredListCell>
                  <StructuredListCell>{systemReserved.memory.description}</StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>
          </Tile>
        </Column>

        {/* ODF Reserved — Profile-based */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>ODF Reserved</h2>
              <Tag type="red" size="md">Per Node (Profile-Based)</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">{odfReserved.description}</p>

            <ContentSwitcher
              onChange={(e) => {
                if (e.index == null) return;
                const profileId = odfProfiles[e.index]?.id;
                if (profileId) setSelectedOdfProfile(profileId);
              }}
              selectedIndex={selectedProfileIndex}
              size="sm"
            >
              {odfProfiles.map((p) => (
                <Switch key={p.id} name={p.id} text={p.label} />
              ))}
            </ContentSwitcher>

            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', marginBottom: '0.75rem', color: 'var(--cds-text-secondary)' }}>
              {profileData.description}
            </p>

            <h4>Per-Component Resources (Kubernetes CPU / GiB)</h4>
            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Component</StructuredListCell>
                  <StructuredListCell head>CPU</StructuredListCell>
                  <StructuredListCell head>Memory</StructuredListCell>
                  <StructuredListCell head>Scheduling</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                {(['mgr', 'mon', 'osd', 'mds', 'rgw'] as const).map((name) => {
                  const comp = profileData.components[name];
                  const isPerNvme = 'perNvme' in comp && comp.perNvme;
                  return (
                    <StructuredListRow key={name}>
                      <StructuredListCell><strong>{name.toUpperCase()}</strong></StructuredListCell>
                      <StructuredListCell>{comp.cpu} vCPU</StructuredListCell>
                      <StructuredListCell>{comp.memoryGiB} GiB</StructuredListCell>
                      <StructuredListCell>
                        {isPerNvme
                          ? '1 per NVMe device'
                          : `${(clusterCounts as Record<string, number>)[name]} cluster-wide`
                        }
                      </StructuredListCell>
                    </StructuredListRow>
                  );
                })}
              </StructuredListBody>
            </StructuredListWrapper>

            <div className="overhead-reference-page__formula">
              <h4>Calculation Formula</h4>
              <CodeSnippet type="multi" feedback="Copied!">
{`Per Node ODF CPU =
  MGR(${profileData.components.mgr.cpu} × ${clusterCounts.mgr}/nodes) +
  MON(${profileData.components.mon.cpu} × ${clusterCounts.mon}/nodes) +
  OSD(${profileData.components.osd.cpu} × nvmeDisks) +
  MDS(${profileData.components.mds.cpu} × ${clusterCounts.mds}/nodes)`}
              </CodeSnippet>
            </div>

            <div className="overhead-reference-page__example">
              <h4>Example: 8 NVMe, 3 Nodes ({profileData.label})</h4>
              <ul>
                <li>CPU: MGR({profileData.components.mgr.cpu}\u00d7{(clusterCounts.mgr / 3).toFixed(2)}) + MON({profileData.components.mon.cpu}\u00d7{(clusterCounts.mon / 3).toFixed(2)}) + OSD({profileData.components.osd.cpu}\u00d78) + MDS({profileData.components.mds.cpu}\u00d7{(clusterCounts.mds / 3).toFixed(2)}) = <strong>
                  {(
                    profileData.components.mgr.cpu * clusterCounts.mgr / 3 +
                    profileData.components.mon.cpu * clusterCounts.mon / 3 +
                    profileData.components.osd.cpu * 8 +
                    profileData.components.mds.cpu * clusterCounts.mds / 3
                  ).toFixed(1)} vCPU/node</strong></li>
                <li>Memory: MGR({profileData.components.mgr.memoryGiB}\u00d7{(clusterCounts.mgr / 3).toFixed(2)}) + MON({profileData.components.mon.memoryGiB}\u00d7{(clusterCounts.mon / 3).toFixed(2)}) + OSD({profileData.components.osd.memoryGiB}\u00d78) + MDS({profileData.components.mds.memoryGiB}\u00d7{(clusterCounts.mds / 3).toFixed(2)}) = <strong>
                  {(
                    profileData.components.mgr.memoryGiB * clusterCounts.mgr / 3 +
                    profileData.components.mon.memoryGiB * clusterCounts.mon / 3 +
                    profileData.components.osd.memoryGiB * 8 +
                    profileData.components.mds.memoryGiB * clusterCounts.mds / 3
                  ).toFixed(1)} GiB/node</strong></li>
              </ul>
            </div>
          </Tile>
        </Column>

        {/* Storage Overhead */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>Storage Virtualization Overhead</h2>
              <Tag type="blue" size="md">{storageOverhead.totalPercent}% (User Adjustable)</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">{storageOverhead.description}</p>

            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Component</StructuredListCell>
                  <StructuredListCell head>Purpose</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                {storageOverhead.components.map((component) => (
                  <StructuredListRow key={component.id}>
                    <StructuredListCell><strong>{component.name}</strong></StructuredListCell>
                    <StructuredListCell>{component.description}</StructuredListCell>
                  </StructuredListRow>
                ))}
              </StructuredListBody>
            </StructuredListWrapper>
          </Tile>
        </Column>

        {/* References */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <h2>External References</h2>
            <p>For more detailed information, consult these official documentation sources:</p>
            <ul className="overhead-reference-page__references">
              {references.map((ref, idx) => (
                <li key={idx}>
                  <Link href={ref.url} target="_blank" rel="noopener noreferrer">
                    {ref.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="overhead-reference-page__sources">
              <strong>Data Sources:</strong> {metadata.sources.join(', ')}
            </p>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
