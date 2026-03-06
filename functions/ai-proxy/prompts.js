/**
 * Prompt templates for each AI use case
 *
 * Each function returns a formatted prompt string for watsonx.ai
 */

/**
 * Build a workload classification prompt for a batch of VMs
 *
 * @param {Array<Object>} vms - VM summaries
 * @param {Array<string>} categories - Available workload categories
 * @returns {string} Formatted prompt
 */
function buildClassificationPrompt(vms, categories) {
  const categoryList = categories.join(', ');

  const vmDescriptions = vms.map((vm, i) =>
    `${i + 1}. Name: "${vm.vmName}", OS: "${vm.guestOS || 'unknown'}", Annotation: "${vm.annotation || 'none'}", vCPUs: ${vm.vCPUs}, Memory MB: ${vm.memoryMB}, Disks: ${vm.diskCount}, NICs: ${vm.nicCount}`
  ).join('\n');

  return `You are a VMware workload classification expert. Classify each VM into EXACTLY one of these workload categories: ${categoryList}.

IMPORTANT: Your classification must be consistent with your reasoning. If your reasoning identifies a VM as an enterprise application, classify it as "Enterprise Applications", not as a different category.

Category definitions:
- "Databases": VMs running database engines (Oracle, SQL Server, PostgreSQL, MySQL, MongoDB, Redis, etc.)
- "Middleware / Application Servers": Web servers, app servers, reverse proxies (Tomcat, WebSphere, JBoss, Nginx, Apache, IIS, HAProxy)
- "Enterprise Applications": Business applications like SAP, SharePoint, Exchange, Dynamics, PeopleSoft, Cognos, Splunk, or general-purpose application VMs with significant resource allocation
- "Backup & Recovery": Backup software (Veeam, Veritas, Commvault, Rubrik, Cohesity, Zerto)
- "Security & Compliance": Security tools only - firewalls, antivirus, vulnerability scanners, SIEM (Palo Alto, CrowdStrike, Qualys, CyberArk, Tenable, Nessus)
- "Monitoring & Management": Monitoring and observability tools (Nagios, Zabbix, Prometheus, Grafana, Datadog, SolarWinds)
- "VMware Infrastructure": VMware management VMs (vCenter, NSX, vRealize, HCX, Horizon, VDI)
- "Container Platforms": Kubernetes, OpenShift, Docker, Rancher, Tanzu
- "Messaging & Integration": Message queues and integration middleware (Kafka, RabbitMQ, MQ, TIBCO, MuleSoft)
- "Storage Systems": Storage appliances and NAS/SAN VMs (NetApp, Pure, EMC, Ceph, MinIO)
- "Network Equipment": Network appliances, load balancers, DNS, DHCP, virtual edge routers (F5, Cisco, Infoblox, cust-edge, service-edge)
- "Cloud Services": Cloud management and automation tools (Terraform, Ansible, Puppet, Chef)
- "DevOps & CI/CD": CI/CD and development tools (Jenkins, GitLab, Artifactory, SonarQube, Jira)
- "Identity & Access": Directory services and identity management (Active Directory, LDAP, Okta, Keycloak)
- "Other": VMs that don't clearly fit any other category

Common name patterns:
- Database VMs often have "db", "sql", "oracle", "postgres", "mongo" in names and have high memory
- Web servers often have "web", "www", "apache", "nginx", "iis" in names
- Application servers may have "app", "api", "svc", "service" in names
- Infrastructure VMs include "dns", "dhcp", "ad", "dc", "ldap", "ntp"
- Development VMs may have "dev", "test", "qa", "staging" in names
- VMs with generic names and high resource allocation are typically "Enterprise Applications", not security tools

VMs to classify:
${vmDescriptions}

Respond with a JSON array. Each element must have:
- "vmName": exact VM name from input
- "workloadType": one of the categories listed above
- "confidence": number 0.0-1.0 indicating classification certainty
- "reasoning": brief explanation (1 sentence)
- "alternatives": array of up to 2 alternative classifications with workloadType and confidence

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a right-sizing recommendation prompt
 *
 * @param {Array<Object>} vms - VM specs with workload types
 * @param {Array<Object>} profiles - Available IBM Cloud profiles
 * @returns {string} Formatted prompt
 */
function buildRightsizingPrompt(vms, profiles) {
  const profileList = profiles.map(p =>
    `  - ${p.name}: ${p.vcpus} vCPUs, ${p.memoryGiB} GiB RAM, family: ${p.family}`
  ).join('\n');

  const vmDescriptions = vms.map((vm, i) =>
    `${i + 1}. Name: "${vm.vmName}", vCPUs: ${vm.vCPUs}, Memory MB: ${vm.memoryMB}, Storage MB: ${vm.storageMB}, Workload: "${vm.workloadType || 'unknown'}", OS: "${vm.guestOS || 'unknown'}"${vm.avgCpuUsage !== undefined ? `, Avg CPU: ${vm.avgCpuUsage}%` : ''}${vm.avgMemUsage !== undefined ? `, Avg Mem: ${vm.avgMemUsage}%` : ''}`
  ).join('\n');

  return `You are an IBM Cloud migration specialist. For each VM, recommend the optimal IBM Cloud VPC VSI profile.

Consider:
- Workload type affects optimal profile family (databases need memory-optimized mx2, compute workloads need cx2, general use needs balanced bx2)
- VMs with low CPU/memory usage may be over-provisioned and can use smaller profiles
- Always recommend a profile that meets or exceeds the VM's resource requirements
- Prefer the smallest profile that satisfies requirements for cost optimization

Available IBM Cloud VSI profiles:
${profileList}

VMs to evaluate:
${vmDescriptions}

Respond with a JSON array. Each element must have:
- "vmName": exact VM name from input
- "recommendedProfile": profile name from the available list
- "reasoning": brief explanation of why this profile fits
- "costSavingsEstimate": if the VM appears over-provisioned, describe potential savings
- "alternativeProfile": second-best profile option (or null)
- "alternativeReasoning": why the alternative could work (or null)
- "isOverprovisioned": boolean indicating if the VM appears to have more resources than needed

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a migration insights prompt
 *
 * @param {Object} data - Aggregated migration data
 * @returns {string} Formatted prompt
 */
function buildInsightsPrompt(data) {
  const workloadList = Object.entries(data.workloadBreakdown)
    .map(([type, count]) => `  - ${type}: ${count} VMs`)
    .join('\n');

  const complexity = data.complexitySummary;
  const blockers = data.blockerSummary.length > 0
    ? data.blockerSummary.map(b => `  - ${b}`).join('\n')
    : '  None identified';

  let costInfo = '';
  if (data.costEstimate) {
    costInfo = `\nEstimated costs:
  Monthly: $${data.costEstimate.monthly.toLocaleString()}
  Annual: $${data.costEstimate.annual.toLocaleString()}
  Region: ${data.costEstimate.region}`;
  }

  let networkInfo = '';
  if (data.networkSummary && data.networkSummary.length > 0) {
    const netLines = data.networkSummary
      .sort((a, b) => b.vmCount - a.vmCount)
      .map(n => `  - Port group "${n.portGroup}": ${n.vmCount} VMs, subnet ${n.subnet}`)
      .join('\n');
    networkInfo = `\nNetwork topology (${data.networkSummary.length} port groups):
${netLines}`;
  }

  return `You are a cloud migration strategist specializing in VMware to IBM Cloud migrations. Analyze the following environment and provide actionable insights.

Environment summary:
  Total VMs: ${data.totalVMs} (${data.totalExcluded} excluded from migration)
  Total vCPUs: ${data.totalVCPUs}
  Total Memory: ${Math.round(data.totalMemoryGiB)} GiB
  Total Storage: ${Number(data.totalStorageTiB).toFixed(2)} TiB
  Clusters: ${data.clusterCount}
  Hosts: ${data.hostCount}
  Datastores: ${data.datastoreCount}
  Migration target: ${data.migrationTarget || 'not specified'}

Workload breakdown:
${workloadList}

Complexity assessment:
  Simple: ${complexity.simple} VMs
  Moderate: ${complexity.moderate} VMs
  Complex: ${complexity.complex} VMs
  Blockers: ${complexity.blocker} VMs

Migration blockers:
${blockers}
${networkInfo}
${costInfo}

Migration wave planning context:
- VMs sharing the same subnet/port group often need to migrate together to retain IP addresses and avoid network disruptions.
- A subnet-based migration strategy groups VMs by network segment so that each wave migrates an entire subnet, preserving IP connectivity within the group.
- Smaller subnets (fewer VMs) are lower risk and should migrate first. Larger subnets with critical workloads should migrate later.

Provide a JSON response with:
- "executiveSummary": 2-3 sentence high-level summary for stakeholders. MUST include the total vCPU count, total memory (GiB), and total storage (TiB) alongside the VM count.
- "riskAssessment": Assessment of migration risks including network complexity (2-3 sentences)
- "recommendations": array of 3-5 specific, actionable recommendations (include subnet/network-aware migration advice when network data is available)
- "costOptimizations": array of 2-3 cost optimization suggestions
- "migrationStrategy": Recommended migration approach describing a subnet-based wave strategy when network data is available, explaining how to group VMs by port group/subnet to retain IP addresses and minimize network disruption (3-4 sentences)

Focus on practical advice specific to this environment. Reference specific numbers from the data including resource totals (vCPUs, memory, storage) and network/subnet details when available.

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a system prompt for the chat endpoint
 *
 * @param {Object} context - Current app context (aggregated data)
 * @returns {string} System prompt
 */
function buildChatSystemPrompt(context) {
  let envInfo = '';
  if (context && context.summary) {
    const s = context.summary;
    envInfo = `
The user has loaded an RVTools export with the following environment:
- ${s.totalVMs} total VMs (${s.totalExcluded} excluded from migration scope)
- ${s.totalVCPUs} total vCPUs
- ${Math.round(s.totalMemoryGiB)} GiB total memory
- ${Number(s.totalStorageTiB).toFixed(2)} TiB total storage
- ${s.clusterCount} clusters, ${s.hostCount} hosts, ${s.datastoreCount} datastores`;

    if (context.workloadBreakdown && Object.keys(context.workloadBreakdown).length > 0) {
      envInfo += '\nWorkload breakdown: ' + Object.entries(context.workloadBreakdown)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
    }

    if (context.complexitySummary) {
      const c = context.complexitySummary;
      envInfo += `\nComplexity: ${c.simple} simple, ${c.moderate} moderate, ${c.complex} complex, ${c.blocker} blockers`;
    }

    if (context.blockerSummary && context.blockerSummary.length > 0) {
      envInfo += '\nKey blockers: ' + context.blockerSummary.join('; ');
    }

    if (context.costEstimate) {
      envInfo += `\nEstimated monthly cost: $${context.costEstimate.monthly.toLocaleString()} (${context.costEstimate.region})`;
    }

    // Enriched context slices
    if (context.networkTopology && context.networkTopology.length > 0) {
      envInfo += '\nNetwork topology (top port groups): ' + context.networkTopology.join(', ');
    }

    if (context.osDistribution && context.osDistribution.length > 0) {
      envInfo += '\nOS distribution: ' + context.osDistribution.join(', ');
    }

    if (context.topResourceConsumers && context.topResourceConsumers.length > 0) {
      envInfo += '\nTop resource consumers (specs only): ' + context.topResourceConsumers.join('; ');
    }

    if (context.snapshotSummary) {
      envInfo += '\nSnapshots: ' + context.snapshotSummary;
    }

    if (context.datastoreSummary) {
      envInfo += '\nDatastores: ' + context.datastoreSummary;
    }

    if (context.riskSummary) {
      envInfo += '\nRisk: ' + context.riskSummary;
    }

    envInfo += `\nUser is currently on the "${context.currentPage}" page.`;
  }

  return `You are a migration planning assistant for VMware Cloud Foundation (VCF) to IBM Cloud migrations. You help users understand their VMware environment and plan migrations to IBM Cloud.

Your expertise includes:
- IBM Cloud Red Hat OpenShift on IBM Cloud (ROKS) with OpenShift Virtualization
- IBM Cloud VPC Virtual Server Instances (VSI)
- VMware workload assessment and complexity analysis
- Migration planning including wave planning and risk assessment
- IBM Cloud VPC networking, storage, and pricing
- OpenShift Virtualization (KubeVirt) for running VM workloads on Kubernetes

Key concepts:
- ROKS migration uses bare metal worker nodes with OpenShift Virtualization to run VMs as pods
- VSI migration maps each VMware VM to an IBM Cloud VPC Virtual Server Instance
- Migration complexity considers OS compatibility, hardware version, snapshots, shared disks, and other factors
- Wave planning groups VMs into migration waves based on dependencies and risk

When answering:
- Reference specific data from the user's environment when available
- Provide practical, actionable guidance
- Be concise but thorough
- If the user asks about something outside your expertise, say so
- Use markdown formatting for clarity (lists, bold, code blocks)
${envInfo}`;
}

/**
 * Build a wave planning suggestions prompt
 *
 * @param {Object} data - Wave planning data
 * @returns {string} Formatted prompt
 */
function buildWaveSuggestionsPrompt(data) {
  const waveDescriptions = data.waves.map((w, i) =>
    `${i + 1}. "${w.name}": ${w.vmCount} VMs, ${w.totalVCPUs} vCPUs, ${Math.round(w.totalMemoryGiB)} GiB RAM, ${Math.round(w.totalStorageGiB)} GiB storage, avg complexity: ${w.avgComplexity.toFixed(1)}, blockers: ${w.hasBlockers ? 'yes' : 'no'}, workloads: ${w.workloadTypes.join(', ') || 'mixed'}`
  ).join('\n');

  return `You are a cloud migration wave planning expert specializing in VMware to IBM Cloud migrations. Analyze the following migration wave plan and provide optimization suggestions.

Migration target: ${data.migrationTarget || 'not specified'}
Total VMs: ${data.totalVMs}

Current wave plan:
${waveDescriptions}

Analyze the wave plan for:
1. Balance - Are waves roughly balanced in size and complexity?
2. Risk - Which waves have the highest risk and why?
3. Dependencies - Are there potential dependency issues between waves?
4. Ordering - Is the wave order optimal (simple/low-risk first)?

Provide a JSON response with:
- "suggestions": array of 3-5 specific, actionable suggestions for improving the wave plan
- "riskNarratives": array of objects with "waveName" and "narrative" (1-2 sentence risk assessment per wave)
- "dependencyWarnings": array of potential dependency issues between waves (empty array if none)

Focus on practical advice. Reference specific wave names and numbers from the data.

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a cost optimization prompt
 *
 * @param {Object} data - Cost and profile data
 * @returns {string} Formatted prompt
 */
function buildCostOptimizationPrompt(data) {
  const profileList = data.vmProfiles
    .map(p => `  - Profile "${p.profile}": ${p.count} VMs, workload: ${p.workloadType}`)
    .join('\n');

  return `You are an IBM Cloud cost optimization specialist. Analyze the following migration cost profile and provide optimization recommendations.

Migration target: ${data.migrationTarget || 'not specified'}
Region: ${data.region || 'us-south'}
Total estimated monthly cost: $${data.totalMonthlyCost.toLocaleString()}

VM profile allocation:
${profileList}

Consider:
- Right-sizing opportunities (are VMs over-provisioned for their workload type?)
- Reserved instance pricing vs on-demand
- Profile family optimization (balanced vs compute vs memory-optimized)
- Storage tier optimization
- Regional pricing differences
- Workload-specific recommendations

Provide a JSON response with:
- "recommendations": array of objects, each with:
  - "category": category name (e.g., "Right-sizing", "Reserved Pricing", "Storage Optimization")
  - "description": specific, actionable recommendation
  - "estimatedSavings": estimated savings description (e.g., "10-15% monthly reduction")
  - "priority": "high", "medium", or "low"
- "architectureRecommendations": array of 2-3 architecture-level suggestions for cost efficiency

Sort recommendations by priority (high first). Reference specific profiles and numbers from the data.

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a remediation guidance prompt for migration blockers
 *
 * @param {Object} data - Blocker data
 * @returns {string} Formatted prompt
 */
function buildRemediationPrompt(data) {
  const blockerList = data.blockers.map((b, i) =>
    `${i + 1}. Type: "${b.type}", Affected VMs: ${b.affectedVMCount}, Details: ${b.details}`
  ).join('\n');

  return `You are a VMware migration remediation expert. Provide step-by-step remediation guidance for the following migration blockers.

Migration target: ${data.migrationTarget || 'vsi'} (${data.migrationTarget === 'roks' ? 'Red Hat OpenShift on IBM Cloud with OpenShift Virtualization' : 'IBM Cloud VPC Virtual Server Instances'})

Migration blockers:
${blockerList}

For each blocker, provide:
1. Step-by-step remediation instructions specific to the migration target
2. Estimated effort level
3. Alternative approaches if direct remediation is not feasible

Common blocker types and remediation context:
- RDM (Raw Device Mapping) disks: Cannot be directly migrated; need to convert to VMDK or use alternative storage
- Snapshots: Must be consolidated/removed before migration
- Old hardware versions: May need VM hardware upgrade
- Missing VMware Tools: Install or update before migration
- Unsupported guest OS: May need OS upgrade or alternative migration path
- Shared VMDK: Need to separate shared disks or migrate dependent VMs together
- vGPU: GPU workloads require special handling on IBM Cloud

Provide a JSON response with:
- "guidance": array of objects, each with:
  - "blockerType": the blocker type from input
  - "steps": array of step-by-step remediation instructions (3-6 steps)
  - "estimatedEffort": effort description (e.g., "1-2 hours per VM", "requires maintenance window")
  - "alternatives": array of alternative approaches if direct remediation is not possible

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a target selection prompt (ROKS vs VPC VSI)
 *
 * @param {Array<Object>} vms - VM summaries with workload types
 * @returns {string} Formatted prompt
 */
function buildTargetSelectionPrompt(vms) {
  const vmDescriptions = vms.map((vm, i) =>
    `${i + 1}. Name: "${vm.vmName}", OS: "${vm.guestOS || 'unknown'}", Workload: "${vm.workloadType || 'unknown'}", vCPUs: ${vm.vCPUs}, Memory MB: ${vm.memoryMB}, Storage MB: ${vm.storageMB || 0}, NICs: ${vm.nicCount || 1}${vm.hasRDM ? ', has RDM disks' : ''}${vm.hasSharedVMDK ? ', has shared VMDK' : ''}${vm.hasVGPU ? ', has vGPU' : ''}`
  ).join('\n');

  return `You are an IBM Cloud migration target selection expert. For each VM, recommend whether it should migrate to ROKS (Red Hat OpenShift on IBM Cloud with OpenShift Virtualization) or VPC VSI (Virtual Server Instances).

Decision framework:
1. **OS constraints**: Windows VMs → VSI (ROKS/OpenShift Virt does not support Windows). Linux VMs are candidates for both.
2. **Resource requirements**: VMs needing >512 GiB RAM → ROKS bare metal workers. Very large VMs (>16 vCPU, >128GB) may benefit from ROKS bare metal.
3. **Workload affinity**: Databases and stateful enterprise apps → VSI (simpler management). Middleware, app servers, containerizable workloads → ROKS. DevOps/CI-CD → ROKS. Backup/monitoring infrastructure → VSI.
4. **Migration complexity**: VMs with RDM disks, shared VMDKs, or vGPU → VSI (fewer constraints). Simple Linux VMs → ROKS (lower operational overhead at scale).
5. **Operational model**: If the workload benefits from Kubernetes orchestration → ROKS. If it needs traditional VM management → VSI.

VMs to evaluate:
${vmDescriptions}

Respond with a JSON array. Each element must have:
- "vmName": exact VM name from input
- "target": "roks" or "vsi"
- "confidence": number 0.0-1.0 indicating selection certainty
- "reasoning": brief explanation (1-2 sentences)
- "alternativeTarget": the other option ("roks" or "vsi")
- "alternativeReasoning": why the alternative could also work (1 sentence)

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a wave sequencing prompt with dependency detection
 *
 * @param {Object} data - Wave data with VM details
 * @returns {string} Formatted prompt
 */
function buildWaveSequencingPrompt(data) {
  const waveDescriptions = data.waves.map((w, i) => {
    let desc = `${i + 1}. "${w.name}": ${w.vmCount} VMs, ${w.totalVCPUs} vCPUs, ${Math.round(w.totalMemoryGiB)} GiB RAM`;
    desc += `, workloads: ${w.workloadTypes.join(', ') || 'mixed'}`;
    if (w.networkGroups && w.networkGroups.length > 0) {
      desc += `, networks: ${w.networkGroups.join(', ')}`;
    }
    if (w.vmSummaries && w.vmSummaries.length > 0) {
      desc += '\n   VMs: ' + w.vmSummaries.map(v =>
        `${v.workloadType}(${v.vCPUs}vCPU/${Math.round(v.memoryGiB)}GiB, net:${v.networkGroup || 'unknown'})`
      ).join(', ');
    }
    return desc;
  }).join('\n');

  return `You are a migration wave sequencing expert. Analyze the following wave plan and detect dependencies, suggest reordering, and recommend VM moves between waves.

Migration target: ${data.migrationTarget || 'not specified'}
Total VMs: ${data.totalVMs}

Current wave plan:
${waveDescriptions}

Analyze for:
1. **Dependencies**: VMs on the same subnet should migrate together. Database VMs should migrate before application servers that depend on them.
2. **Risk scheduling**: Put low-risk, low-complexity waves first. Critical infrastructure last.
3. **Balance**: Waves should be roughly balanced in size and complexity.
4. **Network coherence**: VMs sharing network segments should be in the same wave when possible.

Provide a JSON response with:
- "suggestedOrder": array of wave names in recommended execution order
- "dependencies": array of objects with "from" (wave name), "to" (wave name), "reason" (why this dependency exists)
- "riskSchedule": array of objects with "waveName", "riskLevel" ("low"/"medium"/"high"), "riskReason"
- "vmMoveRecommendations": array of objects with "vmDescription" (workload type + specs), "fromWave", "toWave", "reason"

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build an anomaly detection prompt
 *
 * @param {Object} data - Pre-computed anomaly candidates
 * @returns {string} Formatted prompt
 */
function buildAnomalyDetectionPrompt(data) {
  const candidateDescriptions = data.anomalyCandidates.map((a, i) =>
    `${i + 1}. Category: "${a.category}", Details: ${a.description}, Affected: ${a.affectedCount} VMs, Stats: ${a.stats || 'n/a'}`
  ).join('\n');

  return `You are a VMware environment health analyst. Review these pre-detected anomaly candidates and provide analysis with remediation recommendations.

Environment: ${data.totalVMs} total VMs, ${data.totalHosts || 0} hosts, ${data.totalClusters || 0} clusters.

Anomaly candidates (detected via statistical analysis):
${candidateDescriptions}

For each anomaly candidate:
1. Validate whether it's a genuine concern or a false positive
2. Assess severity (critical, high, medium, low)
3. Explain the migration impact
4. Recommend remediation steps

Provide a JSON response with:
- "anomalies": array of objects, each with:
  - "category": one of "resource-misconfig", "security-concern", "migration-risk", "network-anomaly", "storage-anomaly", "configuration-drift"
  - "severity": "critical", "high", "medium", or "low"
  - "title": short title (5-10 words)
  - "description": explanation of the issue (2-3 sentences)
  - "affectedCount": number of affected VMs
  - "recommendation": specific remediation advice (1-2 sentences)
  - "isValid": boolean (false if this is a false positive)

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a risk analysis prompt
 *
 * @param {Object} data - Risk assessment data
 * @returns {string} Formatted prompt
 */
function buildRiskAnalysisPrompt(data) {
  const domainSummaries = (data.riskAssessment.domains || []).map(d =>
    `- ${d.name}: severity=${d.severity}, auto-calculated=${d.autoSeverity !== null}, evidence: ${(d.evidence || []).map(e => e.title).join(', ') || 'none'}`
  ).join('\n');

  return `You are a migration risk assessment expert. Review the current risk assessment and provide AI-enhanced analysis.

Environment: ${data.totalVMs || 0} VMs, ${data.totalHosts || 0} hosts
Overall risk: ${data.riskAssessment.overallRisk || 'unknown'}
Go/No-Go: ${data.riskAssessment.goNoGo || 'unknown'}

Current risk domains:
${domainSummaries}

${data.blockerSummary ? `Key blockers: ${data.blockerSummary.join('; ')}` : ''}
${data.complexitySummary ? `Complexity: ${data.complexitySummary.simple} simple, ${data.complexitySummary.moderate} moderate, ${data.complexitySummary.complex} complex, ${data.complexitySummary.blocker} blockers` : ''}

Analyze:
1. Validate auto-calculated severities — are they appropriate given the evidence?
2. Identify any missed risks not covered by the current assessment
3. For the Security domain (manual-only), suggest specific security risks based on the environment
4. Provide an overall Go/No-Go recommendation with confidence

Provide a JSON response with:
- "severityAdjustments": array of objects with "domain", "currentSeverity", "suggestedSeverity", "reasoning"
- "missedRisks": array of objects with "domain", "title", "severity", "description"
- "securityRisks": array of objects with "title", "severity", "description", "recommendation"
- "goNoGoAnalysis": object with "recommendation" ("go", "conditional", "no-go"), "confidence" (0-1), "reasoning" (2-3 sentences), "keyConditions" (array of strings, conditions for "conditional")

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build a report narrative prompt
 *
 * @param {Object} data - Full environment summary for report generation
 * @returns {string} Formatted prompt
 */
function buildReportNarrativePrompt(data) {
  let envSection = `Environment: ${data.totalVMs} VMs, ${data.totalVCPUs} vCPUs, ${Math.round(data.totalMemoryGiB)} GiB RAM, ${Number(data.totalStorageTiB).toFixed(2)} TiB storage`;
  envSection += `\nClusters: ${data.clusterCount}, Hosts: ${data.hostCount}`;
  envSection += `\nMigration target: ${data.migrationTarget || 'not specified'}`;

  if (data.workloadBreakdown) {
    envSection += '\nWorkloads: ' + Object.entries(data.workloadBreakdown).map(([t, c]) => `${t}: ${c}`).join(', ');
  }

  if (data.costEstimate) {
    envSection += `\nEstimated monthly cost: $${data.costEstimate.monthly.toLocaleString()}`;
  }

  if (data.riskSummary) {
    envSection += `\nOverall risk: ${data.riskSummary.overallRisk}, Go/No-Go: ${data.riskSummary.goNoGo}`;
  }

  if (data.wavePlan) {
    envSection += `\nWave plan: ${data.wavePlan.totalWaves} waves, ${data.wavePlan.totalDuration} weeks estimated`;
  }

  return `You are a senior cloud migration consultant writing a formal migration assessment report. Generate professional narratives for each section based on the environment data.

${envSection}

Write in a formal, professional tone suitable for executive stakeholders. Use specific numbers from the data. Each section should be self-contained.

Provide a JSON response with:
- "executiveSummary": 3-4 paragraph executive summary covering scope, key findings, and recommendation
- "environmentAnalysis": 2-3 paragraphs analyzing the current VMware environment
- "migrationRecommendation": 2-3 paragraphs with the recommended migration approach and justification
- "riskNarrative": 2-3 paragraphs covering key risks and mitigations
- "costJustification": 2-3 paragraphs justifying the migration costs and expected ROI
- "nextSteps": array of 5-7 specific next steps as strings
- "assumptions": array of 3-5 key assumptions as strings

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build discovery questions prompt
 *
 * @param {Object} data - Environment summary + context
 * @returns {string} Formatted prompt
 */
function buildDiscoveryQuestionsPrompt(data) {
  let envContext = '';
  if (data.totalVMs) {
    envContext = `Environment: ${data.totalVMs} VMs, ${data.totalVCPUs || 0} vCPUs, ${Math.round(data.totalMemoryGiB || 0)} GiB RAM.`;
  }
  if (data.workloadBreakdown) {
    envContext += '\nWorkloads: ' + Object.entries(data.workloadBreakdown).map(([t, c]) => `${t}: ${c}`).join(', ');
  }

  const pageContext = data.currentPage || 'general';

  return `You are a migration discovery consultant. Generate structured interview questions to gather information needed for a VMware to IBM Cloud migration assessment.

${envContext}
Current context: ${pageContext}

Generate questions organized by topic that a consultant would ask to fill gaps in the migration plan. Questions should be specific to this environment's size and composition.

Topics to cover:
1. Business Context — timelines, budget, compliance requirements, stakeholders
2. Technical Requirements — performance SLAs, HA/DR requirements, networking constraints
3. Risk Tolerance — acceptable downtime, rollback requirements, data sensitivity
4. Operational Readiness — team skills, support contracts, monitoring requirements
5. Application Dependencies — inter-VM relationships, external integrations, shared storage

Provide a JSON response with:
- "questionGroups": array of objects, each with:
  - "topic": topic name
  - "relevance": why this topic matters for this environment (1 sentence)
  - "questions": array of objects with "id" (unique string), "question" (the question text), "priority" ("high"/"medium"/"low"), "context" (why this question matters, 1 sentence)

Respond ONLY with valid JSON, no other text.`;
}

/**
 * Build interview prompt for interactive Q&A
 *
 * @param {Object} data - Interview state
 * @returns {string} Formatted prompt
 */
function buildInterviewPrompt(data) {
  let historyText = '';
  if (data.interviewHistory && data.interviewHistory.length > 0) {
    historyText = '\nPrevious Q&A:\n' + data.interviewHistory.map(h =>
      `Q: ${h.question}\nA: ${h.answer}`
    ).join('\n\n');
  }

  let envContext = '';
  if (data.environmentContext) {
    envContext = `\nEnvironment: ${data.environmentContext.totalVMs || 0} VMs, ${data.environmentContext.migrationTarget || 'not specified'} target.`;
  }

  return `You are a migration discovery consultant conducting an interactive interview. Based on the user's answer, provide insights and determine the next question.
${envContext}
Current question ID: ${data.currentQuestionId || 'initial'}
User's answer: "${data.userAnswer}"
${historyText}

Analyze the user's answer and:
1. Extract any useful insights for the migration plan
2. Determine the most relevant next question based on what we now know
3. Provide brief context for why the next question matters

Provide a JSON response with:
- "nextQuestion": object with "id" (unique string), "question" (text), "topic" (category)
- "followUpContext": why this next question is important given the previous answer (1 sentence)
- "insightsFromAnswer": array of strings — key facts or decisions extracted from the user's answer

Respond ONLY with valid JSON, no other text.`;
}

module.exports = {
  buildClassificationPrompt,
  buildRightsizingPrompt,
  buildInsightsPrompt,
  buildChatSystemPrompt,
  buildWaveSuggestionsPrompt,
  buildCostOptimizationPrompt,
  buildRemediationPrompt,
  buildTargetSelectionPrompt,
  buildWaveSequencingPrompt,
  buildAnomalyDetectionPrompt,
  buildRiskAnalysisPrompt,
  buildReportNarrativePrompt,
  buildDiscoveryQuestionsPrompt,
  buildInterviewPrompt,
};
