import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.job_manager import job_manager

def test_real_repo():
    repo_id = "bottlepy_bottle"
    graph = job_manager.get_graph(repo_id)
    assert graph is not None, f"Repository graph for '{repo_id}' should be loaded or cached."

    with TestClient(app) as client:
        res = client.get(f"/api/repositories/{repo_id}/graph")
        assert res.status_code == 200
        data = res.json()
        assert data["owner"] == "bottlepy"
        assert data["name"] == "bottle"
        assert data["statistics"]["total_nodes"] > 500
        assert data["statistics"]["total_edges"] > 500
        assert len(data["hub_nodes"]) > 0

if __name__ == "__main__":
    test_real_repo()
