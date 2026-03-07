// TypeScript interfaces for all AI service requests and responses

// ===== SHARED TYPES =====

export type AISource = 'watsonx' | 'rule-based' | 'cached';

export interface AIProxyHealthResponse {
  status: string;
  model?: string;
  projectId?: string;
}

// ===== CLASSIFICATION TYPES =====

export interface VMClassificationInput {
  vmName: string;
  guestOS?: string;
  annotation?: string;
  vCPUs: number;
  memoryMB: number;
  diskCount: number;
  nicCount: number;
  powerState?: string;
}

export interface VMClassificationResult {
  vmName: string;
  workloadType: string;
  confidence: number; // 0-1
  reasoning: string;
  alternatives: Array<{
    workloadType: string;
    confidence: number;
  }>;
  source: 'ai' | 'pattern';
}

export interface ClassificationRequest {
  vms: VMClassificationInput[];
}

export interface ClassificationResponse {
  classifications: VMClassificationResult[];
  model: string;
  processingTimeMs: number;
}

// ===== RIGHT-SIZING TYPES =====

export interface RightsizingInput {
  vmName: string;
  vCPUs: number;
  memoryMB: number;
  storageMB: number;
  workloadType?: string;
  guestOS?: string;
  powerState?: string;
  avgCpuUsage?: number;
  avgMemUsage?: number;
}

export interface ProfileRecommendation {
  vmName: string;
  recommendedProfile: string;
  reasoning: string;
  costSavingsEstimate?: string;
  alternativeProfile?: string;
  alternativeReasoning?: string;
  isOverprovisioned: boolean;
  source: 'ai' | 'rule-based';
}

export interface RightsizingRequest {
  vms: RightsizingInput[];
  availableProfiles: Array<{
    name: string;
    vcpus: number;
    memoryGiB: number;
    family: string;
  }>;
}

export interface RightsizingResponse {
  recommendations: ProfileRecommendation[];
  model: string;
  processingTimeMs: number;
}

// ===== INSIGHTS TYPES =====

export interface NetworkSummaryForAI {
  portGroup: string;
  subnet: string;
  vmCount: number;
}

export interface InsightsInput {
  totalVMs: number;
  totalExcluded: number;
  totalVCPUs: number;
  totalMemoryGiB: number;
  totalStorageTiB: number;
  clusterCount: number;
  hostCount: number;
  datastoreCount: number;
  workloadBreakdown: Record<string, number>;
  complexitySummary: {
    simple: number;
    moderate: number;
    complex: number;
    blocker: number;
  };
  blockerSummary: string[];
  networkSummary?: NetworkSummaryForAI[];
  costEstimate?: {
    monthly: number;
    annual: number;
    region: string;
  };
  migrationTarget?: 'roks' | 'vsi' | 'both';
}

export interface MigrationInsights {
  executiveSummary: string;
  riskAssessment: string;
  recommendations: string[];
  costOptimizations: string[];
  migrationStrategy: string;
  source: AISource;
}

export interface InsightsRequest {
  data: InsightsInput;
}

export interface InsightsResponse {
  insights: MigrationInsights;
  model: string;
  processingTimeMs: number;
}

// ===== CHAT TYPES =====

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatContext {
  summary: {
    totalVMs: number;
    totalExcluded: number;
    totalVCPUs: number;
    totalMemoryGiB: number;
    totalStorageTiB: number;
    clusterCount: number;
    hostCount: number;
    datastoreCount: number;
  };
  workloadBreakdown: Record<string, number>;
  complexitySummary: {
    simple: number;
    moderate: number;
    complex: number;
    blocker: number;
  };
  blockerSummary: string[];
  costEstimate?: {
    monthly: number;
    annual: number;
    region: string;
  };
  currentPage: string;
  // Enriched context — aggregated data slices, never individual VM data
  networkTopology?: string[];
  osDistribution?: string[];
  topResourceConsumers?: string[];
  snapshotSummary?: string;
  datastoreSummary?: string;
  riskSummary?: string;
}

export interface ChatRequest {
  message: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  context?: ChatContext;
}

export interface ChatResponse {
  response: string;
  suggestedFollowUps?: string[];
  model: string;
  processingTimeMs: number;
}

// ===== WAVE SUGGESTIONS TYPES =====

export interface WaveSuggestionInput {
  waves: Array<{
    name: string;
    vmCount: number;
    totalVCPUs: number;
    totalMemoryGiB: number;
    totalStorageGiB: number;
    avgComplexity: number;
    hasBlockers: boolean;
    workloadTypes: string[];
  }>;
  totalVMs: number;
  migrationTarget: 'roks' | 'vsi' | 'both';
}

export interface WaveSuggestionResult {
  suggestions: string[];
  riskNarratives: Array<{ waveName: string; narrative: string }>;
  dependencyWarnings: string[];
  source: AISource;
}

