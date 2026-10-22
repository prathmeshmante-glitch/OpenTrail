import pytest
from backend.app.core.ai_orchestrator import AIOrchestrator
from backend.app.core.graph_query import GraphQueryEngine
from backend.app.core.graphify_adapter import GraphifyAdapter
from backend.app.models.schemas import GraphEdge, GraphNode, RepositoryGraph


@pytest.fixture
def sample_graph_and_engine():
    """Builds a deterministic test repository graph with code, tests, and edges."""
    nodes = [
        GraphNode(
            id="app_processor",
            label="Processor",
            kind="class",
            file_path="src/processor.py",
            symbol_name="Processor",
            line_start=15,
            line_end=85,
            degree=4,
            is_hub=True,
        ),
        GraphNode(
            id="app_processor_calculate",
            label="Processor.calculate",
            kind="function",
            file_path="src/processor.py",
            symbol_name="calculate",
            line_start=30,
            line_end=50,
            degree=2,
            is_hub=False,
        ),
        GraphNode(
            id="app_utils_format",
            label="format_output",
            kind="function",
            file_path="src/utils.py",
            symbol_name="format_output",
            line_start=10,
            line_end=25,
            degree=1,
            is_hub=False,
        ),
        GraphNode(
            id="test_processor_suite",
            label="TestProcessor",
            kind="test",
            file_path="tests/test_processor.py",
            symbol_name="TestProcessor",
            line_start=5,
            line_end=60,
            degree=2,
            is_hub=False,
        ),
        GraphNode(
            id="test_processor_calc",
            label="test_calculate_positive",
            kind="test",
            file_path="tests/test_processor.py",
            symbol_name="test_calculate_positive",
            line_start=15,
            line_end=25,
            degree=1,
            is_hub=False,
        ),
    ]

    edges = [
        GraphEdge(
            id="e1",
            source="app_processor",
            target="app_processor_calculate",
            relationship_type="defines",
            confidence="EXTRACTED",
            confidence_score=1.0,
            evidence="ast",
            source_location="L15",
            metadata={"source_file": "src/processor.py"},
        ),
        GraphEdge(
            id="e2",
            source="app_processor_calculate",
            target="app_utils_format",
            relationship_type="calls",
            confidence="EXTRACTED",
            confidence_score=1.0,
            evidence="ast",
            source_location="L42",
            metadata={"source_file": "src/processor.py"},
        ),
    ]

    graph = RepositoryGraph(
        repository_id="test_audit_repo",
        owner="test",
        name="audit",
        graph_version="1.0.0",
        nodes=nodes,
        edges=edges,
        statistics={
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "total_files": 3,
            "total_communities": 1,
            "god_nodes_count": 0,
        },
        hub_nodes=[],
        surprises=[],
        generated_at="2026-10-22T00:00:00Z",
    )

    query_engine = GraphQueryEngine(graph)
    orchestrator = AIOrchestrator(api_key="")
    return graph, query_engine, orchestrator


def test_verified_component_has_line_numbers_and_real_node(sample_graph_and_engine):
    graph, query_engine, orchestrator = sample_graph_and_engine
    raw_data = {
        "issue_summary": "Test issue",
        "relevant_components": [
            {
                "node_id": "app_processor_calculate",
                "label": "Processor.calculate",
                "file_path": "src/processor.py",
                "relevance_reason": "Contains calculation logic",
            }
        ],
        "confirmed_relationships": [],
        "suggested_tests": [],
    }

    valid_node_ids = set(n.id for n in graph.nodes)
    valid_files = set(n.file_path for n in graph.nodes)
    rec = orchestrator._validate_and_sanitize(raw_data, valid_node_ids, valid_files, query_engine)

    assert len(rec.relevant_components) == 1
    comp = rec.relevant_components[0]
    assert comp.is_verified is True
    assert comp.node_id == "app_processor_calculate"
    assert comp.file_path == "src/processor.py"
    assert comp.line_start == 30
    assert comp.line_end == 50


def test_hallucinated_symbol_rejection(sample_graph_and_engine):
    graph, query_engine, orchestrator = sample_graph_and_engine
    raw_data = {
        "issue_summary": "Test issue",
        "relevant_components": [
            {
                "node_id": "fake_node_999",
                "label": "nonexistent_function",
                "file_path": "src/processor.py",
                "relevance_reason": "Hallucinated symbol",
            }
        ],
        "confirmed_relationships": [],
        "suggested_tests": [],
    }

    valid_node_ids = set(n.id for n in graph.nodes)
    valid_files = set(n.file_path for n in graph.nodes)
    rec = orchestrator._validate_and_sanitize(raw_data, valid_node_ids, valid_files, query_engine)

    assert len(rec.relevant_components) == 1
    comp = rec.relevant_components[0]
    # Since symbol doesn't exist in AST, is_verified must be False and line numbers None
    assert comp.is_verified is False
    assert comp.line_start is None
    assert comp.line_end is None
    assert "symbol unindexed" in comp.relevance_reason


