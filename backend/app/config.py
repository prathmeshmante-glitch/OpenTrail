import os
from pydantic import BaseModel

class Settings(BaseModel):
    # Python executable for Graphify execution
    PYTHON_EXECUTABLE: str = os.getenv("PYTHON_EXECUTABLE", r"D:\python.exe")
    
    # Gemma / Gemini credentials
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMMA_MODEL: str = os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it")
    FALLBACK_MODEL: str = os.getenv("FALLBACK_MODEL", "gemini-2.5-flash")
    
    # CORS
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    
    # Resource & Processing Limits
    MAX_REPOSITORY_SIZE_MB: int = int(os.getenv("MAX_REPOSITORY_SIZE_MB", "50"))
    MAX_REPOSITORY_FILES: int = int(os.getenv("MAX_REPOSITORY_FILES", "1000"))
    MAX_GRAPH_NODES: int = int(os.getenv("MAX_GRAPH_NODES", "3000"))
    JOB_TIMEOUT_SECONDS: int = int(os.getenv("JOB_TIMEOUT_SECONDS", "120"))
    
    # Storage
    STORAGE_DIR: str = os.getenv("STORAGE_DIR", r"C:\Users\DELL\Desktop\Open_Trail\.storage")

settings = Settings()