export interface WaveSuggestionRequest {
  data: WaveSuggestionInput;
}

export interface WaveSuggestionResponse {
  result: WaveSuggestionResult;
  model: string;
  processingTimeMs: number;
}

// ===== COST OPTIMIZATION TYPES =====

export interface CostOptimizationInput {
  vmProfiles: Array<{
    profile: string;
    count: number;
    workloadType: string;
  }>;
  totalMonthlyCost: number;
  migrationTarget: 'roks' | 'vsi' | 'both';
  region: string;
}

export interface CostOptimizationRecommendation {
  category: string;
  description: string;
  estimatedSavings: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CostOptimizationResult {
  recommendations: CostOptimizationRecommendation[];
  architectureRecommendations: string[];
  source: AISource;
}

export interface CostOptimizationRequest {
  data: CostOptimizationInput;
}

export interface CostOptimizationResponse {
  result: CostOptimizationResult;
  model: string;
  processingTimeMs: number;
}

// ===== REMEDIATION TYPES =====

export interface RemediationInput {
  blockers: Array<{
    type: string;
    affectedVMCount: number;
    details: string;
  }>;
  migrationTarget: 'roks' | 'vsi';
}

export interface RemediationGuidance {
  blockerType: string;
  steps: string[];
  estimatedEffort: string;
  alternatives: string[];
}

export interface RemediationResult {
  guidance: RemediationGuidance[];
  source: AISource;
}

export interface RemediationRequest {
  data: RemediationInput;
}

export interface RemediationResponse {
  result: RemediationResult;
  model: string;
  processingTimeMs: number;
}

// ===== STREAMING TYPES =====

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
}

// ===== TARGET SELECTION TYPES =====

export type MigrationTarget = 'roks' | 'vsi' | 'powervs';

export interface TargetSelectionInput {
  vmName: string;
  guestOS?: string;
  workloadType?: string;
  vCPUs: number;
  memoryMB: number;
  storageMB?: number;
  nicCount?: number;
  hasRDM?: boolean;
  hasSharedVMDK?: boolean;
  hasVGPU?: boolean;
}

export interface TargetSelectionResult {
  vmName: string;
  target: MigrationTarget;
  confidence: number; // 0-1
  reasoning: string;
  alternativeTarget: MigrationTarget;
  alternativeReasoning: string;
  source: 'ai' | 'rule-based';
}

export interface TargetSelectionRequest {
  vms: TargetSelectionInput[];
}

export interface TargetSelectionResponse {
  selections: TargetSelectionResult[];
  model: string;
  processingTimeMs: number;
}

// ===== WAVE SEQUENCING TYPES =====

export interface WaveSequencingInput {
  waves: Array<{
    name: string;
    vmCount: number;
    totalVCPUs: number;
    totalMemoryGiB: number;
    workloadTypes: string[];
    networkGroups?: string[];
    vmSummaries?: Array<{
      workloadType: string;
      vCPUs: number;
      memoryGiB: number;
      networkGroup?: string;
    }>;
  }>;
  totalVMs: number;
  migrationTarget: MigrationTarget | 'both';
}

export interface DependencyDetection {
  from: string;
  to: string;
  reason: string;
}

export interface VMMoveSuggestion {
  vmDescription: string;
  fromWave: string;
  toWave: string;
  reason: string;
}

export interface WaveSequencingResult {
  suggestedOrder: string[];
  dependencies: DependencyDetection[];
  riskSchedule: Array<{ waveName: string; riskLevel: 'low' | 'medium' | 'high'; riskReason: string }>;
  vmMoveRecommendations: VMMoveSuggestion[];
  source: AISource;
}

export interface WaveSequencingRequest {
  data: WaveSequencingInput;
}

export interface WaveSequencingResponse {
  result: WaveSequencingResult;
  model: string;
  processingTimeMs: number;
}

// ===== ANOMALY DETECTION TYPES =====

export type AnomalyCategory =
  | 'resource-misconfig'
  | 'security-concern'
  | 'migration-risk'
  | 'network-anomaly'
  | 'storage-anomaly'
  | 'configuration-drift';

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AnomalyCandidate {
  category: AnomalyCategory;
  description: string;
  affectedCount: number;
  stats?: string;
}

export interface AnomalyDetectionInput {
  anomalyCandidates: AnomalyCandidate[];
  totalVMs: number;
  totalHosts?: number;
  totalClusters?: number;
}

export interface AnomalyResult {
  category: AnomalyCategory;
  severity: AnomalySeverity;
  title: string;
  description: string;
  affectedCount: number;
  recommendation: string;
  isValid: boolean;
}

export interface AnomalyDetectionResult {
  anomalies: AnomalyResult[];
  source: AISource;
}

