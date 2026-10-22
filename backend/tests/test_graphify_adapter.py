import os
import pytest
from backend.app.core.graphify_adapter import GraphifyAdapter

def test_parse_real_graphify_fixture(fixture_repo_dir):
    adapter = GraphifyAdapter()
    graph = adapter.parse_graph(
        repo_dir=fixture_repo_dir,
        repository_id="test_sample",
        owner="test",
        name="sample",
    )
    
    assert graph.repository_id == "test_sample"
    assert graph.owner == "test"
    assert graph.name == "sample"
    assert graph.statistics.total_nodes > 0
    assert graph.statistics.total_edges > 0
    assert graph.statistics.total_files == 2  # processor.py and main.py
    
    # Check node categories
    kinds = set(n.kind for n in graph.nodes)
    assert "class" in kinds or "function" in kinds
    
    # Check specific symbol MetricProcessor
    metric_proc = next((n for n in graph.nodes if "MetricProcessor" in n.label), None)
    assert metric_proc is not None
    assert metric_proc.kind == "class"
    assert metric_proc.file_path == "processor.py"
    assert metric_proc.line_start == 4

    # Check edges
    edge_types = set(e.relationship_type for e in graph.edges)
    assert "calls" in edge_types or "contains" in edge_types

def test_hub_nodes_and_surprises(fixture_repo_dir):
    adapter = GraphifyAdapter()
    graph = adapter.parse_graph(
        repo_dir=fixture_repo_dir,
        repository_id="test_sample",
        owner="test",
        name="sample",
    )
    
    # Gods / Hub nodes
    assert len(graph.hub_nodes) > 0
    hub_labels = [h.label for h in graph.hub_nodes]
    assert any("MetricProcessor" in l or "main" in l for l in hub_labels)

    # Surprises (cross-file connections)
    assert len(graph.surprises) > 0
    assert graph.surprises[0].source_files
