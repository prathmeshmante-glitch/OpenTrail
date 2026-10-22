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
        self._adapter = GraphifyAdapter()
        os.makedirs(settings.STORAGE_DIR, exist_ok=True)

    def get_job(self, job_id: str) -> Optional[JobStatusResponse]:
        with self._lock:
            return self._jobs.get(job_id)

    def get_graph(self, repository_id: str) -> Optional[RepositoryGraph]:
        with self._lock:
            return self._graphs.get(repository_id)

    def get_query_engine(self, repository_id: str) -> Optional[GraphQueryEngine]:
        with self._lock:
            return self._query_engines.get(repository_id)

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
            self._query_engines[repository_id] = GraphQueryEngine(graph)
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
        target_dir = os.path.join(settings.STORAGE_DIR, f"{owner}_{repo}_{uuid.uuid4().hex[:6]}")
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
                self._query_engines[repository_id] = GraphQueryEngine(graph)

            # Stage 5: Ready
            self._update_job(
                job_id,
                JobStage.READY,
                100,
                f"Repository successfully analyzed: {graph.statistics.total_nodes} nodes, {graph.statistics.total_edges} connections.",
            )

        except Exception as e:
            self._update_job(
                job_id,
                JobStage.FAILED,
                100,
                "Analysis failed.",
                error=str(e),
            )
        finally:
            # Cleanup temporary source clone workspace to prevent disk bloat
            # Note: The parsed graph is safely held in memory!
            safe_remove_tree(target_dir)

job_manager = JobManager()
