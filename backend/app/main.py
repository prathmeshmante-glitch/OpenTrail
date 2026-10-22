import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.routes import router
from backend.app.config import settings
from backend.app.core.job_manager import job_manager

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("opentrail")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing OpenTrail backend service...")
    logger.info(f"Using Python executable: {settings.PYTHON_EXECUTABLE}")
    logger.info(f"Gemma model: {settings.GEMMA_MODEL}")
    
    # Pre-register fixture sample repo if available
    fixture_dir = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures", "sample_repo")
    fixture_graph_file = os.path.join(fixture_dir, "graphify-out", "graph.json")
    if os.path.isfile(fixture_graph_file):
        try:
            job_manager.register_existing_graph(
                repo_dir=fixture_dir,
                owner="opentrail",
                name="sample",
            )
            logger.info("Pre-registered demonstration fixture: 'opentrail/sample'")
        except Exception as e:
            logger.warning(f"Could not pre-register sample fixture: {e}")
            
    yield
    logger.info("Shutting down OpenTrail backend service...")

app = FastAPI(
    title="OpenTrail API",
    description="Navigate code. Trace impact. Contribute with confidence.",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    settings.FRONTEND_ORIGIN,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local dev and preview hosts
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
