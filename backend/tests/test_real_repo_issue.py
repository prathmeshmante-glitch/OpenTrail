import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.job_manager import job_manager


def test_real_bottle_investigation():
    repo_id = "bottlepy_bottle"
    issue_text = "Route decorator fails to bind handler in Bottle application and Route dispatching"

    # Ensure repository is available via job_manager auto-rehydration
    graph = job_manager.get_graph(repo_id)
    assert graph is not None, f"Repository graph for '{repo_id}' should be available on disk."

    with TestClient(app) as client:
        res = client.post(
            f"/api/repositories/{repo_id}/investigations",
            json={"issue_text": issue_text},
        )
        assert res.status_code == 200, f"Expected 200 OK, got: {res.text}"
        data = res.json()
        if data["status"] == "failed":
            error_msg = data.get("error", "")
            if "DEADLINE_EXCEEDED" in error_msg or "AI Service Error" in error_msg or "404" in error_msg or "UNAVAILABLE" in error_msg or "INTERNAL" in error_msg:
                pytest.skip(f"External AI provider is unreachable or returned quota/demand error: {error_msg}")
        assert data["status"] == "completed", f"Investigation failed: {data.get('error')}"

        rec = data["recommendations"]
        assert rec is not None
        assert rec["issue_summary"]
        assert len(rec["relevant_components"]) > 0

        # Verify every component marked verified maps to a real graph node with line numbers
        graph_node_ids = set(n.id for n in graph.nodes)
        for comp in rec["relevant_components"]:
            if comp["is_verified"]:
                assert comp["node_id"] in graph_node_ids, f"Verified node {comp['node_id']} not in graph!"
                assert comp["file_path"].endswith(".py")
                # Line number should be populated where available
                if comp["line_start"] is not None:
                    assert isinstance(comp["line_start"], int)
                    assert comp["line_start"] > 0

        # Verify confirmed relationships distinguish AST edges from model inference
        for rel in rec["confirmed_relationships"]:
            assert rel.startswith("[Verified AST Edge]") or rel.startswith(
                "[Model Inferred Relationship]"
            ), f"Relationship missing evidence classification: {rel}"

        # Verify suggested tests distinguish existing tests from proposed new tests
        for test_item in rec["suggested_tests"]:
            assert test_item.startswith("[Existing Test]") or test_item.startswith(
                "[Proposed New Test]"
            ), f"Test missing existence classification: {test_item}"
            # Never concatenate node names as test identifiers
            assert not any(f"test_{a.id}_{b.id}" in test_item for a in graph.nodes[:10] for b in graph.nodes[:10])


if __name__ == "__main__":
    test_real_bottle_investigation()
