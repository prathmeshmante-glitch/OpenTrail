import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.job_manager import job_manager

REPO_ID = "dev-pratham07_blindnav"

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_blindnav_graph_metrics_and_file_consistency():
    graph = job_manager.get_graph(REPO_ID)
    assert graph is not None, f"Repository '{REPO_ID}' must be cached in .storage."
    
    assert graph.statistics.total_nodes == 191
    assert graph.statistics.total_edges == 289
    assert graph.statistics.total_files == 19
    assert graph.statistics.total_communities == 18
    
    # Verify Problem B fix: file node count matches total_files exactly
    file_nodes = [n for n in graph.nodes if n.kind == "file"]
    assert len(file_nodes) == 19, f"Expected 19 file nodes, got {len(file_nodes)}"
    
    # Verify kinds are populated cleanly
    kinds = set(n.kind for n in graph.nodes)
    assert "file" in kinds
    assert "class" in kinds
    assert "function" in kinds
    assert "module" in kinds

def test_workflow_one_change_impact_simulator(client):
    graph = job_manager.get_graph(REPO_ID)
    # Pick a hub node or class node with high connectivity
    target_node = graph.hub_nodes[0] if graph.hub_nodes else graph.nodes[0]
    
    res = client.get(f"/api/repositories/{REPO_ID}/impact?node_id={target_node.id}&depth=2")
    assert res.status_code == 200, f"Impact simulator failed: {res.text}"
    data = res.json()
    
    assert data["target_node_id"] == target_node.id
    assert "affected_paths" in data
    assert isinstance(data["affected_paths"], list)
    assert "impacted_nodes" in data
    assert isinstance(data["impacted_nodes"], list)
    assert "candidate_tests" in data
    assert isinstance(data["candidate_tests"], list)
    assert data["depth"] == 2
    
    for n in data["impacted_nodes"]:
        assert "is_direct" in n
        assert "distance" in n
        assert "path_from_target" in n
        assert n["node_id"] != target_node.id

def test_workflow_two_smart_regression_test_map(client):
    res = client.get(f"/api/repositories/{REPO_ID}/test-map")
    assert res.status_code == 200, f"Test map failed: {res.text}"
    data = res.json()
    
    assert "tests" in data
    assert "total_discovered" in data
    assert "verified_existing_count" in data
    assert isinstance(data["tests"], list)
    
    # BlindNav contains tests (e.g. ExampleUnitTest.kt)
    for t in data["tests"]:
        # Verify dual keys for frontend safety
        assert "name" in t or "test_name" in t
        assert "file_path" in t or "test_file" in t
        assert "node_id" in t or "test_node_id" in t
        assert "relevance_reason" in t
        assert "state" in t
        assert t["state"].startswith("Existing test") or t["state"].startswith("Proposed")

def test_workflow_three_interactive_execution_trail(client):
    graph = job_manager.get_graph(REPO_ID)
    # Pick a node with outgoing connections
    connected_node = next((n for n in graph.nodes if n.degree > 1), graph.nodes[0])
    
    res = client.get(f"/api/repositories/{REPO_ID}/trail?start_node_id={connected_node.id}&max_hops=5")
    assert res.status_code == 200, f"Execution trail failed: {res.text}"
    data = res.json()
    
    assert "trail_path" in data
    assert isinstance(data["trail_path"], list)
    assert len(data["trail_path"]) >= 1
    assert data["trail_path"][0] == connected_node.id
    
    assert "steps" in data
    assert isinstance(data["steps"], list)
    assert len(data["steps"]) == len(data["trail_path"])
    
    for idx, step in enumerate(data["steps"]):
        assert step["step_number"] == idx + 1
        assert "node_id" in step
        assert "label" in step
        assert "file_path" in step
        assert "provenance" in step
        assert "is_structurally_extracted" in step

def test_workflow_four_why_this_file(client):
    graph = job_manager.get_graph(REPO_ID)
    file_node = next(n for n in graph.nodes if n.kind == "file")
    
    res = client.get(f"/api/repositories/{REPO_ID}/why-this-file?file_path={file_node.file_path}")
    assert res.status_code == 200, f"Why this file failed: {res.text}"
    data = res.json()
    
    assert data["file_path"] == file_node.file_path
    assert "summary" in data
    assert "relevance" in data
    assert "matched_terms" in data
    assert isinstance(data["matched_terms"], list)
    assert "source_locations" in data
    assert isinstance(data["source_locations"], list)
    assert "missing_evidence" in data
    assert isinstance(data["missing_evidence"], list)

def test_workflow_five_first_contribution_mode(client):
    res = client.post(
        f"/api/repositories/{REPO_ID}/first-contribution",
        json={"issue_text": "Need to understand navigation features and blind assistance routing"},
    )
    assert res.status_code == 200, f"First contribution failed: {res.text}"
    data = res.json()
    
    assert data["repository_id"] == REPO_ID
    assert "beginner_summary" in data
    assert "reading_order_files" in data
    assert isinstance(data["reading_order_files"], list)
    assert len(data["reading_order_files"]) > 0
    
    assert "key_components" in data
    assert isinstance(data["key_components"], dict)
    
    assert "step_by_step_guide" in data
    assert isinstance(data["step_by_step_guide"], list)
    assert len(data["step_by_step_guide"]) > 0
    
    for s in data["step_by_step_guide"]:
        assert "step_number" in s
        assert "title" in s
        assert "description" in s
        assert "recommended_file" in s
        
    assert "suggested_tests" in data
    assert isinstance(data["suggested_tests"], list)
    assert "cautionary_notes" in data
    assert isinstance(data["cautionary_notes"], list)
