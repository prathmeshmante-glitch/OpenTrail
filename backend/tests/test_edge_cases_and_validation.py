import pytest
from fastapi.testclient import TestClient

from backend.app.core.graph_query import GraphQueryEngine
from backend.app.core.security import (
    SecurityValidationError,
    is_safe_path,
    validate_and_canonicalize_github_url,
)
from backend.app.main import app
from backend.app.models.schemas import (
    GraphEdge,
    GraphNode,
    RepositoryStatistics,
    RepositoryGraph,
)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# ============================================================================
# Security & URL Canonicalization Edge Case Tests
# ============================================================================


def test_url_validation_rejections():
    """Verify strict rejection of invalid schemas, spoofed hosts, and SSRF attempts."""
    invalid_cases = [
        "",
        "   ",
        "not-a-url",
        "ftp://github.com/owner/repo",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "http://github.com/owner/repo",
        "https://github.com.attacker.com/owner/repo",
        "https://notgithub.com/owner/repo",
        "https://127.0.0.1/owner/repo",
        "https://localhost/owner/repo",
        "https://[::1]/owner/repo",
        "https://169.254.169.254/latest/meta-data",
        "https://github.com:8443/owner/repo",
        "https://user:password@github.com/owner/repo",
        "https://github.com/owner/../repo",
        "https://github.com/owner",
        "https://github.com/owner/repo/extra/path",
        "https://github.com/" + "a" * 300,
    ]
    for case in invalid_cases:
        with pytest.raises(SecurityValidationError):
            validate_and_canonicalize_github_url(case)


def test_url_validation_valid_canonicalization():
    """Verify standard and edge-case valid URLs canonicalize identically."""
    cases = [
        (
            "https://github.com/pallets/flask",
            "https://github.com/pallets/flask",
            "pallets",
            "flask",
        ),
        (
            "https://github.com/pallets/flask.git",
            "https://github.com/pallets/flask",
            "pallets",
            "flask",
        ),
        (
            "https://github.com/pallets/flask/",
            "https://github.com/pallets/flask",
            "pallets",
            "flask",
        ),
        (
            "  https://github.com/pallets/flask.git/  ",
            "https://github.com/pallets/flask",
            "pallets",
            "flask",
        ),
    ]
    for raw, expected_url, expected_owner, expected_repo in cases:
        canonical, owner, repo = validate_and_canonicalize_github_url(raw)
        assert canonical == expected_url
        assert owner == expected_owner
        assert repo == expected_repo


def test_is_safe_path_boundaries():
    """Verify directory traversal and malicious relative path rejection."""
    base = r"C:\workspace\OpenTrail"
    assert is_safe_path(base, "src/components/GraphCanvas.tsx") is True
    assert is_safe_path(base, "backend/app/main.py") is True
    assert is_safe_path(base, "../../../windows/system32") is False
    assert is_safe_path(base, "src/../../outside") is False


# ============================================================================
# Graph Query Engine Edge Case Tests
# ============================================================================


def test_graph_query_empty_and_missing_lookups():
    """Verify GraphQueryEngine handles missing and disconnected components gracefully."""
    empty_graph = RepositoryGraph(
        repository_id="empty_test",
        owner="test_owner",
        name="empty_test",
        graph_version="1.0",
        nodes=[],
        edges=[],
        statistics=RepositoryStatistics(
            total_nodes=0, total_edges=0, total_files=0, total_communities=0, god_nodes_count=0
        ),
        generated_at="2026-10-22T00:00:00Z",
    )
    engine = GraphQueryEngine(empty_graph)

    # Empty search query
    assert engine.search_nodes("") == []
    assert engine.search_nodes("   ") == []

    # Nonexistent node
    assert engine.get_node("missing_id") is None
    assert engine.get_neighbors("missing_id") == {
        "incoming": [],
        "outgoing": [],
    }
    assert engine.has_edge("a", "b") is None

    # Invalid source snippet requests
    assert engine.get_source_snippet("nonexistent.py", 0) is None
    assert engine.get_source_snippet("nonexistent.py", -5) is None
    assert engine.get_source_snippet("", 10) is None


def test_graph_query_disconnected_nodes():
    """Verify handling of disconnected nodes without edges."""
    node1 = GraphNode(
        id="node_a",
        label="func_a",
        symbol_name="func_a",
        kind="function",
        file_path="mod_a.py",
        line_start=1,
    )
    node2 = GraphNode(
        id="node_b",
        label="func_b",
        symbol_name="func_b",
        kind="function",
        file_path="mod_b.py",
        line_start=1,
    )
    graph = RepositoryGraph(
        repository_id="disconnected_test",
        owner="test_owner",
        name="disconnected_test",
        graph_version="1.0",
        nodes=[node1, node2],
        edges=[],
        statistics=RepositoryStatistics(
            total_nodes=2, total_edges=0, total_files=2, total_communities=1, god_nodes_count=0
        ),
        generated_at="2026-10-22T00:00:00Z",
    )
    engine = GraphQueryEngine(graph)

    assert engine.has_edge("node_a", "node_b") is None
    neighbors_a = engine.get_neighbors("node_a")
    assert len(neighbors_a["incoming"]) == 0
    assert len(neighbors_a["outgoing"]) == 0


# ============================================================================
# API Endpoint Validation & Error Response Tests
# ============================================================================


def test_api_nonexistent_repository(client):
    """Verify 404 response when querying an unknown repository."""
    res = client.get("/api/repositories/nonexistent_repo_id/graph")
    assert res.status_code == 404
    detail = res.json()["detail"].lower()
    assert "not been analyzed" in detail or "not found" in detail


def test_api_shortest_path_same_node(client):
    """Verify shortest path when source equals target."""
    res = client.get(
        "/api/repositories/opentrail_sample/path?source=main_main&target=main_main"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["hops"] == 0
    assert data["path_nodes"] == ["main_main"]


def test_api_shortest_path_disconnected(client):
    """Verify shortest path between disconnected nodes returns 0 hops with clear explanation."""
    res = client.get(
        "/api/repositories/opentrail_sample/path?source=test_processor_test_calculate_metrics&target=main_main"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["hops"] == 0
    assert data["path_nodes"] == []
    assert "No confirmed path" in data["formatted_explanation"]


def test_api_invalid_impact_depth(client):
    """Verify FastAPI query validation rejects invalid depth."""
    res = client.get(
        "/api/repositories/opentrail_sample/impact?node_id=main_main&depth=99"
    )
    assert res.status_code == 422  # Unprocessable Entity
