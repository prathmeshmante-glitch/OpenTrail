import json
import os
import re
import subprocess
from typing import Any, Dict, List, Optional, Tuple

from backend.app.config import settings
from backend.app.models.schemas import (
    CrossFileSurprise,
    GraphEdge,
    GraphNode,
    HubNode,
    RepositoryGraph,
    RepositoryStatistics,
    ShortestPathResponse,
)

class GraphifyAdapterError(RuntimeError):
    """Raised when Graphify execution or parsing fails."""
    pass

def _parse_line_number(source_location: Optional[str]) -> Tuple[Optional[int], Optional[int]]:
    """Extracts start and end line numbers from a source location string like 'L4' or 'L10-L25'."""
    if not source_location:
        return None, None
    m = re.match(r"^L(\d+)(?:-L(\d+))?", source_location.strip())
    if m:
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else start
        return start, end
    return None, None

RECOGNIZED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".kt", ".kts", ".java", ".go", ".rs",
    ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".cs", ".rb", ".swift", ".m", ".mm",
    ".dart", ".scala", ".gradle", ".xml", ".json", ".yaml", ".yml", ".toml", ".md",
    ".sh", ".bash", ".bat", ".ps1", ".html", ".css", ".scss"
}

def _infer_kind(node_dict: Dict[str, Any]) -> str:
    """Infers the kind (file, class, function, method, module, test) from AST node attributes."""
    label = node_dict.get("label", "")
    source_file = node_dict.get("source_file") or ""
    is_callable = bool(node_dict.get("_callable"))
    is_class = bool(node_dict.get("_callable_class"))

    # 1. First, check if this node represents a file container
    _, ext = os.path.splitext(label)
    is_file_node = False
    if source_file and not is_callable and not is_class:
        basename = os.path.basename(source_file)
        if (
            ext.lower() in RECOGNIZED_EXTENSIONS
            or basename == label
            or source_file.endswith(label)
            or label == "gradlew"
            or any(label.endswith(e) for e in RECOGNIZED_EXTENSIONS)
        ):
            is_file_node = True

    if is_file_node:
        return "file"

    source_file_lower = source_file.lower()
    label_lower = label.lower()
    if "test" in source_file_lower or "test_" in label_lower or label_lower.endswith("_test"):
        return "test"
    if is_class:
        return "class"
    if is_callable:
        if label.startswith(".") or ("(" in label and "." in label):
            return "method"
        return "function"
    if any(label.endswith(e) for e in RECOGNIZED_EXTENSIONS):
        return "file"
    return "module"

