# RVTools Storage Sizing for ODF-Backed OpenShift Clusters

RVTools exposes a lot of storage numbers, and if you pick the wrong one you can easily oversize or undersize an ODF-backed OpenShift cluster.

I'll break this down in a practical way, specifically for designing a new ROKS / OpenShift virtual environment on vSphere using ODF (OpenShift Data Foundation).

---

## The short answer (what to actually use)

For capacity sizing, the most useful RVTools metric is:

👉 **VM → Used MB** (a.k.a. VMDK used space)

That's your real data footprint and the best starting point for ODF sizing.

Everything else is either inflated, misleading, or only relevant for datastore-level planning.

---

## Why "Used MB" is the right baseline

ODF is a software-defined, consumption-based storage layer:
- It stores actual written data, not thin-provisioned promises
- It applies replication / erasure coding overhead
- It adds metadata and operational overhead
- It grows as workloads grow

So you want to size based on what data is actually written, not what could be written.

---

## RVTools fields that matter

From the vInfo tab:

| RVTools Field | Use It? | Why |
|---------------|---------|-----|
| **Used MB** | ✅ YES | Actual data written inside VMDKs |
| **Provisioned MB** | ❌ No | Thin disks inflate this massively |
| **In Use MB** | ⚠️ Maybe | See note below |
| **Datastore Consumed** | ❌ No | Includes snapshots, swap, temp files |

Think of **Used MB** as:

> "If I copied this VM's disk data somewhere else, how much storage would it really need?"

That's exactly how ODF behaves.

### A note on "In Use MB"

"In Use MB" can work in specific scenarios, but requires validation:

| Scenario | Use "In Use MB"? |
|----------|------------------|
| **ESXi 6.x/7.x with memory overcommit** | ❌ Includes balloon/swap |
| **ESXi 8.x with modern VMs** | ✅ Often same as "Used MB" |
| **Thin-provisioned disks, no snapshots** | ✅ Can be useful |
| **Environment with heavy snapshots** | ❌ Will be inflated |

**Recommendation**: Compare "In Use MB" to "Used MB" for a sample of VMs. If they're within 5-10%, you can use either. Otherwise, stick with "Used MB".

---

## What NOT to size ODF from (common mistakes)

### ❌ Provisioned MB

This is the biggest trap.
- Thin disks report full allocated size
- Kubernetes/OpenShift won't pre-allocate like this
- You'll oversize ODF by 2–5x in many environments

**Example**: A 500GB thin disk with only 50GB written shows as 500GB Provisioned but 50GB Used.

### ❌ Datastore-level usage

This includes:
- VM swap files
- Snapshots
- ISO remnants
- VMFS overhead

ODF won't see most of that.

---

## Translating RVTools → ODF capacity

Here's a simple, realistic sizing flow:

### 1️⃣ Sum Used MB for relevant workloads

**Only include:**
- Workloads you plan to migrate or re-platform
- Persistent data candidates (databases, registries, logs, etc.)
- VMs moving to OpenShift Virtualization

**Exclude:**
- Stateless VMs
- OS-only VMs
- Things moving to cloud-native services
- VMs being decommissioned

Convert to TB.

---

### 2️⃣ Apply ODF data protection overhead

This depends on how you plan to deploy ODF:

#### Replication (most common, simpler ops)

| Replica Count | Raw Capacity Multiplier | Notes |
|---------------|------------------------|-------|
| 2x | ~2.2x | Not recommended for production |
| 3x | ~3.2x | **Default for ROKS** |

*(Extra ~10% for Ceph metadata + internal PG overhead)*

**Multi-zone consideration**: For IBM Cloud ROKS clusters:
- **3-zone clusters**: Each replica lands in a different availability zone (excellent DR)
- **Single-zone clusters**: Replicas are node-level only (less resilient)
- For single-zone clusters, evaluate whether 3x replication is necessary or if 2x + external backups is sufficient

#### Erasure Coding (advanced, more efficient)

| EC Profile | Multiplier | Minimum Nodes Required |
|------------|------------|------------------------|
| 4+2 | ~1.5x | 6+ nodes |
| 8+3 | ~1.4x | 11+ nodes |

**When to use Erasure Coding:**
- Large, write-once/read-many workloads (archives, backups)
- Cold storage tiers
- S3-compatible object storage buckets
- Clusters with 10+ nodes

**Tradeoffs:**
- ⚠️ Higher write amplification than replication
- ⚠️ Slower recovery during node failures
- ⚠️ More complex operational overhead
- ✅ Better capacity efficiency for large deployments

**For most ROKS / OpenShift Virtualization deployments, stick with 3x replication.**

---

### 3️⃣ Add growth + operational headroom

ODF really doesn't like running "full".

**Recommended:**
- **30–40% free space minimum** (Ceph performance degrades above 75-80% utilization)
- Plus data growth over 12–36 months

#### Breaking down the calculation:

