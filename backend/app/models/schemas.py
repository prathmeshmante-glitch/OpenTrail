from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class JobStage(str, Enum):
    VALIDATING = "validating"
    FETCHING = "fetching"
    EXTRACTING = "extracting"
    PREPARING = "preparing"
    READY = "ready"
    FAILED = "failed"

class RepositorySubmitRequest(BaseModel):
    url: str = Field(..., description="Public GitHub repository URL (e.g. https://github.com/owner/repo)")

class IssueInvestigationRequest(BaseModel):
    issue_text: str = Field(..., description="Pasted issue text or bug description", min_length=5)
    issue_url: Optional[str] = Field(None, description="Optional GitHub issue URL")

class GraphNode(BaseModel):
    id: str
    label: str
    kind: str = Field(..., description="file, class, function, method, module, or test")
    file_path: str
    symbol_name: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    community: Optional[int] = None
    degree: int = 0
    is_hub: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship_type: str = Field(..., description="calls, imports, imports_from, contains, method, references")
    confidence: str = Field("EXTRACTED", description="EXTRACTED or INFERRED")
    confidence_score: float = 1.0
    evidence: Optional[str] = None
    source_location: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RepositoryStatistics(BaseModel):
    total_nodes: int
    total_edges: int
    total_files: int
    total_communities: int
    god_nodes_count: int

class HubNode(BaseModel):
    id: str
    label: str
    degree: int

class CrossFileSurprise(BaseModel):
    source: str
    target: str
    relation: str
    confidence: str
    why: str
    source_files: List[str] = Field(default_factory=list)

class RepositoryGraph(BaseModel):
    repository_id: str
    owner: str
    name: str
    graph_version: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    statistics: RepositoryStatistics
    hub_nodes: List[HubNode] = Field(default_factory=list)
    surprises: List[CrossFileSurprise] = Field(default_factory=list)
    generated_at: str

class ShortestPathResponse(BaseModel):
    source: str
    target: str
    hops: int
    path_nodes: List[str]
    path_edges: List[str]
    formatted_explanation: str

class JobStatusResponse(BaseModel):
    job_id: str
    repository_id: Optional[str] = None
    stage: JobStage
    progress: int = Field(..., ge=0, le=100)
    message: str
    error: Optional[str] = None
    created_at: str
    updated_at: str

class InvestigationComponent(BaseModel):
    node_id: str
    label: str
    file_path: str
    symbol_name: Optional[str] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    relevance_reason: str
    is_verified: bool = False

class InvestigationRecommendation(BaseModel):
    issue_summary: str
    relevant_components: List[InvestigationComponent]
    reasoning_summary: str
    confirmed_relationships: List[str]
    potential_impact: List[str]
    suggested_tests: List[str]
    investigation_steps: List[str]
    uncertainties: List[str]
    evidence_references: List[str]

class InvestigationResponse(BaseModel):
    investigation_id: str
    repository_id: str
    status: str = Field(..., description="processing, completed, failed")
    recommendations: Optional[InvestigationRecommendation] = None
    error: Optional[str] = None
    created_at: str

class HealthResponse(BaseModel):
    status: str
    version: str
    python_executable: str
    graphify_available: bool
    ai_available: bool
    ai_model: str

# --- Evidence Ledger & "Why This File?" Models ---
class EvidenceItem(BaseModel):
    id: str
    file_path: str
    symbol_name: Optional[str] = None
    entity_type: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    snippet: Optional[str] = None
    classification: str = Field(
        ...,
        description="'Verified in source', 'Graph-supported', 'AI hypothesis', 'Proposed recommendation'",
    )
    supporting_relationship: Optional[str] = None
    is_direct: bool = True
    provenance: Optional[str] = None
    uncertainties: Optional[str] = None

class WhyThisFileResponse(BaseModel):
    file_path: str
    relevance_reason: str
    match_type: str = Field(..., description="'direct', 'transitive', or 'inferred'")
    summary: Optional[str] = None
    relevance: Optional[str] = None
    matched_terms: List[str] = Field(default_factory=list)
    matched_keywords: List[str] = Field(default_factory=list)
    verified_symbols: List[str] = Field(default_factory=list)
    connecting_edges: List[str] = Field(default_factory=list)
    source_locations: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    source_snippet: Optional[str] = None