class GraphifyAdapter:
    def __init__(self, python_executable: Optional[str] = None):
        self.python_executable = python_executable or settings.PYTHON_EXECUTABLE

    def run_extraction(self, repo_dir: str, timeout_seconds: int = 90) -> str:
        """
        Executes AST code extraction using Graphify CLI:
        `python -m graphify extract <repo_dir> --code-only`
        
        Returns:
            Path to the output directory (repo_dir/graphify-out)
        """
        if not os.path.isdir(repo_dir):
            raise GraphifyAdapterError(f"Target repository directory does not exist: {repo_dir}")
            
        cmd = [
            self.python_executable,
            "-m",
            "graphify",
            "extract",
            repo_dir,
            "--code-only",
        ]
        
        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                shell=False,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            raise GraphifyAdapterError(f"Graphify extraction timed out after {timeout_seconds} seconds.")
        except Exception as e:
            raise GraphifyAdapterError(f"Failed to invoke Graphify: {e}")
            
        out_dir = os.path.join(repo_dir, "graphify-out")
        graph_file = os.path.join(out_dir, "graph.json")
        
        if not os.path.isfile(graph_file):
            err_output = res.stderr or res.stdout
            raise GraphifyAdapterError(
                f"Graphify did not generate graph.json. Details: {err_output[:300]}"
            )
            
        return out_dir

    def parse_graph(
        self,
        repo_dir: str,
        repository_id: str,
        owner: str,
        name: str,
        max_nodes: int = 3000,
    ) -> RepositoryGraph:
        """
        Parses `graph.json` and `.graphify_analysis.json` and maps them into canonical RepositoryGraph.
        """
        out_dir = os.path.join(repo_dir, "graphify-out")
        graph_file = os.path.join(out_dir, "graph.json")
        analysis_file = os.path.join(out_dir, ".graphify_analysis.json")
        
        if not os.path.isfile(graph_file):
            raise GraphifyAdapterError(f"Graph file missing: {graph_file}")
            
        with open(graph_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
            
        raw_analysis: Dict[str, Any] = {}
        if os.path.isfile(analysis_file):
            try:
                with open(analysis_file, "r", encoding="utf-8") as f:
                    raw_analysis = json.load(f)
            except Exception:
                pass

        # Identify hub / god nodes from analysis
        gods_list = raw_analysis.get("gods", [])
        god_node_ids = {g["id"]: g["degree"] for g in gods_list if "id" in g}
        
        hub_nodes: List[HubNode] = [
            HubNode(id=g["id"], label=g.get("label", g["id"]), degree=g.get("degree", 0))
            for g in gods_list if "id" in g
        ]
        
        # Build node degree map from links
        raw_links = raw_data.get("links", [])
        degree_map: Dict[str, int] = {}
        for link in raw_links:
            s = link.get("source")
            t = link.get("target")
            if s:
                degree_map[s] = degree_map.get(s, 0) + 1
            if t:
                degree_map[t] = degree_map.get(t, 0) + 1

        raw_nodes = raw_data.get("nodes", [])
        nodes: List[GraphNode] = []
        node_id_set = set()
        file_set = set()
        communities_set = set()

        for nd in raw_nodes:
            nid = nd.get("id")
            if not nid:
                continue
                
            node_id_set.add(nid)
            file_path = nd.get("source_file", "")
            if file_path:
                file_set.add(file_path)
                
            comm = nd.get("community")
            if comm is not None:
                communities_set.add(comm)
                
            line_start, line_end = _parse_line_number(nd.get("source_location"))
            deg = god_node_ids.get(nid, degree_map.get(nid, 0))
            is_hub = nid in god_node_ids or deg >= 8
            
            node = GraphNode(
                id=nid,
                label=nd.get("label", nid),
                kind=_infer_kind(nd),
                file_path=file_path,
                symbol_name=nd.get("norm_label", nd.get("label", nid)),
                line_start=line_start,
                line_end=line_end,
                community=comm,
                degree=deg,
                is_hub=is_hub,
                metadata={
                    "origin": nd.get("_origin", "ast"),
                    "callable": nd.get("_callable", False),
                    "file_type": nd.get("file_type", "code"),
                    "source_location": nd.get("source_location"),
                },
            )
            nodes.append(node)
            
            if len(nodes) >= max_nodes:
                break

        # Map edges, filtering out dangling references
        edges: List[GraphEdge] = []
        for idx, link in enumerate(raw_links):
            src = link.get("source")
            tgt = link.get("target")
            if src not in node_id_set or tgt not in node_id_set:
                continue
                
            edge_id = f"edge_{src}_{tgt}_{idx}"
            edge = GraphEdge(
                id=edge_id,
                source=src,
                target=tgt,
                relationship_type=link.get("relation", "references"),
                confidence=link.get("confidence", "EXTRACTED"),
                confidence_score=float(link.get("confidence_score", 1.0)),
                evidence=link.get("context"),
                source_location=link.get("source_location"),
                metadata={
                    "origin": link.get("_origin", "ast"),
                    "weight": link.get("weight", 1.0),
                    "source_file": link.get("source_file"),
                },
            )
            edges.append(edge)

        # Cross-file surprises
        surprises: List[CrossFileSurprise] = []
        for s in raw_analysis.get("surprises", []):
            if "source" in s and "target" in s:
                surprises.append(
                    CrossFileSurprise(
                        source=str(s["source"]),
                        target=str(s["target"]),
                        relation=s.get("relation", "calls"),
                        confidence=s.get("confidence", "EXTRACTED"),
                        why=s.get("why", "cross-file connection"),
                        source_files=s.get("source_files", []),
                    )
                )

        stats = RepositoryStatistics(
            total_nodes=len(nodes),
            total_edges=len(edges),
            total_files=len(file_set),
            total_communities=len(communities_set),
            god_nodes_count=len(hub_nodes),
        )

        return RepositoryGraph(
            repository_id=repository_id,
            owner=owner,
            name=name,
            graph_version="0.9.93",
            nodes=nodes,
            edges=edges,
            statistics=stats,
            hub_nodes=hub_nodes,
            surprises=surprises,
            generated_at=raw_data.get("graph", {}).get("generated_at", ""),
        )

    def find_shortest_path(self, repo_dir: str, source_id: str, target_id: str) -> ShortestPathResponse:
        """
        Invokes `graphify path "A" "B" --graph <path>` to find the verified shortest relationship path.
        """
        graph_file = os.path.join(repo_dir, "graphify-out", "graph.json")
        if not os.path.isfile(graph_file):
            raise GraphifyAdapterError("Graph file missing for path computation.")
            
        cmd = [
            self.python_executable,
            "-m",
            "graphify",
            "path",
            source_id,
            target_id,
            "--graph",
            graph_file,
        ]
        
        res = subprocess.run(cmd, capture_output=True, text=True, shell=False)
        output = res.stdout.strip()
        
        # Parse hops and path if available
        hops = 0
        m = re.search(r"Shortest path \((\d+) hops\):", output)
        if m:
            hops = int(m.group(1))
            
        return ShortestPathResponse(
            source=source_id,
            target=target_id,
            hops=hops,
            path_nodes=[source_id, target_id],
            path_edges=[],
            formatted_explanation=output if res.returncode == 0 else "No path could be established.",
        )

    def find_affected_nodes(self, repo_dir: str, node_id: str) -> List[str]:
        """
        Invokes `graphify affected "node" --graph <path>` to determine reverse-traversal downstream nodes.
        """
        graph_file = os.path.join(repo_dir, "graphify-out", "graph.json")
        if not os.path.isfile(graph_file):
            return []
            
        cmd = [
            self.python_executable,
            "-m",
            "graphify",
            "affected",
            node_id,
            "--graph",
            graph_file,
        ]
        
        res = subprocess.run(cmd, capture_output=True, text=True, shell=False)
        if res.returncode != 0:
            return []
            
        affected: List[str] = []
        for line in res.stdout.splitlines():
            line = line.strip()
            if line.startswith("-"):
                affected.append(line[1:].strip())
        return affected
