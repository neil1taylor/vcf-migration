// VSI Profile Selection Guide Page
import {
  Grid,
  Column,
  Tile,
  Tag,
  InlineNotification,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
} from '@carbon/react';
import { Information, ArrowLeft } from '@carbon/icons-react';
import { Link as RouterLink } from 'react-router-dom';
import { ROUTES } from '@/utils/constants';
import './OverheadReferencePage.scss';

export function VSIProfileGuidePage() {
  return (
    <div className="overhead-reference-page">
      <Grid narrow>
        {/* Header */}
        <Column lg={16} md={8} sm={4}>
          <div className="overhead-reference-page__header">
            <RouterLink to={ROUTES.vsiMigration} className="overhead-reference-page__back-link">
              <ArrowLeft size={16} />
              Back to VSI Migration
            </RouterLink>
            <h1>VSI Profile Selection Guide</h1>
            <p className="overhead-reference-page__subtitle">
              Comprehensive guide to selecting the right IBM Cloud VPC Virtual Server Instance profiles for your workloads
            </p>
          </div>
        </Column>

        {/* Overview */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="overhead-reference-page__overview">
            <div className="overhead-reference-page__overview-icon">
              <Information size={24} />
            </div>
            <div>
              <h3>Profile Naming Convention</h3>
              <p>
                VPC VSI profiles follow the pattern: <code>&lt;family&gt;&lt;gen&gt;[variant]-&lt;vCPU&gt;x&lt;RAM&gt;</code>.
                For example, <code>bx3d-8x40</code> is a <strong>Balanced</strong> family, <strong>Gen3</strong>,
                with NVMe instance storage (<strong>d</strong> suffix), providing 8 vCPUs and 40 GiB RAM.
              </p>
            </div>
          </Tile>
        </Column>

        {/* Decision Flow SVG */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>Profile Selection Decision Flow</h2>
              <Tag type="blue" size="md">Visual Guide</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">
              Use this flowchart to determine the right profile family based on your workload characteristics.
            </p>
            <div style={{ textAlign: 'center', margin: '1rem 0' }}>
              <img
                src="/vpc_vsi_profile_selection.svg"
                alt="VPC VSI Profile Selection Flowchart"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          </Tile>
        </Column>

        {/* Profile Families */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>Profile Families</h2>
              <Tag type="purple" size="md">6 Families</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">
              Each profile family is optimized for a different vCPU-to-memory ratio and workload type.
            </p>

            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Family</StructuredListCell>
                  <StructuredListCell head>Prefix</StructuredListCell>
                  <StructuredListCell head>vCPU:RAM Ratio</StructuredListCell>
                  <StructuredListCell head>Use Cases</StructuredListCell>
                  <StructuredListCell head>Example Profiles</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell><strong>Balanced</strong></StructuredListCell>
                  <StructuredListCell>bx2, bx3d</StructuredListCell>
                  <StructuredListCell>1:4 to 1:5</StructuredListCell>
                  <StructuredListCell>General purpose: web servers, middleware, application tiers</StructuredListCell>
                  <StructuredListCell>bx3d-2x10, bx3d-8x40, bx2-16x64</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Compute</strong></StructuredListCell>
                  <StructuredListCell>cx2, cx3d</StructuredListCell>
                  <StructuredListCell>1:2 to 1:2.5</StructuredListCell>
                  <StructuredListCell>CPU-bound: batch processing, analytics, CI/CD workers, HPC</StructuredListCell>
                  <StructuredListCell>cx3d-2x5, cx3d-8x20, cx2-16x32</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Memory</strong></StructuredListCell>
                  <StructuredListCell>mx2, mx3d</StructuredListCell>
                  <StructuredListCell>1:8 to 1:10</StructuredListCell>
                  <StructuredListCell>Databases, in-memory caches, JVM-heavy apps, Redis/Memcached</StructuredListCell>
                  <StructuredListCell>mx3d-2x20, mx3d-8x80, mx2-16x128</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Very High Memory</strong></StructuredListCell>
                  <StructuredListCell>vx2d</StructuredListCell>
                  <StructuredListCell>1:14</StructuredListCell>
                  <StructuredListCell>SAP HANA, large in-memory analytics, real-time OLAP</StructuredListCell>
                  <StructuredListCell>vx2d-2x28, vx2d-16x224</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Ultra High Memory</strong></StructuredListCell>
                  <StructuredListCell>ux2d</StructuredListCell>
                  <StructuredListCell>1:28</StructuredListCell>
                  <StructuredListCell>Largest SAP configurations, extreme in-memory workloads</StructuredListCell>
                  <StructuredListCell>ux2d-2x56, ux2d-16x448</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>GPU</strong></StructuredListCell>
                  <StructuredListCell>gx2, gx3</StructuredListCell>
                  <StructuredListCell>Varies</StructuredListCell>
                  <StructuredListCell>AI/ML inference, GPU rendering, video transcoding</StructuredListCell>
                  <StructuredListCell>gx2-8x64x1v100, gx3-16x80x1l4</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Burstable</strong></StructuredListCell>
                  <StructuredListCell>bxf, cxf, mxf</StructuredListCell>
                  <StructuredListCell>Varies</StructuredListCell>
                  <StructuredListCell>Variable workloads with avg CPU &lt;20% and spikes &lt;30 min; dev/test, internal tooling, jump hosts</StructuredListCell>
                  <StructuredListCell>bxf-2x8, cxf-4x8, mxf-2x16</StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>
          </Tile>
        </Column>

        {/* Generation & Variants */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>Generation & Variants</h2>
              <Tag type="green" size="md">Gen3 Preferred</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">
              Gen3 profiles offer better price-performance and should be preferred for new deployments.
            </p>

            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Feature</StructuredListCell>
                  <StructuredListCell head>Gen3 (bx3d, cx3d, mx3d)</StructuredListCell>
                  <StructuredListCell head>Gen2 (bx2, cx2, mx2)</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell><strong>Processor</strong></StructuredListCell>
                  <StructuredListCell>4th Gen Intel Xeon (Sapphire Rapids)</StructuredListCell>
                  <StructuredListCell>2nd Gen Intel Xeon (Cascade Lake)</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Memory</strong></StructuredListCell>
                  <StructuredListCell>DDR5</StructuredListCell>
                  <StructuredListCell>DDR4</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>PCIe</strong></StructuredListCell>
                  <StructuredListCell>Gen5</StructuredListCell>
                  <StructuredListCell>Gen4</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>NVMe Instance Storage</strong></StructuredListCell>
                  <StructuredListCell>Included (d-suffix)</StructuredListCell>
                  <StructuredListCell>Optional (d-suffix variants)</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Boot Mode</strong></StructuredListCell>
                  <StructuredListCell>UEFI only (required)</StructuredListCell>
                  <StructuredListCell>BIOS or UEFI</StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>

            <div className="overhead-reference-page__notes">
              <h4>Variant Suffixes</h4>
              <ul>
                <li><strong>d</strong> — NVMe instance storage included (ephemeral on stop/start)</li>
                <li><strong>dc</strong> — NVMe instance storage with crypto acceleration (Intel QAT)</li>
                <li><strong>f</strong> — Flex/burstable profile with shared CPU</li>
              </ul>
            </div>

            <InlineNotification
              kind="warning"
              title="UEFI boot conversion"
              subtitle="VMs running BIOS firmware in VMware must be converted to UEFI boot mode before they can run on Gen 3 profiles. The app automatically assigns BIOS VMs to Gen 2 profiles. To use Gen 3, convert the VM firmware to UEFI in vCenter before migration."
              hideCloseButton
              lowContrast
              style={{ maxWidth: '100%', marginTop: '1rem' }}
            />
          </Tile>
        </Column>

        {/* NVMe Instance Storage */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>NVMe Instance Storage</h2>
              <Tag type="teal" size="md">High IOPS</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">
              Profiles with the d-suffix include local NVMe storage directly attached to the host.
              This provides very high IOPS and low latency, but the data is <strong>ephemeral</strong> — it is lost when the instance is stopped or restarted.
            </p>

            <h4>When to Use d-Profiles</h4>
            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Use Case</StructuredListCell>
                  <StructuredListCell head>Why NVMe Helps</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell><strong>Database scratch/temp</strong></StructuredListCell>
                  <StructuredListCell>Temp tables, sort spills, and intermediate query results benefit from ultra-low latency</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>WAL / Redo logs</strong></StructuredListCell>
                  <StructuredListCell>Write-ahead logs need sequential write throughput — NVMe delivers consistent IOPS</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Kafka partitions</strong></StructuredListCell>
                  <StructuredListCell>Kafka brokers with local NVMe avoid network storage bottlenecks for log segments</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>Build artifacts / caches</strong></StructuredListCell>
                  <StructuredListCell>CI/CD build output and package caches that can be regenerated</StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>

            <div className="overhead-reference-page__notes">
              <h4>Important</h4>
              <ul>
                <li>NVMe instance storage is <strong>not backed up</strong> and <strong>not replicated</strong></li>
                <li>Data is lost on instance stop, restart, or hardware failure</li>
                <li>Use block storage volumes for persistent data</li>
                <li>NVMe capacity scales with the profile size</li>
              </ul>
            </div>
          </Tile>
        </Column>

        {/* When to Use Burstable Profiles */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>Assessing Your Workload</h2>
              <Tag type="cyan" size="md">Burstable Guidance</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">
              RVTools does not include CPU utilization history. To assess burstable suitability, pull metrics from vCenter performance charts or your monitoring tools (e.g., vROps, Datadog, Prometheus).
            </p>

            <h4>What to Check</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              <li>Average CPU utilization over a representative week (&lt;20% suggests burstable)</li>
              <li>Peak duration — individual spikes should last &lt;30 minutes</li>
              <li>Spike frequency and time-of-day patterns</li>
              <li>Whether the workload is in the path of end-user transactions</li>
            </ul>

            <h4>Good Fit for Burstable</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              <li>Dev/test environments</li>
              <li>Internal tooling and admin portals</li>
              <li>Monitoring agents and jump hosts</li>
              <li>Lightweight web servers with low traffic</li>
              <li>Short scheduled batch jobs</li>
            </ul>

            <h4>Not Suitable for Burstable</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              <li>Production databases</li>
              <li>Stream processors (Kafka, Flink)</li>
              <li>Video encoding / transcoding</li>
              <li>User-facing latency-sensitive services</li>
            </ul>
          </Tile>
        </Column>

        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>How This App Classifies</h2>
              <Tag type="cyan" size="md">Heuristic-Based</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">
              Without CPU utilization data in RVTools, the app uses heuristic signals to classify VMs as burstable or standard.
            </p>

            <h4>What Triggers &quot;Standard&quot;</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              <li><strong>Network appliance names</strong> — VMs matching patterns like firewall, proxy, load balancer, VPN, WAF</li>
              <li><strong>Enterprise app names</strong> — SAP, Oracle, SQL Server, Exchange, SharePoint, and similar</li>
              <li><strong>High NIC count</strong> — VMs with more than 2 network adapters</li>
            </ul>

            <h4>Default Classification</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)', marginBottom: '1rem' }}>
              All other VMs default to <strong>Burstable</strong>. This is a conservative starting point that optimizes for cost — most VMware VMs are significantly over-provisioned for their actual utilization.
            </p>

            <div className="overhead-reference-page__notes">
              <h4>Key Limitation</h4>
              <ul>
                <li>Without utilization data, the classification is a best-effort heuristic</li>
                <li>Validate recommendations against your monitoring data</li>
                <li>Override individual VMs in the VSI sizing table if needed</li>
              </ul>
            </div>
          </Tile>
        </Column>

        {/* Burstable Rule of Thumb */}
        <Column lg={16} md={8} sm={4}>
          <InlineNotification
            kind="info"
            title="Practical rule of thumb"
            subtitle="If average CPU over a representative week is below 20%, individual spikes last less than 30 minutes, and the workload is not in the path of end-user transactions where latency degradation would be noticed — burstable is likely appropriate. If any of those is a no, use a standard (fixed) profile."
            hideCloseButton
            lowContrast
            style={{ maxWidth: '100%', marginBottom: '1rem' }}
          />
        </Column>

        {/* Network Bandwidth */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>Network Bandwidth</h2>
              <Tag type="blue" size="md">Scales with vCPU</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">
              Network bandwidth is allocated proportionally to vCPU count. Larger profiles receive more network capacity.
            </p>

            <StructuredListWrapper>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Profile Size</StructuredListCell>
                  <StructuredListCell head>Typical Bandwidth</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                <StructuredListRow>
                  <StructuredListCell><strong>2 vCPU</strong></StructuredListCell>
                  <StructuredListCell>4 Gbps</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>4-8 vCPU</strong></StructuredListCell>
                  <StructuredListCell>8-16 Gbps</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>16-32 vCPU</strong></StructuredListCell>
                  <StructuredListCell>32-64 Gbps</StructuredListCell>
                </StructuredListRow>
                <StructuredListRow>
                  <StructuredListCell><strong>64+ vCPU</strong></StructuredListCell>
                  <StructuredListCell>80-200 Gbps</StructuredListCell>
                </StructuredListRow>
              </StructuredListBody>
            </StructuredListWrapper>

            <div className="overhead-reference-page__notes">
              <h4>Guidance</h4>
              <ul>
                <li>If your workload is network-throughput-bound, consider sizing up to the next vCPU tier</li>
                <li>Network bandwidth is shared across all interfaces on the instance</li>
                <li>Check the profile's <code>bandwidthGbps</code> value for exact allocation</li>
              </ul>
            </div>
          </Tile>
        </Column>

        {/* Sizing Heuristics */}
        <Column lg={8} md={8} sm={4}>
          <Tile className="overhead-reference-page__section">
            <div className="overhead-reference-page__section-header">
              <h2>Sizing Heuristics</h2>
              <Tag type="warm-gray" size="md">Best Practices</Tag>
            </div>
            <p className="overhead-reference-page__section-desc">
              Practical guidance for right-sizing VMs to VSI profiles during migration.
            </p>

            <h4>vCPU Sizing</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              <li>Start with peak concurrency + 20% headroom</li>
              <li>Consider actual CPU utilization from monitoring data if available</li>
              <li>Many VMware VMs are over-provisioned — right-sizing can reduce costs</li>
              <li>Burstable profiles are suitable when average utilization is below 20%</li>
            </ul>

            <h4>Memory Sizing</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              <li>Working set + OS overhead + 20% buffer</li>
              <li>JVM apps: heap size + metaspace + native memory + OS</li>
              <li>Databases: buffer pool + connections + sort buffers + OS</li>
              <li>Memory cannot be overcommitted on VPC VSIs — size accurately</li>
            </ul>

            <h4>Storage Sizing</h4>
            <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
              <li>Boot volume: 100 GiB (Linux) or 120 GiB (Windows), max 250 GiB</li>
              <li>Data volumes: match provisioned sizes from VMware</li>
              <li>Choose IOPS tier based on workload: 3 IOPS/GB (general), 5 IOPS/GB (high), 10 IOPS/GB (database)</li>
            </ul>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
}
