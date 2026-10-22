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
