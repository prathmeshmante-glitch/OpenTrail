# OpenTrail — Implementation Plan

## Overview & Objective
OpenTrail turns supported public GitHub repositories into interactive maps of internal code relationships. It couples AST-level source graph extraction (via Graphify 0.9.93) with AI-assisted issue interpretation (via Gemma 4 `gemma-4-26b-a4b-it` / `gemma-4-31b-it` through the Google Gen AI API) and strict evidence validation.

---

## 1. Feature Breakdown by Priority

### Priority 0: Baseline & Environment Verification (COMPLETED)
- [x] Verify Python runtime (`D:\python.exe` 3.14.6) and Node runtime (`v24.22.0`).
- [x] Inspect Graphify CLI flags (`extract --code-only`, `affected`, `path`, `export html`, `.graphify_analysis.json`).
- [x] Install backend dependencies (`fastapi`, `uvicorn`, `pydantic`, `httpx`, `pytest`, `google-genai`).
- [x] Scaffold Vite + React + TypeScript frontend with `@xyflow/react` and `lucide-react`.
- [x] Verify real Graphify extraction against AST fixtures (`processor.py`, `main.py`).

### Priority 1: Core Graph Workflow (ESSENTIAL)
- [ ] Safe GitHub URL canonicalization & validation (`https://github.com/{owner}/{repo}`).
- [ ] Safe Git shallow clone subprocess executor with timeout, size, and depth constraints.
- [ ] Subprocess-safe Graphify CLI adapter invoking `D:\python.exe -m graphify extract <dir> --code-only`.
- [ ] Graph normalization: transform raw Graphify `graph.json` & `.graphify_analysis.json` into canonical `RepositoryGraph` (`GraphNode`, `GraphEdge`, `statistics`).
- [ ] In-memory job manager tracking real states (`queued`, `fetching`, `extracting`, `ready`, `failed`).
- [ ] FastAPI REST endpoints:
  - `GET /api/health`
  - `POST /api/repositories`
  - `GET /api/jobs/{job_id}`
  - `GET /api/repositories/{repo_id}/graph`
  - `GET /api/repositories/{repo_id}/god-nodes`
  - `GET /api/repositories/{repo_id}/path?source={src}&target={tgt}`
- [ ] Interactive React Flow 2D Canvas with custom Neo-brutalist nodes, layout, search, filter, and detail inspector.

### Priority 2: Grounded AI Issue Investigation (ESSENTIAL)
- [ ] Context package constructor: extract relevant nodes via keyword/symbol matching, graph neighborhoods, and hub ("god") nodes.
- [ ] Gemma 4 prompt engineering with strict prompt-injection boundaries (treating repository code & issue text as passive data, not commands).
- [ ] Structured JSON output validation (strict Pydantic schema: `issue_summary`, `relevant_components`, `reasoning_summary`, `confirmed_relationships`, `potential_impact`, `suggested_tests`, `investigation_steps`, `uncertainties`).
- [ ] Graph grounder & evidence validator: resolve all component IDs against actual nodes in the graph; strip or flag hallucinated symbols/files.
- [ ] Endpoints:
  - `POST /api/repositories/{repo_id}/investigations`
  - `GET /api/investigations/{investigation_id}`
- [ ] Interactive UI: Issue submission modal/drawer, live recommendation cards, path highlighting, and actionable test suggestions.

### Priority 3: Security & Reliability Hardening (ESSENTIAL)
- [ ] SSRF defense: enforce public GitHub domain whitelist (`github.com`), ban IP literals, private networks, cloud metadata endpoints, user-info strings (`user:pass@`).
- [ ] Subprocess safety: use argument arrays only (`list[str]`), set `shell=False`, no shell string interpolation.
- [ ] Path traversal defense: verify all resolved file paths stay strictly inside temporary scratch directories.
- [ ] Auto-cleanup: background context manager removing ephemeral clone directories after extraction or job termination.
- [ ] Rate limiting & resource limits (`MAX_REPOSITORY_SIZE_MB=50`, `MAX_REPOSITORY_FILES=1000`, `MAX_GRAPH_NODES=3000`, `JOB_TIMEOUT_SECONDS=120`).
- [ ] Graceful AI degradation: if `GEMINI_API_KEY` is absent or quota exceeded, allow full graph exploration and return explicit guidance instead of crashing.

### Priority 4: Neo-Brutalist Editorial Design Polish (ESSENTIAL)
- [ ] Design tokens:
  - Paper background: `#F7F3E8`
  - Near-black ink: `#222222`
  - Electric lime: `#B8F56A`
  - Cobalt blue: `#789BFF`
  - Coral: `#FF8A65`
- [ ] Strong outlines (`2px solid #222222`), crisp offset box-shadows (`3px 3px 0 #222222`), mono accents, editorial typography.
- [ ] Interactive canvas with zoom, pan, fit-to-view, symbol search, type filters, and community legend.
- [ ] Keyboard accessibility and high-contrast focus rings.

### Priority 5: Testing, Quality & Packaging (ESSENTIAL)
- [ ] Unit & integration test suite (`pytest` in backend covering URLs, adapter, graph schema, security checks, validator).
- [ ] Frontend test & production build check (`npm run build`).
- [ ] End-to-end rehearsal with a real public GitHub repository.
- [ ] Deployment artifacts (`Dockerfile`, `docker-compose.yml`, production documentation).

### Deferred Features (Post-Hackathon)
- Distributed Celery/Redis task queue.
- Neo4j / FalkorDB persistent graph database syncing.
- Multi-branch differential graph comparisons.
- Autonomous PR generation.

---

## 2. Verification Checklist
- [ ] Backend tests passing (`pytest`).
- [ ] Frontend compiles with zero type errors (`npm run build`).
- [ ] End-to-end integration tested with sample repo & real public repo.
- [ ] Security audit passes with zero critical vulnerabilities.