# --- Change Impact Simulator Models ---
class ImpactedNode(BaseModel):
    node_id: str
    label: str
    kind: str
    file_path: str
    line_start: Optional[int] = None
    depth: int = 1
    distance: int = 1
    is_direct: bool = True
    impact_type: str = Field(..., description="'direct' or 'transitive'")
    relationship_path: List[str] = Field(default_factory=list)
    path_from_target: List[str] = Field(default_factory=list)
    connecting_edge_ids: List[str] = Field(default_factory=list)
    relationship_type: str = "calls"
    evidence: Optional[str] = None
    source_location: Optional[str] = None

class ImpactSimulationResponse(BaseModel):
    repository_id: str = ""
    target_node_id: str
    target_label: str
    target_file: str = ""
    max_depth: int
    depth: int = 2
    total_impacted: int
    direct_impact_count: int
    transitive_impact_count: int
    impacted_nodes: List[ImpactedNode]
    affected_edge_ids: List[str] = Field(default_factory=list)
    affected_paths: List[List[str]] = Field(default_factory=list)
    candidate_test_nodes: List[str] = Field(default_factory=list)
    candidate_test_files: List[str] = Field(default_factory=list)
    candidate_tests: List[str] = Field(default_factory=list)
    summary_caveats: Any = Field(default_factory=list)

# --- Smart Regression Test Map Models ---
class TestMapItem(BaseModel):
    test_node_id: str = ""
    node_id: Optional[str] = None
    test_name: str = ""
    name: str = ""
    test_file: str = ""
    file_path: str = ""
    line_start: Optional[int] = None
    source_location: Optional[str] = None
    state: str = Field(
        ...,
        description="'Existing test — verified', 'Proposed new test', 'Suggested manual validation'",
    )
    relevance_score: int
    relevance_reason: str
    target_symbols: List[str] = Field(default_factory=list)
    connected_symbol: Optional[str] = None
    evidence_path: List[str] = Field(default_factory=list)

class TestMapResponse(BaseModel):
    repository_id: str
    total_tests_discovered: int = 0
    total_discovered: int = 0
    verified_existing_count: int = 0
    target_symbols: List[str] = Field(default_factory=list)
    existing_tests: List[TestMapItem]
    proposed_tests: List[TestMapItem]
    tests: List[TestMapItem] = Field(default_factory=list)
    summary: str = ""

# --- Interactive Execution Trail Models ---
class ExecutionTrailStep(BaseModel):
    step_index: int = 0
    step_number: int = 1
    node_id: str
    label: str
    kind: str
    file_path: str
    line_start: Optional[int] = None
    source_location: Optional[str] = None
    relationship_from_prev: Optional[str] = None
    incoming_relation: Optional[str] = None
    edge_id: Optional[str] = None
    is_inferred: bool = False
    is_structurally_extracted: bool = True
    provenance: str = "AST Extracted"
    source_snippet: Optional[str] = None
    source_excerpt: Optional[str] = None
    evidence: Optional[str] = None
    explanation: str = ""

class ExecutionTrailResponse(BaseModel):
    trail_id: str = ""
    repository_id: str = ""
    name: str = ""
    description: str = ""
    trail_type: str = "Static Dependency Trail"
    steps: List[ExecutionTrailStep]
    total_hops: int
    node_ids: List[str] = Field(default_factory=list)
    trail_path: List[str] = Field(default_factory=list)
    edge_ids: List[str] = Field(default_factory=list)
    caveats: List[str] = Field(default_factory=list)

# --- First Contribution Mode Models ---
class FirstContributionStep(BaseModel):
    step_number: int
    title: str = ""
    description: str = ""
    recommended_file: str = ""
    target_node_id: Optional[str] = None
    verified_symbol: Optional[str] = None
    evidence_badge: str = "AST Extracted"

class FirstContributionPlan(BaseModel):
    repository_id: str = ""
    issue_title: str
    beginner_summary: str = ""
    overview: str = ""
    reading_order_files: List[Any] = Field(default_factory=list)
    key_components: Any = Field(default_factory=dict)
    step_by_step_guide: Any = Field(default_factory=list)
    suggested_tests: List[str] = Field(default_factory=list)
    proposed_tests: List[str] = Field(default_factory=list)
    recommended_existing_tests: List[TestMapItem] = Field(default_factory=list)
    cautionary_notes: List[str] = Field(default_factory=list)

