import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.app.config import settings
from backend.app.core.ai_orchestrator import ai_orchestrator
from backend.app.core.graphify_adapter import GraphifyAdapter
from backend.app.core.job_manager import job_manager
from backend.app.core.security import SecurityValidationError
from backend.app.models.schemas import (
    HealthResponse,
    HubNode,
    InvestigationResponse,
    IssueInvestigationRequest,
    JobStatusResponse,
    RepositoryGraph,
    RepositorySubmitRequest,
    ShortestPathResponse,
)

router = APIRouter(prefix="/api", tags=["OpenTrail API"])

@router.get("/health", response_model=HealthResponse)
def get_health():
    """Health status and basic dependency readiness check."""
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        python_executable=settings.PYTHON_EXECUTABLE,
        graphify_available=True,
        ai_available=ai_orchestrator.is_available(),
        ai_model=settings.GEMMA_MODEL,
    )

@router.post("/repositories", response_model=JobStatusResponse)
def submit_repository(req: RepositorySubmitRequest):
    """
    Validates a public GitHub repository URL and initiates asynchronous graph extraction.
    """
    try:
        job = job_manager.create_repository_job(req.url)
        return job
    except SecurityValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit repository: {e}")

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    """Retrieves current job status, stage, and safe progress indicator."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job

@router.get("/repositories/{repository_id}/graph", response_model=RepositoryGraph)
def get_repository_graph(repository_id: str):
    """Retrieves normalized AST graph for an analyzed repository."""
    graph = job_manager.get_graph(repository_id.lower())
    if not graph:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{repository_id}' has not been analyzed or is no longer in memory.",
        )
    return graph

@router.get("/repositories/{repository_id}/god-nodes", response_model=List[HubNode])
def get_god_nodes(repository_id: str):
    """Retrieves architectural hub nodes with high connectivity degrees."""
    graph = job_manager.get_graph(repository_id.lower())
    if not graph:
        raise HTTPException(status_code=404, detail=f"Repository '{repository_id}' not found.")
    return graph.hub_nodes

@router.get("/repositories/{repository_id}/path", response_model=ShortestPathResponse)
def get_shortest_path(
    repository_id: str,
    source: str = Query(..., description="Source node ID"),
    target: str = Query(..., description="Target node ID"),
):
    """Finds the shortest verified relationship path between two symbols."""
    graph = job_manager.get_graph(repository_id.lower())
    if not graph:
        raise HTTPException(status_code=404, detail=f"Repository '{repository_id}' not found.")
    
    query_engine = job_manager.get_query_engine(repository_id.lower())
    if not query_engine:
        raise HTTPException(status_code=404, detail="Query engine not initialized.")

    # Search BFS in memory for quickest response
    queue = [[source]]
    visited = {source}
    found_path = None
    
    while queue:
        path = queue.pop(0)
        curr = path[-1]
        if curr == target:
            found_path = path
            break
        for edge in query_engine.outgoing.get(curr, []):
            if edge.target not in visited and edge.target in query_engine.node_map:
                visited.add(edge.target)
                queue.append(path + [edge.target])

    if found_path:
        labels = [query_engine.node_map[nid].label for nid in found_path if nid in query_engine.node_map]
        explanation = " -> ".join(labels)
        return ShortestPathResponse(
            source=source,
            target=target,
            hops=len(found_path) - 1,
            path_nodes=found_path,
            path_edges=[],
            formatted_explanation=f"Path ({len(found_path) - 1} hops): {explanation}",
        )
    else:
        return ShortestPathResponse(
            source=source,
            target=target,
            hops=0,
            path_nodes=[],
            path_edges=[],
            formatted_explanation=f"No confirmed path could be established between '{source}' and '{target}'.",
        )

@router.get("/repositories/{repository_id}/affected", response_model=List[str])
def get_affected_nodes(
    repository_id: str,
    node_id: str = Query(..., description="Node ID to check impact for"),
):
    """Finds components impacted downstream by changes to this symbol."""
    query_engine = job_manager.get_query_engine(repository_id.lower())
    if not query_engine:
        raise HTTPException(status_code=404, detail=f"Repository '{repository_id}' not found.")
    
    neighbors = query_engine.get_neighbors(node_id)
    impacted = [n.id for n in neighbors["incoming"]]
    return impacted

@router.post("/repositories/{repository_id}/investigations", response_model=InvestigationResponse)
def create_investigation(repository_id: str, req: IssueInvestigationRequest):
    """
    Initiates an AI-assisted issue investigation grounded in the repository's AST graph.
    """
    graph = job_manager.get_graph(repository_id.lower())
    if not graph:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{repository_id}' not found. Please analyze the repository first.",
        )
        
    query_engine = job_manager.get_query_engine(repository_id.lower())
    if not query_engine:
        raise HTTPException(status_code=500, detail="Query engine not available.")

    investigation_id = f"inv_{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc).isoformat()
    
    try:
        recommendations = ai_orchestrator.investigate_issue(
            graph=graph,
            query_engine=query_engine,
            issue_text=req.issue_text,
            issue_url=req.issue_url,
        )
        resp = InvestigationResponse(
            investigation_id=investigation_id,
            repository_id=repository_id,
            status="completed",
            recommendations=recommendations,
            error=None,
            created_at=now,
        )
        job_manager.store_investigation(resp)
        return resp
    except Exception as e:
        resp = InvestigationResponse(
            investigation_id=investigation_id,
            repository_id=repository_id,
            status="failed",
            recommendations=None,
            error=f"Investigation failed: {str(e)[:200]}",
            created_at=now,
        )
        job_manager.store_investigation(resp)
        return resp

@router.get("/investigations/{investigation_id}", response_model=InvestigationResponse)
def get_investigation(investigation_id: str):
    """Retrieves a previously computed investigation."""
    inv = job_manager.get_investigation(investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Investigation '{investigation_id}' not found.")
    return inv
