import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_api_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["graphify_available"] is True

def test_submit_invalid_repository_url(client):
    res = client.post("/api/repositories", json={"url": "https://evil.com/malicious/repo"})
    assert res.status_code == 400
    assert "Only public repositories on 'github.com' are supported" in res.json()["detail"]

def test_get_fixture_sample_graph(client):
    # 'opentrail_sample' is pre-registered in app lifespan
    res = client.get("/api/repositories/opentrail_sample/graph")
    assert res.status_code == 200
    data = res.json()
    assert data["repository_id"] == "opentrail_sample"
    assert data["statistics"]["total_nodes"] > 0
    assert len(data["nodes"]) > 0
    assert len(data["edges"]) > 0

def test_get_god_nodes(client):
    res = client.get("/api/repositories/opentrail_sample/god-nodes")
    assert res.status_code == 200
    gods = res.json()
    assert len(gods) > 0

def test_get_shortest_path(client):
    res = client.get("/api/repositories/opentrail_sample/path?source=main_main&target=processor_calculate_metrics")
    assert res.status_code == 200
    path_data = res.json()
    assert path_data["hops"] >= 1
    assert "main_main" in path_data["path_nodes"]

def test_create_investigation_endpoint(client):
    res = client.post(
        "/api/repositories/opentrail_sample/investigations",
        json={"issue_text": "MetricProcessor fails to compute correct len and sum in processor.py"},
    )
    assert res.status_code == 200
    inv_data = res.json()
    assert inv_data["status"] in ("completed", "failed")
    if inv_data["status"] == "completed":
        assert inv_data["recommendations"] is not None
        assert len(inv_data["recommendations"]["relevant_components"]) > 0
    else:
        assert inv_data["error"] is not None

def test_simulate_change_impact_endpoint(client):
    res = client.get("/api/repositories/opentrail_sample/impact?node_id=processor_calculate_metrics&depth=2")
    assert res.status_code == 200
    data = res.json()
    assert data["target_node_id"] == "processor_calculate_metrics"
    assert data["max_depth"] == 2
    assert "summary_caveats" in data
    # main_main calls processor_calculate_metrics, so it should be in impacted nodes
    impacted_ids = [n["node_id"] for n in data["impacted_nodes"]]
    assert "main_main" in impacted_ids

def test_get_smart_test_map_endpoint(client):
    res = client.get("/api/repositories/opentrail_sample/tests?target=calculate_metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["repository_id"] == "opentrail_sample"
    assert len(data["existing_tests"]) > 0
    # Every existing test must be marked as verified
    for t in data["existing_tests"]:
        assert t["state"] == "Existing test — verified"
        assert t["relevance_score"] > 0

def test_get_execution_trail_endpoint(client):
    res = client.get("/api/repositories/opentrail_sample/trail?start=main_main&steps=4")
    assert res.status_code == 200
    data = res.json()
    assert len(data["steps"]) >= 2
    assert data["steps"][0]["node_id"] == "main_main"
    assert data["total_hops"] >= 1

def test_explain_why_this_file_endpoint(client):
    res = client.get("/api/repositories/opentrail_sample/why-file?file_path=processor.py&issue_text=MetricProcessor")
    assert res.status_code == 200
    data = res.json()
    assert data["file_path"] == "processor.py"
    assert data["match_type"] in ("direct", "transitive", "inferred")
    assert len(data["verified_symbols"]) > 0

def test_first_contribution_plan_endpoint(client):
    res = client.post(
        "/api/repositories/opentrail_sample/first-contribution",
        json={"issue_text": "Need help understanding how MetricProcessor is used and how to add a test"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "issue_title" in data
    assert len(data["reading_order_files"]) > 0
    assert len(data["key_components"]) > 0
    assert len(data["step_by_step_guide"]) >= 3

