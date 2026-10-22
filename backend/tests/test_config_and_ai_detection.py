import os
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.app.config import find_env_file, load_environment, settings
from backend.app.core.ai_orchestrator import AIOrchestrator, AIServiceError, sanitize_error_message
from backend.app.core.graph_query import GraphQueryEngine
from backend.app.core.graphify_adapter import GraphifyAdapter
from backend.app.main import app

@pytest.fixture
def test_client():
    with TestClient(app) as c:
        yield c

def test_env_file_resolution_from_project_root_and_backend():
    """Verify that find_env_file() locates .env regardless of working directory."""
    project_root = Path(__file__).resolve().parent.parent.parent
    root_env = project_root / ".env"
    
    # 1. Standard resolution
    resolved = find_env_file()
    assert resolved is not None
    assert resolved.samefile(root_env)

    # 2. Simulate running from backend/ subdirectory
    backend_dir = project_root / "backend"
    original_cwd = Path.cwd()
    try:
        os.chdir(backend_dir)
        backend_resolved = find_env_file()
        assert backend_resolved is not None
        assert backend_resolved.samefile(root_env)
    finally:
        os.chdir(original_cwd)

def test_api_key_detected_without_exposing_to_frontend(test_client, monkeypatch):
    """
    Proves that a configured GEMINI_API_KEY is detected (ai_available=True)
    and that the raw secret key is never leaked to frontend endpoints.
    """
    secret_key = "AIzaSyFakeSecretKeyForTestingDetectionOnly99"
    monkeypatch.setenv("GEMINI_API_KEY", secret_key)
    settings.reload()

    orchestrator = AIOrchestrator()
    assert orchestrator.is_available() is True

    # 1. Test /api/health
    res = test_client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["ai_available"] is True
    assert data["ai_model"] == settings.GEMMA_MODEL
    # Crucial security assertion: Secret key MUST NOT be present in response text or json
    assert secret_key not in res.text
    assert "GEMINI_API_KEY" not in data

    # 2. Test /api/ai/verify endpoint does not leak secret key
    with patch("backend.app.core.ai_orchestrator.AIOrchestrator.verify_model_accessibility") as mock_verify:
        mock_verify.return_value = (True, "Model is accessible and responsive.")
        verify_res = test_client.get("/api/ai/verify")
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        assert verify_data["configured"] is True
        assert verify_data["accessible"] is True
        assert secret_key not in verify_res.text

def test_ai_error_reported_clearly_no_silent_fallback(fixture_repo_dir):
    """
    Verifies that when GEMINI_API_KEY is configured, API errors are reported
    clearly via AIServiceError rather than silently falling back to deterministic mode.
    """
    adapter = GraphifyAdapter()
    graph = adapter.parse_graph(
        repo_dir=fixture_repo_dir,
        repository_id="test_sample",
        owner="test",
        name="sample",
    )
    query_engine = GraphQueryEngine(graph)

    # Configure a dummy key to simulate an active AI setup
    secret_key = "AIzaSyTestErrorKey12345"
    orchestrator = AIOrchestrator(api_key=secret_key)
    assert orchestrator.is_available() is True

    # Mock the Google GenAI client to simulate an API failure (e.g. 404 NOT_FOUND or quota)
    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.models.generate_content.side_effect = RuntimeError(
            f"API quota exceeded for key={secret_key}. Call failed."
        )

        with pytest.raises(AIServiceError) as exc_info:
            orchestrator.investigate_issue(
                graph=graph,
                query_engine=query_engine,
                issue_text="MetricProcessor calculation fails",
                allow_fallback=False,
            )

        err_msg = str(exc_info.value)
        # Verify the error is clearly reported
        assert "API quota exceeded" in err_msg
        # Verify secret key was sanitized
        assert secret_key not in err_msg
        assert "[REDACTED" in err_msg or "key=[REDACTED]" in err_msg

def test_api_investigation_endpoint_reports_error_clearly(test_client, monkeypatch):
    """
    Verifies that the /api/repositories/{id}/investigations endpoint returns status='failed'
    with a clear, sanitized error when an API error occurs, rather than masking it.
    """
    secret_key = "AIzaSySecretTestingApiKey999"
    monkeypatch.setenv("GEMINI_API_KEY", secret_key)
    settings.reload()

    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.models.generate_content.side_effect = RuntimeError(
            f"Model gemma-4-26b-a4b-it was not found or unavailable. Key={secret_key}"
        )

        res = test_client.post(
            "/api/repositories/opentrail_sample/investigations",
            json={"issue_text": "MetricProcessor fails to process values"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "failed"
        assert data["recommendations"] is None
        assert data["error"] is not None
        assert "not found or unavailable" in data["error"]
        # Secret key MUST be sanitized
        assert secret_key not in data["error"]
        assert secret_key not in res.text

def test_offline_mode_deterministic_when_no_key(fixture_repo_dir):
    """
    When GEMINI_API_KEY is not configured, the orchestrator should gracefully
    generate deterministic graph-grounded recommendations.
    """
    adapter = GraphifyAdapter()
    graph = adapter.parse_graph(
        repo_dir=fixture_repo_dir,
        repository_id="test_sample",
        owner="test",
        name="sample",
    )
    query_engine = GraphQueryEngine(graph)

    # Empty key simulates unconfigured state
    orchestrator = AIOrchestrator(api_key="")
    assert orchestrator.is_available() is False

    rec = orchestrator.investigate_issue(
        graph=graph,
        query_engine=query_engine,
        issue_text="calculate_metrics returns incorrect sum",
    )
    assert rec.issue_summary
    assert len(rec.relevant_components) > 0
    assert "GEMINI_API_KEY not configured" in rec.reasoning_summary

def test_sanitize_error_message():
    """Verify that sanitize_error_message removes keys and sensitive patterns."""
    raw_key = "AIzaSyC1234567890abcdefghijklmnopqrstuv"
    msg = f"Failed to authenticate with key {raw_key} at https://generativelanguage.googleapis.com?key={raw_key}"
    cleaned = sanitize_error_message(msg, secret_key=raw_key)
    assert raw_key not in cleaned
    assert "[REDACTED" in cleaned
