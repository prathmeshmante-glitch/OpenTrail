import os
import re
from typing import Any, Dict, List, Optional, Set
from backend.app.models.schemas import (
    ExecutionTrailResponse,
    ExecutionTrailStep,
    GraphEdge,
    GraphNode,
    ImpactSimulationResponse,
    ImpactedNode,
    RepositoryGraph,
    TestMapItem,
    TestMapResponse,
    WhyThisFileResponse,
)

class GraphQueryEngine:
    def __init__(self, graph: RepositoryGraph, repo_dir: Optional[str] = None):
        self.graph = graph
        self.repo_dir = repo_dir
        self.node_map: Dict[str, GraphNode] = {n.id: n for n in graph.nodes}
        
        # Build adjacency maps
        self.outgoing: Dict[str, List[GraphEdge]] = {n.id: [] for n in graph.nodes}
        self.incoming: Dict[str, List[GraphEdge]] = {n.id: [] for n in graph.nodes}
        for edge in graph.edges:
            if edge.source in self.outgoing:
                self.outgoing[edge.source].append(edge)
            if edge.target in self.incoming:
                self.incoming[edge.target].append(edge)
                
        # File path index
        self.file_to_nodes: Dict[str, List[GraphNode]] = {}
        for n in graph.nodes:
            self.file_to_nodes.setdefault(n.file_path, []).append(n)

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        return self.node_map.get(node_id)

    def search_nodes(self, query: str, limit: int = 20) -> List[GraphNode]:
        """Searches symbols and file paths using case-insensitive substring matching."""
        q = query.lower().strip()
        if not q:
            return []
            
        exact_matches = []
        partial_matches = []
        for n in self.graph.nodes:
            label_lower = n.label.lower()
            file_lower = n.file_path.lower()
            symbol_lower = n.symbol_name.lower()
            
            if q == label_lower or q == symbol_lower or q == file_lower:
                exact_matches.append(n)
            elif q in label_lower or q in symbol_lower or q in file_lower:
                partial_matches.append(n)
                
        results = exact_matches + partial_matches
        return results[:limit]

    def get_neighbors(self, node_id: str) -> Dict[str, List[GraphNode]]:
        """Returns callers/importers (incoming) and callees/dependencies (outgoing)."""
        inc_nodes = [
            self.node_map[e.source]
            for e in self.incoming.get(node_id, [])
            if e.source in self.node_map
        ]
        out_nodes = [
            self.node_map[e.target]
            for e in self.outgoing.get(node_id, [])
            if e.target in self.node_map
        ]
        return {"incoming": inc_nodes, "outgoing": out_nodes}

    def has_edge(self, source_id: str, target_id: str) -> Optional[GraphEdge]:
        """Checks if a directed edge exists from source_id to target_id."""
        for edge in self.outgoing.get(source_id, []):
            if edge.target == target_id:
                return edge
        return None

    def get_source_snippet(
        self,
        file_path: str,
        line_start: Optional[int],
        line_end: Optional[int] = None,
        max_lines: int = 15,
    ) -> Optional[str]:
        """Reads real source code lines from repository disk if available."""
        if not self.repo_dir or not file_path or not line_start or line_start < 1:
            return None
        
        full_path = os.path.join(self.repo_dir, file_path)
        if not os.path.isfile(full_path):
            return None
            
        try:
            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
                
            start_idx = max(0, line_start - 1)
            end_idx = min(len(lines), (line_end or line_start) + max_lines)
            snippet_lines = [
                f"{idx + 1:4d} | {lines[idx].rstrip()}"
                for idx in range(start_idx, end_idx)
            ]
            return "\n".join(snippet_lines)
        except Exception:
            return None

    def build_bounded_context(self, issue_text: str, max_components: int = 30) -> Dict[str, Any]:
        """
        Constructs a bounded, high-signal context package from the repository graph
        specifically tailored for Gemma 4 analysis.
        Includes real source snippets, AST relationships, provenance, and existing tests.
        """
        # Tokenize issue text into keywords (length >= 3)
        keywords = set(re.findall(r"[a-zA-Z0-9_]{3,}", issue_text.lower()))
        
        # Exclude generic english stop words
        stopwords = {
            "the", "and", "that", "this", "with", "from", "for", "not", "have", "are",
            "which", "when", "what", "where", "how", "why", "bug", "issue", "error",
            "fix", "fail", "failed", "does", "doesn", "cannot", "cant", "should"
        }
        filtered_keywords = keywords - stopwords
        
        scored_nodes: List[tuple[int, GraphNode]] = []
        for n in self.graph.nodes:
            score = 0
            label_lower = n.label.lower()
            file_lower = n.file_path.lower()
            symbol_lower = n.symbol_name.lower()
            
            for kw in filtered_keywords:
                if kw in label_lower:
                    score += 5
                if kw in symbol_lower:
                    score += 4
                if kw in file_lower:
                    score += 3
            if n.is_hub:
                score += 1  # slight boost for architectural hub components
            if score > 0:
                scored_nodes.append((score, n))
                
        # Sort by score descending
        scored_nodes.sort(key=lambda x: x[0], reverse=True)
        seed_nodes = [n for _, n in scored_nodes[:10]]
        
        # If no keywords matched, include architectural hub nodes
        if not seed_nodes:
            seed_nodes = [n for n in self.graph.nodes if n.is_hub][:8]
            
        # Collect neighborhood of seeds
        included_node_ids: Set[str] = set(n.id for n in seed_nodes)
        context_nodes: List[GraphNode] = list(seed_nodes)
        
        for sn in seed_nodes:
            neighbors = self.get_neighbors(sn.id)
            for nbr in neighbors["incoming"] + neighbors["outgoing"]:
                if nbr.id not in included_node_ids and len(context_nodes) < max_components:
                    included_node_ids.add(nbr.id)
                    context_nodes.append(nbr)

        # Collect edges between included nodes
        context_edges: List[GraphEdge] = []
        for edge in self.graph.edges:
            if edge.source in included_node_ids and edge.target in included_node_ids:
                context_edges.append(edge)

        # Build real source snippets and provenance for key seed nodes
        source_snippets: List[str] = []
        for node in seed_nodes[:6]:
            snippet = self.get_source_snippet(node.file_path, node.line_start, node.line_end)
            provenance = f"AST Extracted (kind: {node.kind}, community: {node.community}, degree: {node.degree})"
            if snippet:
                source_snippets.append(
                    f"### Node: {node.label} [{node.id}] in {node.file_path}:L{node.line_start or '?'}\n"
                    f"Provenance: {provenance}\n"
                    f"```\n{snippet}\n```"
                )
            else:
                source_snippets.append(
                    f"### Node: {node.label} [{node.id}] in {node.file_path}:L{node.line_start or '?'}\n"
                    f"Provenance: {provenance}"
                )

        # Collect verified existing test files and symbols from the actual graph
        existing_test_nodes = [
            n for n in self.graph.nodes
            if n.kind == "test" or "test" in (n.file_path or "").lower()
        ]
        test_summary: List[str] = []
        seen_test_files = set()
        for tn in existing_test_nodes[:15]:
            if tn.file_path not in seen_test_files:
                seen_test_files.add(tn.file_path)
                test_summary.append(f"- Test File: {tn.file_path}")
            if tn.kind == "test":
                test_summary.append(f"  * Test Symbol: {tn.label} in {tn.file_path} (L{tn.line_start or '?'})")

        # Context summary
        formatted_nodes = [
            f"- ID: {n.id} | Label: {n.label} | Kind: {n.kind} | File: {n.file_path} (L{n.line_start or '?'}) | Degree: {n.degree} | Provenance: {n.metadata.get('origin', 'ast')}"
            for n in context_nodes
        ]
        formatted_edges = [
            f"- {e.source} --[{e.relationship_type}]--> {e.target} | Confidence: {e.confidence} | Context: {e.evidence or 'ast'} | Location: {e.metadata.get('source_file') or ''} (L{e.source_location or ''})"
            for e in context_edges[:50]
        ]
        hub_summary = [
            f"- {h.label} (degree {h.degree})" for h in self.graph.hub_nodes[:5]
        ]
        
        return {
            "candidate_nodes": context_nodes,
            "candidate_edges": context_edges,
            "node_id_whitelist": included_node_ids,
            "formatted_nodes": "\n".join(formatted_nodes),
            "formatted_edges": "\n".join(formatted_edges),
            "formatted_snippets": "\n\n".join(source_snippets) if source_snippets else "No source code files available on disk.",
            "existing_tests": "\n".join(test_summary[:20]) if test_summary else "No existing test nodes indexed in AST.",
            "hub_summary": "\n".join(hub_summary),
        }

    def find_nodes_by_identifier(self, ident: str) -> List[GraphNode]:
        """Resolves node ID, label, symbol_name, or qualified name to GraphNode objects."""
        clean = ident.strip().strip("'\"`")
        if not clean:
            return []

        # 1. Direct ID match
        if clean in self.node_map:
            return [self.node_map[clean]]

        clean_lower = clean.lower()
        exact: List[GraphNode] = []
        for n in self.graph.nodes:
            if n.label.lower() == clean_lower or n.symbol_name.lower() == clean_lower:
                exact.append(n)

        if exact:
            return exact

        # Suffix matching e.g. "Bottle.route" -> "route"
        if "." in clean:
            suffix = clean.split(".")[-1].lower()
            for n in self.graph.nodes:
                if n.label.lower() == suffix or n.symbol_name.lower() == suffix:
                    exact.append(n)

        return exact

    def verify_relationship_evidence(self, rel_str: str) -> tuple[bool, str]:
        """
        Determines whether a relationship claims a real edge present in the AST graph.
        Returns (is_verified, formatted_string_with_tag).
        """
        clean_rel = re.sub(
            r"^\[(Verified AST Edge|Model Inferred Relationship)\]\s*", "", rel_str
        ).strip()

        # Try to parse source and target tokens
        patterns = [
            r"^(.*?)\s*--?\[.*?\]--?>\s*(.*?)$",
            r"^(.*?)\s*--?>\s*(.*?)$",
            r"^(.*?)\s+calls/references\s+(?:->\s*)?(.*?)$",
            r"^(.*?)\s+calls\s+(.*?)$",
            r"^(.*?)\s+references\s+(.*?)$",
            r"^(.*?)\s+imports\s+(.*?)$",
            r"^(.*?)\s+defines\s+(.*?)$",
            r"^(.*?)\s+depends on\s+(.*?)$",
        ]

        src_token = None
        tgt_token = None
        for pat in patterns:
            m = re.match(pat, clean_rel, flags=re.IGNORECASE)
            if m:
                src_token = m.group(1).strip()
                tgt_token = m.group(2).strip()
                break

        if src_token and tgt_token:
            src_nodes = self.find_nodes_by_identifier(src_token)
            tgt_nodes = self.find_nodes_by_identifier(tgt_token)
            for sn in src_nodes:
                for tn in tgt_nodes:
                    if self.has_edge(sn.id, tn.id) or self.has_edge(tn.id, sn.id):
                        return True, f"[Verified AST Edge] {clean_rel}"

        # If not parsed with binary split, check if at least two mentioned entities have an edge
        words = re.findall(r"[A-Za-z0-9_.]+", clean_rel)
        identified_nodes: List[GraphNode] = []
        for w in words:
            matching = self.find_nodes_by_identifier(w)
            if matching:
                identified_nodes.extend(matching[:2])

        for i in range(len(identified_nodes)):
            for j in range(len(identified_nodes)):
                if i != j:
                    if self.has_edge(identified_nodes[i].id, identified_nodes[j].id):
                        return True, f"[Verified AST Edge] {clean_rel}"

        return False, f"[Model Inferred Relationship] {clean_rel}"

    def is_existing_test(self, test_str: str) -> tuple[bool, str]:
        """
        Checks whether a test string corresponds to an actual test in the repository.
        Returns (is_existing, formatted_string_with_tag).
        """
        clean_test = re.sub(
            r"^\[(Existing Test|Proposed New Test)\]\s*", "", test_str
        ).strip()

        # Test files in graph
        test_files = set(
            n.file_path
            for n in self.graph.nodes
            if n.file_path and ("test" in n.file_path.lower() or n.file_path.endswith("_test.py"))
        )

        # Test symbols in graph
        test_symbols = set()
        for n in self.graph.nodes:
            if n.kind == "test" or (n.file_path and "test" in n.file_path.lower()):
                test_symbols.add(n.symbol_name.lower())
                test_symbols.add(n.label.lower())
                if n.file_path:
                    test_symbols.add(f"{n.file_path}::{n.symbol_name}".lower())
                    test_symbols.add(f"{n.file_path}::{n.label}".lower())

        clean_lower = clean_test.lower()

        # Check direct symbol or file matches
        if clean_lower in test_symbols or clean_test in test_files:
            return True, f"[Existing Test] {clean_test}"

        # Check "test/file.py::TestSymbol" syntax
        if "::" in clean_test:
            parts = clean_test.split("::", 1)
            fpart = parts[0].strip()
            spart = parts[1].strip().lower()
            file_ok = fpart in test_files or (
                self.repo_dir and os.path.isfile(os.path.join(self.repo_dir, fpart))
            )
            if file_ok:
                if spart in test_symbols or any(spart in s for s in test_symbols):
                    return True, f"[Existing Test] {clean_test}"
                # If file exists on disk, check if symbol actually exists in the file
                if self.repo_dir:
                    full_fpath = os.path.join(self.repo_dir, fpart)
                    if os.path.isfile(full_fpath):
                        try:
                            with open(full_fpath, "r", encoding="utf-8", errors="replace") as f:
                                content = f.read()
                            if f"def {spart}" in content.lower() or f"class {spart}" in content.lower():
                                return True, f"[Existing Test] {clean_test}"
                        except Exception:
                            pass

        # Check "Run/Verify <symbol> in <file>" pattern
        m = re.search(r"([A-Za-z0-9_]+)\s+in\s+([A-Za-z0-9_/.]+\.py)", clean_test)
        if m:
            sym = m.group(1).lower()
            fpath = m.group(2)
            file_ok = fpath in test_files or (
                self.repo_dir and os.path.isfile(os.path.join(self.repo_dir, fpath))
            )
            if file_ok and sym in test_symbols:
                return True, f"[Existing Test] {clean_test}"

        # Check if the clean_test itself is a valid test file path
        for tf in test_files:
            if clean_test == tf or clean_test == os.path.basename(tf):
                return True, f"[Existing Test] {clean_test}"

        # Otherwise, it does not exist in repository test files -> Proposed new test
        return False, f"[Proposed New Test] {clean_test}"

    def simulate_change_impact(
        self, target_node_id: str, max_depth: int = 2
    ) -> ImpactSimulationResponse:
        """
        Calculates bounded potential change impact by traversing upstream dependents (incoming callers/importers)
        and immediate downstream dependencies. Distinguishes direct (1-hop) from transitive (>1-hop) impact.
        Tracks exact paths and finds candidate regression tests.
        """
        target = self.node_map.get(target_node_id)
        if not target:
            raise ValueError(f"Target node '{target_node_id}' not found in graph.")

        max_depth = max(1, min(max_depth, 3))
        visited: Set[str] = {target_node_id}
        impacted_list: List[ImpactedNode] = []
        affected_edge_ids: Set[str] = set()

        # Queue items: (current_node_id, current_depth, path_labels, path_edge_ids)
        queue: List[tuple[str, int, List[str], List[str]]] = [
            (target_node_id, 0, [target.label], [])
        ]

        while queue:
            curr_id, depth, path_labels, path_edge_ids = queue.pop(0)
            if depth >= max_depth:
                continue

            # Traverse incoming edges (callers and consumers affected by modifying target)
            for edge in self.incoming.get(curr_id, []):
                src_id = edge.source
                if src_id in self.node_map and src_id not in visited:
                    visited.add(src_id)
                    affected_edge_ids.add(edge.id)
                    src_node = self.node_map[src_id]
                    next_depth = depth + 1
                    next_path = path_labels + [src_node.label]
                    next_edges = path_edge_ids + [edge.id]

                    impact_type = "direct" if next_depth == 1 else "transitive"
                    impacted_list.append(
                        ImpactedNode(
                            node_id=src_node.id,
                            label=src_node.label,
                            kind=src_node.kind,
                            file_path=src_node.file_path,
                            line_start=src_node.line_start,
                            depth=next_depth,
                            impact_type=impact_type,
                            relationship_path=next_path,
                            connecting_edge_ids=next_edges,
                        )
                    )
                    queue.append((src_id, next_depth, next_path, next_edges))

        # Discover candidate tests that test the target or any impacted node
        all_affected_ids = {target_node_id} | {item.node_id for item in impacted_list}
        candidate_test_nodes: Set[str] = set()
        candidate_test_files: Set[str] = set()

        for n in self.graph.nodes:
            is_test_node = n.kind == "test" or "test" in (n.file_path or "").lower()
            if is_test_node:
                calls_affected = any(
                    edge.target in all_affected_ids
                    for edge in self.outgoing.get(n.id, [])
                )
                matches_file = any(
                    self.node_map[aff_id].file_path
                    and os.path.basename(self.node_map[aff_id].file_path).replace(".py", "")
                    in (n.file_path or "").lower()
                    for aff_id in all_affected_ids
                    if aff_id in self.node_map
                )
                if calls_affected or matches_file:
                    candidate_test_nodes.add(n.id)
                    if n.file_path:
                        candidate_test_files.add(n.file_path)

        direct_count = sum(1 for item in impacted_list if item.impact_type == "direct")
        transitive_count = sum(
            1 for item in impacted_list if item.impact_type == "transitive"
        )

        return ImpactSimulationResponse(
            target_node_id=target.id,
            target_label=target.label,
            max_depth=max_depth,
            total_impacted=len(impacted_list),
            direct_impact_count=direct_count,
            transitive_impact_count=transitive_count,
            impacted_nodes=impacted_list,
            affected_edge_ids=list(affected_edge_ids),
            candidate_test_nodes=list(candidate_test_nodes)[:15],
            candidate_test_files=list(candidate_test_files)[:10],
            summary_caveats="Potential impact analysis based on static AST graph edges. Dynamic dispatch or runtime reflection may introduce additional dependencies.",
        )

    def get_smart_test_map(
        self, target_symbols: Optional[List[str]] = None
    ) -> TestMapResponse:
        """
        Discovers verified existing tests in the AST graph and maps them to target symbols.
        Provides transparent relevance scoring and evidence paths.
        """
        target_ids = set()
        target_labels = set()
        if target_symbols:
            for s in target_symbols:
                for n in self.find_nodes_by_identifier(s):
                    target_ids.add(n.id)
                    target_labels.add(n.label.lower())

        existing_test_items: List[TestMapItem] = []
        test_nodes = [
            n
            for n in self.graph.nodes
            if n.kind == "test" or (n.file_path and "test" in n.file_path.lower())
        ]

        for tn in test_nodes:
            out_edges = self.outgoing.get(tn.id, [])
            referenced_targets = [
                self.node_map[e.target].label
                for e in out_edges
                if e.target in self.node_map and self.node_map[e.target].kind != "test"
            ]

            relevance_score = 30
            relevance_reason = "General repository test suite"
            evidence_path = [tn.label]

            # Direct target caller?
            direct_matches = [
                e.target for e in out_edges if e.target in target_ids
            ]
            if direct_matches:
                relevance_score = 95
                relevance_reason = (
                    f"Directly tests target symbol '{self.node_map[direct_matches[0]].label}' via AST call edge"
                )
                evidence_path = [
                    tn.label,
                    "--[calls]-->",
                    self.node_map[direct_matches[0]].label,
                ]
            elif any(
                tl in tn.label.lower() or tl in (tn.file_path or "").lower()
                for tl in target_labels
            ):
                relevance_score = 75
                relevance_reason = "Test suite name or path matches target symbol domain"
                evidence_path = [tn.label, f"in {tn.file_path}"]
            elif referenced_targets:
                relevance_score = 50
                relevance_reason = (
                    f"References production symbols: {', '.join(referenced_targets[:3])}"
                )

            existing_test_items.append(
                TestMapItem(
                    test_node_id=tn.id,
                    test_name=tn.label,
                    test_file=tn.file_path,
                    line_start=tn.line_start,
                    state="Existing test — verified",
                    relevance_score=relevance_score,
                    relevance_reason=relevance_reason,
                    target_symbols=referenced_targets[:4],
                    evidence_path=evidence_path,
                )
            )

        # Sort existing tests by relevance score descending
        existing_test_items.sort(key=lambda x: x.relevance_score, reverse=True)

        # Proposed new tests if target symbols specified
        proposed_test_items: List[TestMapItem] = []
        if target_symbols:
            for s in target_symbols[:2]:
                nodes = self.find_nodes_by_identifier(s)
                sym_label = nodes[0].label if nodes else s
                sym_file = nodes[0].file_path if nodes else "target module"
                clean_name = os.path.basename(sym_file).replace(".py", "")
                proposed_test_items.append(
                    TestMapItem(
                        test_node_id=f"proposed_{s}",
                        test_name=f"Unit test verifying edge cases for {sym_label}",
                        test_file=f"tests/test_{clean_name}_edge.py",
                        line_start=None,
                        state="Proposed new test",
                        relevance_score=85,
                        relevance_reason=f"Validates behavior changes and edge inputs for {sym_label}",
                        target_symbols=[sym_label],
                        evidence_path=[f"Proposed regression test for {sym_label} in {sym_file}"],
                    )
                )

        return TestMapResponse(
            repository_id=self.graph.repository_id,
            total_tests_discovered=len(existing_test_items),
            existing_tests=existing_test_items[:30],
            proposed_tests=proposed_test_items,
        )

    def build_execution_trail(
        self, start_node_id: str, end_node_id: Optional[str] = None, max_steps: int = 6
    ) -> ExecutionTrailResponse:
        """
        Constructs an interactive step-by-step static dependency trail.
        If end_node_id is specified, finds shortest path; otherwise creates a high-signal
        trace from entry point through callers/callees to a test node or leaf dependency.
        """
        start = self.node_map.get(start_node_id)
        if not start:
            raise ValueError(f"Start node '{start_node_id}' not found.")

        path_nodes: List[str] = []
        path_edges: List[Optional[GraphEdge]] = []

        if end_node_id and end_node_id in self.node_map:
            # BFS path search
            queue = [([start_node_id], [])]
            visited = {start_node_id}
            found = False
            while queue and not found:
                curr_path, curr_edges = queue.pop(0)
                curr_node = curr_path[-1]
                if curr_node == end_node_id:
                    path_nodes = curr_path
                    path_edges = [None] + curr_edges
                    found = True
                    break
                for edge in self.outgoing.get(curr_node, []):
                    if edge.target not in visited and edge.target in self.node_map:
                        visited.add(edge.target)
                        queue.append((curr_path + [edge.target], curr_edges + [edge]))

        if not path_nodes:
            # Greedy high-signal walk
            curr_id = start_node_id
            path_nodes = [curr_id]
            path_edges = [None]
            visited = {curr_id}

            while len(path_nodes) < max_steps:
                out_edges = [
                    e
                    for e in self.outgoing.get(curr_id, [])
                    if e.target in self.node_map and e.target not in visited
                ]
                if not out_edges:
                    break
                out_edges.sort(
                    key=lambda e: (
                        e.relationship_type in ("calls", "method"),
                        self.node_map[e.target].degree,
                    ),
                    reverse=True,
                )
                chosen = out_edges[0]
                visited.add(chosen.target)
                path_nodes.append(chosen.target)
                path_edges.append(chosen)
                curr_id = chosen.target

        steps: List[ExecutionTrailStep] = []
        edge_ids: List[str] = []

        for idx, nid in enumerate(path_nodes):
            n = self.node_map[nid]
            edge = path_edges[idx]
            rel_from_prev = None
            e_id = None
            is_inf = False
            if edge:
                rel_from_prev = f"{edge.relationship_type}"
                e_id = edge.id
                edge_ids.append(edge.id)
                is_inf = edge.confidence == "INFERRED"

            snippet = self.get_source_snippet(
                n.file_path, n.line_start, n.line_end, max_lines=8
            )
            expl = f"{n.kind.capitalize()} '{n.label}' defined in {n.file_path}"
            if rel_from_prev and idx > 0:
                expl = f"Invoked via {rel_from_prev} from preceding step: '{self.node_map[path_nodes[idx-1]].label}'"

            steps.append(
                ExecutionTrailStep(
                    step_index=idx + 1,
                    node_id=n.id,
                    label=n.label,
                    kind=n.kind,
                    file_path=n.file_path,
                    line_start=n.line_start,
                    relationship_from_prev=rel_from_prev,
                    edge_id=e_id,
                    is_inferred=is_inf,
                    source_snippet=snippet,
                    explanation=expl,
                )
            )

        return ExecutionTrailResponse(
            trail_id=f"trail_{start.id}",
            name=f"Trail: {start.label} to {self.node_map[path_nodes[-1]].label}",
            description=f"Static code relationship trail tracing {len(steps)} verified components.",
            steps=steps,
            total_hops=max(0, len(steps) - 1),
            node_ids=path_nodes,
            edge_ids=edge_ids,
        )

    def explain_why_this_file(
        self,
        file_path: str,
        issue_text: Optional[str] = None,
        relevant_node_ids: Optional[List[str]] = None,
    ) -> WhyThisFileResponse:
        """
        Produces a transparent, evidence-backed explanation for why a file is recommended.
        Extracts matched keywords, verified symbols in the file, and connecting AST relationships.
        """
        nodes_in_file = self.file_to_nodes.get(file_path, [])
        verified_symbols = [n.label for n in nodes_in_file]

        matched_kws: List[str] = []
        if issue_text:
            kws = set(re.findall(r"[a-zA-Z0-9_]{3,}", issue_text.lower()))
            for kw in kws:
                if kw in file_path.lower() or any(
                    kw in s.lower() for s in verified_symbols
                ):
                    matched_kws.append(kw)

        # Check connecting edges to relevant nodes
        connecting_edges: List[str] = []
        node_id_set = set(n.id for n in nodes_in_file)
        rel_set = set(relevant_node_ids or [])

        match_type = "inferred"
        if matched_kws:
            match_type = "direct"

        for nid in node_id_set:
            if nid in rel_set:
                match_type = "direct"
            for edge in self.outgoing.get(nid, []):
                if edge.target in rel_set:
                    match_type = "direct"
                    connecting_edges.append(
                        f"{self.node_map[nid].label} --[{edge.relationship_type}]--> {self.node_map[edge.target].label}"
                    )
            for edge in self.incoming.get(nid, []):
                if edge.source in rel_set:
                    match_type = (
                        "transitive" if match_type != "direct" else "direct"
                    )
                    connecting_edges.append(
                        f"{self.node_map[edge.source].label} --[{edge.relationship_type}]--> {self.node_map[nid].label}"
                    )

        relevance_reason = (
            f"File contains {len(nodes_in_file)} verified AST symbols matching issue terms and connected via structural edges."
            if connecting_edges or matched_kws
            else f"File indexed in AST repository graph with {len(nodes_in_file)} symbols."
        )

        top_node = nodes_in_file[0] if nodes_in_file else None
        snippet = self.get_source_snippet(
            file_path, top_node.line_start if top_node else 1, max_lines=10
        )

        missing_evidence = None
        if not connecting_edges and not matched_kws:
            missing_evidence = "No direct call edges linking this file to target issue symbols were extracted in static AST."

        return WhyThisFileResponse(
            file_path=file_path,
            relevance_reason=relevance_reason,
            matched_keywords=matched_kws[:6],
            verified_symbols=verified_symbols[:8],
            connecting_edges=connecting_edges[:6],
            match_type=match_type,
            missing_evidence=missing_evidence,
            source_snippet=snippet,
        )