export interface AnomalyDetectionRequest {
  data: AnomalyDetectionInput;
}

export interface AnomalyDetectionResponse {
  result: AnomalyDetectionResult;
  model: string;
  processingTimeMs: number;
}

// ===== AI RISK ANALYSIS TYPES =====

export interface RiskAnalysisInput {
  riskAssessment: {
    overallRisk: string;
    goNoGo: string;
    domains: Array<{
      name: string;
      severity: string;
      autoSeverity: string | null;
      evidence: Array<{ title: string }>;
    }>;
  };
  totalVMs: number;
  totalHosts?: number;
  blockerSummary?: string[];
  complexitySummary?: {
    simple: number;
    moderate: number;
    complex: number;
    blocker: number;
  };
}

export interface SeverityAdjustment {
  domain: string;
  currentSeverity: string;
  suggestedSeverity: string;
  reasoning: string;
}

export interface MissedRisk {
  domain: string;
  title: string;
  severity: string;
  description: string;
}

export interface SecurityRisk {
  title: string;
  severity: string;
  description: string;
  recommendation: string;
}

export interface GoNoGoAnalysis {
  recommendation: 'go' | 'conditional' | 'no-go';
  confidence: number;
  reasoning: string;
  keyConditions: string[];
}

export interface RiskAnalysisResult {
  severityAdjustments: SeverityAdjustment[];
  missedRisks: MissedRisk[];
  securityRisks: SecurityRisk[];
  goNoGoAnalysis: GoNoGoAnalysis;
  source: AISource;
}

export interface RiskAnalysisRequest {
  data: RiskAnalysisInput;
}

export interface RiskAnalysisResponse {
  result: RiskAnalysisResult;
  model: string;
  processingTimeMs: number;
}

// ===== REPORT NARRATIVE TYPES =====

export interface ReportInput {
  totalVMs: number;
  totalVCPUs: number;
  totalMemoryGiB: number;
  totalStorageTiB: number;
  clusterCount: number;
  hostCount: number;
  migrationTarget?: string;
  workloadBreakdown?: Record<string, number>;
  costEstimate?: {
    monthly: number;
    annual: number;
    region: string;
  };
  riskSummary?: {
    overallRisk: string;
    goNoGo: string;
  };
  wavePlan?: {
    totalWaves: number;
    totalDuration: number;
  };
}

export interface ReportNarrativeResult {
  executiveSummary: string;
  environmentAnalysis: string;
  migrationRecommendation: string;
  riskNarrative: string;
  costJustification: string;
  nextSteps: string[];
  assumptions: string[];
  source: AISource;
}

export interface ReportNarrativeRequest {
  data: ReportInput;
}

export interface ReportNarrativeResponse {
  result: ReportNarrativeResult;
  model: string;
  processingTimeMs: number;
}

// ===== DISCOVERY QUESTIONS TYPES =====

export interface DiscoveryQuestionsInput {
  totalVMs?: number;
  totalVCPUs?: number;
  totalMemoryGiB?: number;
  workloadBreakdown?: Record<string, number>;
  currentPage?: string;
}

export interface DiscoveryQuestion {
  id: string;
  question: string;
  priority: 'high' | 'medium' | 'low';
  context: string;
}

export interface QuestionGroup {
  topic: string;
  relevance: string;
  questions: DiscoveryQuestion[];
}

export interface DiscoveryQuestionsResult {
  questionGroups: QuestionGroup[];
  source: AISource;
}

export interface DiscoveryQuestionsRequest {
  data: DiscoveryQuestionsInput;
}

export interface DiscoveryQuestionsResponse {
  result: DiscoveryQuestionsResult;
  model: string;
  processingTimeMs: number;
}

// ===== INTERVIEW TYPES =====

export interface InterviewInput {
  currentQuestionId?: string;
  userAnswer: string;
  interviewHistory?: Array<{
    question: string;
    answer: string;
  }>;
  environmentContext?: {
    totalVMs?: number;
    migrationTarget?: string;
  };
}

export interface InterviewResult {
  nextQuestion: {
    id: string;
    question: string;
    topic: string;
  };
  followUpContext: string;
  insightsFromAnswer: string[];
  source: AISource;
}

export interface InterviewRequest {
  currentQuestionId?: string;
  userAnswer: string;
  interviewHistory?: Array<{
    question: string;
    answer: string;
  }>;
  environmentContext?: {
    totalVMs?: number;
    migrationTarget?: string;
  };
}

export interface InterviewResponse {
  result: InterviewResult;
  model: string;
  processingTimeMs: number;
}

// ===== SETTINGS TYPES =====

export interface AISettings {
  enabled: boolean;
  consentGiven: boolean;
}

export const AI_SETTINGS_KEY = 'vcf-ai-settings';

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  consentGiven: false,
};
