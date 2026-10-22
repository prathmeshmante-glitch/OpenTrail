import pytest
from backend.app.core.ai_orchestrator import AIOrchestrator
from backend.app.core.graph_query import GraphQueryEngine
from backend.app.core.graphify_adapter import GraphifyAdapter

def test_ai_bounded_context_construction(fixture_repo_dir):
    adapter = GraphifyAdapter()
    graph = adapter.parse_graph(
        repo_dir=fixture_repo_dir,
        repository_id="test_sample",
        owner="test",
        name="sample",
    )
    query_engine = GraphQueryEngine(graph)
    
    context = query_engine.build_bounded_context("MetricProcessor fails when processing metrics")
    assert len(context["candidate_nodes"]) > 0
    candidate_labels = [n.label for n in context["candidate_nodes"]]
    assert any("MetricProcessor" in l or "metrics" in l for l in candidate_labels)

def test_deterministic_investigation_grounding(fixture_repo_dir):
    adapter = GraphifyAdapter()
    graph = adapter.parse_graph(
        repo_dir=fixture_repo_dir,
        repository_id="test_sample",
        owner="test",
        name="sample",
    )
    query_engine = GraphQueryEngine(graph)
    orchestrator = AIOrchestrator()
    
    # Test offline / deterministic grounding
    rec = orchestrator.investigate_issue(
        graph=graph,
        query_engine=query_engine,
        issue_text="calculate_metrics returns incorrect sum",
    )
    
    assert rec.issue_summary
    assert len(rec.relevant_components) > 0
    
    # Every verified component must correspond to a real graph node
    all_graph_node_ids = set(n.id for n in graph.nodes)
    for comp in rec.relevant_components:
        if comp.is_verified:
            assert comp.node_id in all_graph_node_ids
            
    assert len(rec.suggested_tests) > 0
    assert len(rec.investigation_steps) > 0