```
Step 1: Base capacity = Used MB × Protection Factor
Step 2: Add free space = Base × 1.3 (for 30% headroom)
Step 3: Add growth = Result × Annual Growth Factor

Example:
- Used MB: 10 TB
- 3x replication: 10 × 3.2 = 32 TB
- 30% free space: 32 × 1.3 = 41.6 TB
- 20% annual growth over 2 years: 41.6 × 1.44 = 59.9 TB
→ Round up to 60 TB raw ODF capacity
```

#### Quick formula for typical scenarios:

**Conservative (40% free + 20% annual growth over 2 years):**
```
Final ODF Raw = Used MB × Protection Factor × 1.7
```

**Standard (30% free + 15% annual growth over 2 years):**
```
Final ODF Raw = Used MB × Protection Factor × 1.5
```

**Aggressive (30% free + 10% annual growth over 2 years):**
```
Final ODF Raw = Used MB × Protection Factor × 1.4
```

---

## Performance matters too (don't skip this)

Capacity is only half the story. ODF performance is bounded by IOPS per disk, not total capacity.

### What to look at beyond RVTools

RVTools shows disk layout (controller types, disk counts, sizes), but **does NOT capture real-time IOPS or latency**.

**To get performance baselines:**
1. Use **vCenter Performance Charts** for IOPS/latency data
2. Use **vRealize Operations** for long-term trends
3. Use RVTools for disk count/size mapping
4. Cross-reference with ODF IOPS calculators

### Key workload patterns to identify:

| Workload Type | Indicator | ODF Impact |
|---------------|-----------|------------|
| **Heavy random write** | Databases, logging | Needs more OSDs (disks) |
| **Large sequential** | Backup, archive | Can use fewer, larger disks |
| **Mixed OLTP** | ERP, CRM systems | Balance disk count + NVMe |
| **Read-heavy** | Web content, analytics | Can tolerate slower media |

### Why this matters:

- ODF performance scales with **number of OSDs (disks)**, not capacity
- More capacity ≠ more performance unless you add disks/nodes
- StorageClass choice (RBD vs CephFS) affects layout
- NVMe is **strongly recommended** for production workloads

**If your "Used MB" is small but IO is heavy**, you still need:
- More ODF nodes
- More disks per node
- Faster media (NVMe over SSD over HDD)

---

## ODF Architecture & Node Layout

ODF performance is determined by your cluster architecture, not just raw capacity.

### Minimum Viable ODF Configuration (ROKS)

| Cluster Type | Min Nodes | Disks/Node | Storage | Why |
|--------------|-----------|------------|---------|-----|
| **Single-zone (dev/test)** | 3 | 1-2 | NVMe/SSD | Bare minimum for ODF |
| **Multi-zone (3 AZ)** | 3 (1 per zone) | 2+ | NVMe | Zone-level failure tolerance |
| **Production** | 6+ (2 per zone) | 2-4 | NVMe | Balanced capacity + performance |

### OSD Count Math

```
Total OSDs = Nodes × Disks per Node
Aggregate IOPS ≈ OSDs × Per-Disk IOPS
Usable IOPS = Aggregate IOPS ÷ Replication Factor

Example:
- 6 nodes × 2 NVMe disks = 12 OSDs
- 12 OSDs × 50,000 IOPS/disk = 600,000 aggregate IOPS
- With 3x replication write penalty = ~200,000 usable write IOPS
```

### Per-Disk IOPS Expectations

| Media Type | Typical IOPS/Disk | Use Case |
|------------|-------------------|----------|
| **NVMe** | 50,000 - 100,000+ | Production, databases, OLTP |
| **SSD** | 10,000 - 20,000 | General purpose, mixed workloads |
| **HDD** | 100 - 200 | Cold storage only (not recommended) |

### IBM Cloud ROKS Node Sizing Examples

| Worker Flavor | vCPU | RAM | Local Storage Option | ODF Suitability |
|---------------|------|-----|---------------------|-----------------|
| **bx2.16x64** | 16 | 64GB | None (use Block Storage) | Good for moderate workloads |
| **bx2.32x128** | 32 | 128GB | None (use Block Storage) | Better for intensive workloads |
| **cx2d.metal** | 48 | 192GB | 2×960GB NVMe | Best performance (local NVMe) |

**Recommendation**: For production ODF on IBM Cloud ROKS:
- Use **bare metal workers with local NVMe** for best performance
- Use **IBM Cloud Block Storage** (NVMe-backed) for standard deployments
- Avoid network-attached storage for latency-sensitive workloads

---

## Mapping this to OpenShift usage

Typical ODF consumers in OpenShift:

### Core Platform Components
- **Persistent Volumes (RBD)** - VM disks, application data
- **Container image registry** - Grows with image churn
- **Logging (Loki / Elasticsearch)** - High write rate
- **Monitoring (Prometheus TSDB)** - Time-series data
- **Databases (Postgres, MongoDB, etc.)** - IOPS-intensive

