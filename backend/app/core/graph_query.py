import re
from typing import Dict, List, Optional, Set
from backend.app.models.schemas import GraphEdge, GraphNode, RepositoryGraph

class GraphQueryEngine:
    def __init__(self, graph: RepositoryGraph):
        self.graph = graph
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

    def build_bounded_context(self, issue_text: str, max_components: int = 30) -> Dict[str, any]:
        """
        Constructs a bounded, high-signal context package from the repository graph
        specifically tailored for Gemma 4 analysis.
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

        # Context summary
        formatted_nodes = [
            f"- ID: {n.id} | Label: {n.label} | Kind: {n.kind} | File: {n.file_path} (L{n.line_start or '?'}) | Degree: {n.degree}"
            for n in context_nodes
        ]
        formatted_edges = [
            f"- {e.source} --[{e.relationship_type}]--> {e.target} (Confidence: {e.confidence})"
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
            "hub_summary": "\n".join(hub_summary),
        }
