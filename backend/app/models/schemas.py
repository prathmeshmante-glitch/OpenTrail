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
    relevance_reason: str
    is_verified: bool = True

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
