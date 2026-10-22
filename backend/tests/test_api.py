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
    assert inv_data["status"] == "completed"
    assert inv_data["recommendations"] is not None
    assert len(inv_data["recommendations"]["relevant_components"]) > 0
