import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.app.config import settings
from backend.app.core.ai_orchestrator import ai_orchestrator, sanitize_error_message
from backend.app.core.graphify_adapter import GraphifyAdapter
from backend.app.core.job_manager import job_manager
from backend.app.core.security import SecurityValidationError
from backend.app.models.schemas import (
    ExecutionTrailResponse,
    FirstContributionPlan,
    HealthResponse,
    HubNode,
    ImpactSimulationResponse,
    InvestigationResponse,
    IssueInvestigationRequest,
    JobStatusResponse,
    RepositoryGraph,
    RepositorySubmitRequest,
    ShortestPathResponse,
    TestMapResponse,
    WhyThisFileResponse,
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

@router.get("/ai/verify")
def verify_ai_model():
    """
    Verifies that the configured Gemma/Gemini model is accessible with the configured API key.
    Never exposes secret values or credentials.
    """
    if not ai_orchestrator.is_available():
        return {
            "configured": False,
            "accessible": False,
            "model": settings.GEMMA_MODEL,
            "message": "GEMINI_API_KEY is not configured.",
        }
    accessible, msg = ai_orchestrator.verify_model_accessibility()
    return {
        "configured": True,
        "accessible": accessible,
        "model": settings.GEMMA_MODEL,
        "message": msg,
    }


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

@router.get("/repositories/{repository_id}/impact", response_model=ImpactSimulationResponse)
def simulate_change_impact(
    repository_id: str,
    node_id: str = Query(..., description="Target node ID to simulate modifying"),
    depth: int = Query(2, ge=1, le=3, description="Maximum traversal depth (1=direct, 2-3=transitive)"),
):
    """
    Simulates bounded change impact from verified AST graph edges.
    Traces incoming callers/consumers and connects affected nodes to candidate regression tests.
    """
    query_engine = job_manager.get_query_engine(repository_id.lower())
    if not query_engine:
        raise HTTPException(status_code=404, detail=f"Repository '{repository_id}' not found.")
    
    try:
        return query_engine.simulate_change_impact(node_id, max_depth=depth)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impact simulation error: {e}")

@router.get("/repositories/{repository_id}/tests", response_model=TestMapResponse)
def get_smart_test_map(
    repository_id: str,
    target: Optional[str] = Query(None, description="Optional target symbol or node ID to filter tests for"),
):
    """
    Discovers verified test nodes in the repository and ranks their relevance with evidence paths.
    """
    query_engine = job_manager.get_query_engine(repository_id.lower())
    if not query_engine:
        raise HTTPException(status_code=404, detail=f"Repository '{repository_id}' not found.")
    
    target_symbols = [target.strip()] if target and target.strip() else None
    return query_engine.get_smart_test_map(target_symbols=target_symbols)

@router.get("/repositories/{repository_id}/trail", response_model=ExecutionTrailResponse)
def get_execution_trail(
    repository_id: str,
    start: str = Query(..., description="Start node ID for the execution trail"),
    end: Optional[str] = Query(None, description="Optional destination node ID"),
    steps: int = Query(6, ge=2, le=10, description="Maximum number of steps"),
):
    """
    Constructs an interactive step-by-step static dependency trail across verified graph edges.
    """
    query_engine = job_manager.get_query_engine(repository_id.lower())
    if not query_engine:
        raise HTTPException(status_code=404, detail=f"Repository '{repository_id}' not found.")
    
    try:
        return query_engine.build_execution_trail(start, end_node_id=end, max_steps=steps)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution trail error: {e}")

@router.get("/repositories/{repository_id}/why-file", response_model=WhyThisFileResponse)
def explain_why_this_file(
    repository_id: str,
    file_path: str = Query(..., description="Repository-relative file path to explain"),
    issue_text: Optional[str] = Query(None, description="Optional issue description"),
):
    """
    Explains why a file is recommended using matched terms, verified AST symbols, and graph relationships.
    """
    query_engine = job_manager.get_query_engine(repository_id.lower())
    if not query_engine:
        raise HTTPException(status_code=404, detail=f"Repository '{repository_id}' not found.")
    
    return query_engine.explain_why_this_file(file_path=file_path, issue_text=issue_text)

@router.post("/repositories/{repository_id}/first-contribution", response_model=FirstContributionPlan)
def generate_first_contribution_plan(
    repository_id: str,
    req: IssueInvestigationRequest,
):
    """
    Converts a bug description or public issue into a guided first-contribution onboarding plan.
    Prioritizes files, explains component roles in beginner-friendly language, and suggests existing tests.
    """
    graph = job_manager.get_graph(repository_id.lower())
    if not graph:
        raise HTTPException(status_code=404, detail=f"Repository '{repository_id}' not found.")
        
    query_engine = job_manager.get_query_engine(repository_id.lower())
    if not query_engine:
        raise HTTPException(status_code=500, detail="Query engine not available.")

    # 1. Run investigation to identify core verified components
    rec = ai_orchestrator.investigate_issue(
        graph=graph,
        query_engine=query_engine,
        issue_text=req.issue_text,
        issue_url=req.issue_url,
        allow_fallback=True,
    )

    # 2. Extract unique files and build "Why this file?" for each
    unique_files = []
    seen_files = set()
    for comp in rec.relevant_components:
        if comp.file_path and comp.file_path not in seen_files:
            seen_files.add(comp.file_path)
            unique_files.append(comp.file_path)

    relevant_node_ids = [c.node_id for c in rec.relevant_components]
    file_explanations: List[WhyThisFileResponse] = [
        query_engine.explain_why_this_file(fp, issue_text=req.issue_text, relevant_node_ids=relevant_node_ids)
        for fp in unique_files[:5]
    ]

    # 3. Discovered test suites
    target_labels = [c.label for c in rec.relevant_components[:3]]
    test_map = query_engine.get_smart_test_map(target_symbols=target_labels)

    # 4. Generate structured contribution guide
    guide_steps = [
        f"1. Start by inspecting {unique_files[0] if unique_files else 'the target file'} where the core entry point is defined.",
        "2. Review the verified AST symbols and their caller/callee relationships highlighted on the interactive canvas.",
        f"3. Run the targeted existing regression tests: {', '.join(t.test_name for t in test_map.existing_tests[:2]) if test_map.existing_tests else 'local unit test suite'}.",
        "4. Follow the bounded impact simulation to ensure modifications do not break downstream consumers.",
        "5. Write a regression test for the specific bug case before submitting a pull request.",
    ]

    return FirstContributionPlan(
        issue_title=req.issue_text[:80] + ("..." if len(req.issue_text) > 80 else ""),
        overview=rec.reasoning_summary or "Grounded first contribution onboarding plan based on repository code relationships.",
        reading_order_files=file_explanations,
        key_components=rec.relevant_components[:6],
        recommended_existing_tests=test_map.existing_tests[:4],
        proposed_tests=rec.suggested_tests[:3],
        step_by_step_guide=guide_steps,
    )


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
        safe_error = sanitize_error_message(str(e), ai_orchestrator.api_key)
        resp = InvestigationResponse(
            investigation_id=investigation_id,
            repository_id=repository_id,
            status="failed",
            recommendations=None,
            error=f"Investigation failed: {safe_error[:300]}",
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
