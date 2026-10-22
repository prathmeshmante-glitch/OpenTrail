export type JobStage = 'validating' | 'fetching' | 'extracting' | 'preparing' | 'ready' | 'failed';

export interface JobStatusResponse {
  job_id: string;
  repository_id: string | null;
  stage: JobStage;
  progress: number;
  message: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export type NodeKind = 'file' | 'class' | 'function' | 'method' | 'module' | 'test';

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  file_path: string;
  symbol_name: string;
  line_start: number | null;
  line_end: number | null;
  community: number | null;
  degree: number;
  is_hub: boolean;
  metadata: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  confidence: 'EXTRACTED' | 'INFERRED';
  confidence_score: number;
  evidence: string | null;
  source_location: string | null;
  metadata: Record<string, any>;
}

export interface RepositoryStatistics {
  total_nodes: number;
  total_edges: number;
  total_files: number;
  total_communities: number;
  god_nodes_count: number;
}

export interface HubNode {
  id: string;
  label: string;
  degree: number;
}

export interface CrossFileSurprise {
  source: string;
  target: string;
  relation: string;
  confidence: string;
  why: string;
  source_files: string[];
}

export interface RepositoryGraph {
  repository_id: string;
  owner: string;
  name: string;
  graph_version: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  statistics: RepositoryStatistics;
  hub_nodes: HubNode[];
  surprises: CrossFileSurprise[];
  generated_at: string;
}

export interface ShortestPathResponse {
  source: string;
  target: string;
  hops: number;
  path_nodes: string[];
  path_edges: string[];
  formatted_explanation: string;
}

export interface InvestigationComponent {
  node_id: string;
  label: string;
  file_path: string;
  symbol_name: string | null;
  relevance_reason: string;
  is_verified: boolean;
  line_start?: number | null;
  line_end?: number | null;
}

export interface InvestigationRecommendation {
  issue_summary: string;
  relevant_components: InvestigationComponent[];
  reasoning_summary: string;
  confirmed_relationships: string[];
  potential_impact: string[];
  suggested_tests: string[];
  investigation_steps: string[];
  uncertainties: string[];
  evidence_references: string[];
}

export interface InvestigationResponse {
  investigation_id: string;
  repository_id: string;
  status: 'processing' | 'completed' | 'failed';
  recommendations: InvestigationRecommendation | null;
  error: string | null;
  created_at: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  python_executable: string;
  graphify_available: boolean;
  ai_available: boolean;
  ai_model: string;
}

export type EvidenceClassification = 
  | 'Verified in source' 
  | 'Graph-supported' 
  | 'AI hypothesis' 
  | 'Proposed recommendation';

export interface EvidenceItem {
  file_path: string;
  symbol_name: string;
  entity_type: string;
  line_start: number | null;
  line_end: number | null;
  source_excerpt: string | null;
  graph_relationship: string | null;
  is_direct: boolean;
  classification: EvidenceClassification;
  uncertainties: string[];
}

export interface WhyThisFileResponse {
  file_path: string;
  relevance_reason: string;
  match_type: 'direct' | 'transitive' | 'inferred';
  matched_terms: string[];
  verified_symbols: string[];
  connecting_edges: string[];
  source_locations: string[];
  missing_evidence: string[];
}

export interface ImpactedNode {
  node_id: string;
  label: string;
  kind: string;
  file_path: string;
  distance: number;
  relationship_type: string;
  is_direct: boolean;
  impact_type: 'direct caller' | 'direct consumer' | 'direct dependency' | 'transitive dependent' | 'transitive consumer';
  path_from_target: string[];
  evidence: string | null;
  source_location: string | null;
}

export interface ImpactSimulationResponse {
  repository_id: string;
  target_node_id: string;
  target_label: string;
  target_file: string;
  max_depth: number;
  direct_impact_count: number;
  transitive_impact_count: number;
  impacted_nodes: ImpactedNode[];
  affected_paths: string[][];
  candidate_tests: string[];
  summary_caveats: string[];
}

export type TestState = 
  | 'Existing test — verified'
  | 'Proposed new test'
  | 'Suggested manual validation'
  | 'Execution status unknown'
  | 'Executed and passed'
  | 'Executed and failed';

export interface TestMapItem {
  name: string;
  file_path: string;
  node_id: string | null;
  relevance_score: number;
  relevance_reason: string;
  state: TestState;
  connected_symbol: string | null;
  evidence_path: string[];
  source_location: string | null;
}

export interface TestMapResponse {
  repository_id: string;
  target_symbols: string[];
  existing_tests: TestMapItem[];
  proposed_tests: TestMapItem[];
  summary: string;
}

export interface ExecutionTrailStep {
  step_number: number;
  node_id: string;
  label: string;
  kind: string;
  file_path: string;
  source_location: string | null;
  source_excerpt: string | null;
  incoming_relation: string | null;
  evidence: string | null;
  is_structurally_extracted: boolean;
  provenance: string;
}

export interface ExecutionTrailResponse {
  repository_id: string;
  start_node_id: string;
  end_node_id: string | null;
  trail_type: string;
  total_hops: number;
  steps: ExecutionTrailStep[];
  trail_path: string[];
  caveats: string[];
}

export interface FirstContributionStep {
  step_number: number;
  title: string;
  description: string;
  recommended_file: string;
  target_node_id: string | null;
  verified_symbol: string | null;
  evidence_badge: string;
}

export interface FirstContributionPlan {
  repository_id: string;
  issue_title: string;
  beginner_summary: string;
  reading_order_files: string[];
  key_components: Record<string, string>;
  step_by_step_guide: FirstContributionStep[];
  suggested_tests: string[];
  cautionary_notes: string[];
}