def test_invalid_file_reference_rejection(sample_graph_and_engine):
    graph, query_engine, orchestrator = sample_graph_and_engine
    raw_data = {
        "issue_summary": "Test issue",
        "relevant_components": [
            {
                "node_id": "hallucinated_id",
                "label": "phantom_symbol",
                "file_path": "completely/fake/path.py",
                "relevance_reason": "Invented file",
            }
        ],
        "confirmed_relationships": [],
        "suggested_tests": [],
    }

    valid_node_ids = set(n.id for n in graph.nodes)
    valid_files = set(n.file_path for n in graph.nodes)
    rec = orchestrator._validate_and_sanitize(raw_data, valid_node_ids, valid_files, query_engine)

    assert len(rec.relevant_components) == 1
    comp = rec.relevant_components[0]
    assert comp.is_verified is False
    assert comp.line_start is None
    assert "not found in repository" in comp.relevance_reason


def test_nonexistent_test_labeled_as_proposed(sample_graph_and_engine):
    graph, query_engine, orchestrator = sample_graph_and_engine
    raw_data = {
        "issue_summary": "Test issue",
        "relevant_components": [],
        "confirmed_relationships": [],
        "suggested_tests": [
            "test_processor_nonexistent_edge_case",
            "tests/test_processor.py::test_missing_method",
            "[Existing Test] test_hallucinated_claim",
            "test_Processor_format_output",  # synthetic node concatenation
        ],
    }

    valid_node_ids = set(n.id for n in graph.nodes)
    valid_files = set(n.file_path for n in graph.nodes)
    rec = orchestrator._validate_and_sanitize(raw_data, valid_node_ids, valid_files, query_engine)

    for test_item in rec.suggested_tests:
        assert test_item.startswith("[Proposed New Test]"), f"Expected proposed test tag: {test_item}"
        assert not test_item.startswith("[Existing Test]"), f"Should not be marked existing: {test_item}"


def test_existing_test_recognition(sample_graph_and_engine):
    graph, query_engine, orchestrator = sample_graph_and_engine
    raw_data = {
        "issue_summary": "Test issue",
        "relevant_components": [],
        "confirmed_relationships": [],
        "suggested_tests": [
            "tests/test_processor.py::test_calculate_positive",
            "TestProcessor",
            "tests/test_processor.py",
            "test_calculate_positive in tests/test_processor.py",
        ],
    }

    valid_node_ids = set(n.id for n in graph.nodes)
    valid_files = set(n.file_path for n in graph.nodes)
    rec = orchestrator._validate_and_sanitize(raw_data, valid_node_ids, valid_files, query_engine)

    for test_item in rec.suggested_tests:
        assert test_item.startswith("[Existing Test]"), f"Expected existing test tag: {test_item}"


def test_call_relationship_verification_distinction(sample_graph_and_engine):
    graph, query_engine, orchestrator = sample_graph_and_engine
    raw_data = {
        "issue_summary": "Test issue",
        "relevant_components": [],
        "confirmed_relationships": [
            "app_processor_calculate calls app_utils_format",
            "Processor defines Processor.calculate",
            "app_processor --[defines]--> app_processor_calculate",
            "Processor might directly call DatabaseConnection",
            "format_output -> nonexistent_service",
        ],
        "suggested_tests": [],
    }

    valid_node_ids = set(n.id for n in graph.nodes)
    valid_files = set(n.file_path for n in graph.nodes)
    rec = orchestrator._validate_and_sanitize(raw_data, valid_node_ids, valid_files, query_engine)

    rels = rec.confirmed_relationships
    # The first 3 have real edges in graph
    assert rels[0].startswith("[Verified AST Edge]")
    assert rels[1].startswith("[Verified AST Edge]")
    assert rels[2].startswith("[Verified AST Edge]")

    # The last 2 have NO edges in graph -> Model Inferred
    assert rels[3].startswith("[Model Inferred Relationship]")
    assert rels[4].startswith("[Model Inferred Relationship]")


def test_deterministic_recommendation_never_concatenates_node_names(sample_graph_and_engine):
    graph, query_engine, orchestrator = sample_graph_and_engine
    candidate_nodes = graph.nodes[:3]

    rec = orchestrator._build_deterministic_recommendation(
        issue_text="calculate empty list error",
        candidate_nodes=candidate_nodes,
        query_engine=query_engine,
        is_offline=True,
    )

    for test_item in rec.suggested_tests:
        # Must have either [Existing Test] or [Proposed New Test]
        assert test_item.startswith("[Existing Test]") or test_item.startswith("[Proposed New Test]")
        # Never generate concatenated node IDs like test_app_processor_app_utils_format
        assert not any(f"test_{a.id}_{b.id}" in test_item for a in candidate_nodes for b in candidate_nodes)

    for comp in rec.relevant_components:
        assert comp.is_verified is True
        assert comp.line_start is not None
