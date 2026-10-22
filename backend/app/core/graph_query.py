import os
import re
from typing import Any, Dict, List, Optional, Set
from backend.app.models.schemas import GraphEdge, GraphNode, RepositoryGraph

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