### OpenShift Virtualization Specifics

For OpenShift Virtualization workloads, add **10-15% extra capacity** for:
- **VM snapshots** - Quick snapshots for backups/clones
- **Clone operations** - Temporary space during VM cloning
- **Live migration scratch space** - Buffer for in-flight migrations
- **KubeVirt PVC metadata** - CDI import/upload operations

**These grow very differently than traditional VMs** — so RVTools is a baseline, not a ceiling.

---

## Worked Example: Real-World Sizing

### Scenario
You have an existing VMware environment with:
- **50 VMs** to migrate to OpenShift Virtualization
- **15 TB** total "Used MB" (actual data)
- **Moderate IOPS workloads** (mixed databases, app servers, file shares)
- **IBM Cloud ROKS** 3-zone cluster
- **20% annual data growth** expected
- **2-year planning horizon**

### Calculation

**Step 1: Base capacity**
```
15 TB × 3.2 (3x replication) = 48 TB
```

**Step 2: Add operational headroom (30%)**
```
48 TB × 1.3 = 62.4 TB
```

**Step 3: Add growth (20% annual × 2 years = 44%)**
```
62.4 TB × 1.44 = 89.9 TB
```

**Step 4: Add OpenShift Virtualization overhead (15%)**
```
89.9 TB × 1.15 = 103.4 TB raw ODF capacity needed
```

### Cluster Design

**Option A: Bare Metal with Local NVMe (best performance)**
- **6 nodes** (2 per zone)
- **2×2TB NVMe per node** = 24 TB raw per node
- **Total raw capacity**: 144 TB (meets 103.4 TB requirement with headroom)
- **Total OSDs**: 12
- **Estimated IOPS**: ~600K aggregate, ~200K usable (3x replication)

**Option B: Standard Workers with Block Storage (cost-effective)**
- **6 nodes** (2 per zone) - bx2.32x128
- **3×2TB IBM Cloud Block Storage (NVMe-backed) per node**
- **Total raw capacity**: 36×2 = 108 TB (tight but workable)
- **Total OSDs**: 18
- **Estimated IOPS**: ~360K aggregate, ~120K usable

**Recommendation**: Option A for production, Option B for cost-sensitive deployments.

---

## Common Mistakes Checklist

Before finalizing your ODF sizing, verify:

- [ ] ✅ Used **"Used MB"**, not "Provisioned MB"
- [ ] ✅ Applied correct replication factor (typically 3.2x for 3-replica)
- [ ] ✅ Added 30-40% free space headroom
- [ ] ✅ Accounted for data growth over planning horizon
- [ ] ✅ Validated node count supports IOPS requirements (not just capacity)
- [ ] ✅ Confirmed NVMe or high-performance storage for production
- [ ] ✅ Added 10-15% extra for OpenShift Virtualization overhead
- [ ] ✅ Included storage for OpenShift platform components (registry, logging, monitoring)
- [ ] ✅ Verified multi-zone placement for production clusters
- [ ] ✅ Cross-checked against vCenter performance data for IOPS baselines

---

## Quick Reference: Sizing Formulas

### Conservative Sizing (Recommended for Production)
```
Raw ODF Capacity = Used MB × 3.2 × 1.7

Where 1.7 = 40% free space + 20% annual growth over 2 years
```

### Standard Sizing (Balanced)
```
Raw ODF Capacity = Used MB × 3.2 × 1.5

Where 1.5 = 30% free space + 15% annual growth over 2 years
```

### Aggressive Sizing (Cost-Optimized)
```
Raw ODF Capacity = Used MB × 3.2 × 1.4

Where 1.4 = 30% free space + 10% annual growth over 2 years
```

**Add 10-15% for OpenShift Virtualization deployments.**

---

## Next Steps

To apply this guidance:

1. **Export RVTools data** from your VMware environment
2. **Filter VMs** for migration candidates
3. **Sum "Used MB"** for selected workloads
4. **Apply sizing formula** based on your risk tolerance
5. **Design ODF cluster** with appropriate node/disk layout
6. **Validate IOPS requirements** against performance baselines
7. **Plan for growth** over your deployment horizon

### Tools & Resources

- **RVTools**: https://www.robware.net/rvtools/
- **ODF Sizing Calculator**: (Create custom spreadsheet based on formulas above)
- **IBM Cloud ROKS Documentation**: https://cloud.ibm.com/docs/openshift
- **Red Hat ODF Documentation**: https://access.redhat.com/documentation/en-us/red_hat_openshift_data_foundation/

---

## TL;DR

If you remember nothing else:

✅ **Use RVTools "Used MB"**  
❌ **Ignore "Provisioned MB" / "Datastore Consumed"**  
📐 **Multiply by:**
- **~3.2x** for 3-replica ODF
- **+30–40%** free space
- **+15-20%** annual growth
- **+10-15%** for OpenShift Virtualization

🎯 **Validate performance separately from capacity** — IOPS scale with disk count, not total TB.
