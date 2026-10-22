import os
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from backend.app.config import settings
from backend.app.core.git_service import clone_public_repository, safe_remove_tree
from backend.app.core.graph_query import GraphQueryEngine
from backend.app.core.graphify_adapter import GraphifyAdapter
from backend.app.core.security import validate_and_canonicalize_github_url
from backend.app.models.schemas import (
    InvestigationResponse,
    JobStage,
    JobStatusResponse,
    RepositoryGraph,
)

class JobManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._jobs: Dict[str, JobStatusResponse] = {}
        self._graphs: Dict[str, RepositoryGraph] = {}
        self._query_engines: Dict[str, GraphQueryEngine] = {}
        self._investigations: Dict[str, InvestigationResponse] = {}
        self._repo_dirs: Dict[str, str] = {}
        self._adapter = GraphifyAdapter()
        os.makedirs(settings.STORAGE_DIR, exist_ok=True)

    def get_job(self, job_id: str) -> Optional[JobStatusResponse]:
        with self._lock:
            return self._jobs.get(job_id)

    def get_graph(self, repository_id: str) -> Optional[RepositoryGraph]:
        with self._lock:
            if repository_id in self._graphs:
                return self._graphs[repository_id]

            # Attempt automatic rehydration from disk storage
            candidates = [
                os.path.join(settings.STORAGE_DIR, repository_id),
                os.path.join(settings.STORAGE_DIR, f"{repository_id}_test"),
            ]
            for candidate_dir in candidates:
                graph_json = os.path.join(candidate_dir, "graphify-out", "graph.json")
                if os.path.isdir(candidate_dir) and os.path.isfile(graph_json):
                    parts = repository_id.split("_", 1)
                    owner = parts[0]
                    name = parts[1] if len(parts) > 1 else repository_id
                    try:
                        graph = self._adapter.parse_graph(candidate_dir, repository_id, owner, name)
                        self._graphs[repository_id] = graph
                        self._query_engines[repository_id] = GraphQueryEngine(graph, repo_dir=candidate_dir)
                        self._repo_dirs[repository_id] = candidate_dir
                        return graph
                    except Exception:
                        pass
            return None

    def get_query_engine(self, repository_id: str) -> Optional[GraphQueryEngine]:
        with self._lock:
            if repository_id in self._query_engines:
                return self._query_engines[repository_id]
        # Rehydrate if available on disk
        self.get_graph(repository_id)
        with self._lock:
            return self._query_engines.get(repository_id)

    def get_repo_dir(self, repository_id: str) -> Optional[str]:
        with self._lock:
            if repository_id in self._repo_dirs:
                return self._repo_dirs[repository_id]
        self.get_graph(repository_id)
        with self._lock:
            return self._repo_dirs.get(repository_id)

    def get_investigation(self, investigation_id: str) -> Optional[InvestigationResponse]:
        with self._lock:
            return self._investigations.get(investigation_id)

    def store_investigation(self, investigation: InvestigationResponse):
        with self._lock:
            self._investigations[investigation.investigation_id] = investigation

    def create_repository_job(self, raw_url: str) -> JobStatusResponse:
        """Validates input, registers job, and spawns background worker."""
        # Validate URL immediately
        canonical_url, owner, repo = validate_and_canonicalize_github_url(raw_url)
        repository_id = f"{owner}_{repo}".lower()

        # Check if graph is already cached in memory
        with self._lock:
            if repository_id in self._graphs:
                # Return completed job pointing to cached graph
                job_id = f"job_cached_{uuid.uuid4().hex[:8]}"
                now = datetime.now(timezone.utc).isoformat()
                job = JobStatusResponse(
                    job_id=job_id,
                    repository_id=repository_id,
                    stage=JobStage.READY,
                    progress=100,
                    message="Repository already analyzed and ready in cache.",
                    error=None,
                    created_at=now,
                    updated_at=now,
                )
                self._jobs[job_id] = job
                return job

        job_id = f"job_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        job = JobStatusResponse(
            job_id=job_id,
            repository_id=repository_id,
            stage=JobStage.VALIDATING,
            progress=10,
            message="Validating repository URL and access parameters...",
            error=None,
            created_at=now,
            updated_at=now,
        )
        with self._lock:
            self._jobs[job_id] = job

        # Run background processing thread
        thread = threading.Thread(
            target=self._process_repository_job,
            args=(job_id, repository_id, canonical_url, owner, repo),
            daemon=True,
        )
        thread.start()
        return job

    def register_existing_graph(self, repo_dir: str, owner: str, name: str) -> RepositoryGraph:
        """Directly parses an already-extracted repo directory into the registry."""
        repository_id = f"{owner}_{name}".lower()
        graph = self._adapter.parse_graph(
            repo_dir=repo_dir,
            repository_id=repository_id,
            owner=owner,
            name=name,
            max_nodes=settings.MAX_GRAPH_NODES,
        )
        with self._lock:
            self._graphs[repository_id] = graph
            self._repo_dirs[repository_id] = repo_dir
            self._query_engines[repository_id] = GraphQueryEngine(graph, repo_dir=repo_dir)
        return graph

    def _update_job(
        self,
        job_id: str,
        stage: JobStage,
        progress: int,
        message: str,
        error: Optional[str] = None,
    ):
        with self._lock:
            if job_id in self._jobs:
                j = self._jobs[job_id]
                self._jobs[job_id] = JobStatusResponse(
                    job_id=j.job_id,
                    repository_id=j.repository_id,
                    stage=stage,
                    progress=progress,
                    message=message,
                    error=error,
                    created_at=j.created_at,
                    updated_at=datetime.now(timezone.utc).isoformat(),
                )

    def _process_repository_job(
        self, job_id: str, repository_id: str, canonical_url: str, owner: str, repo: str
    ):
        target_dir = os.path.join(settings.STORAGE_DIR, repository_id)
        # If target_dir already exists, clean it up before a fresh clone
        safe_remove_tree(target_dir)
        try:
            # Stage 2: Fetching
            self._update_job(job_id, JobStage.FETCHING, 30, f"Cloning shallow source for {owner}/{repo}...")
            clone_public_repository(canonical_url, target_dir, timeout_seconds=settings.JOB_TIMEOUT_SECONDS)

            # Stage 3: Extracting
            self._update_job(job_id, JobStage.EXTRACTING, 60, "Running Graphify AST relationship extraction...")
            self._adapter.run_extraction(target_dir, timeout_seconds=settings.JOB_TIMEOUT_SECONDS)

            # Stage 4: Preparing
            self._update_job(job_id, JobStage.PREPARING, 85, "Normalizing graph schema and computing community hubs...")
            graph = self._adapter.parse_graph(
                repo_dir=target_dir,
                repository_id=repository_id,
                owner=owner,
                name=repo,
                max_nodes=settings.MAX_GRAPH_NODES,
            )

            with self._lock:
                self._graphs[repository_id] = graph
                self._repo_dirs[repository_id] = target_dir
                self._query_engines[repository_id] = GraphQueryEngine(graph, repo_dir=target_dir)

            # Stage 5: Ready
            self._update_job(
                job_id,
                JobStage.READY,
                100,
                f"Repository successfully analyzed: {graph.statistics.total_nodes} nodes, {graph.statistics.total_edges} connections.",
            )

        except Exception as e:
            # Cleanup on failure
            safe_remove_tree(target_dir)
            self._update_job(
                job_id,
                JobStage.FAILED,
                100,
                "Analysis failed.",
                error=str(e),
            )

job_manager = JobManager()
