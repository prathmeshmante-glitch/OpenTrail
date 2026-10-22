import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

def find_env_file() -> Optional[Path]:
    """
    Locates the project .env file using multiple search strategies:
    1. ENV_FILE environment variable (explicit override).
    2. Project root resolved relative to this module (backend/app/config.py -> project root).
    3. Current process working directory (cwd).
    4. Parent of current process working directory (e.g. if invoked from backend/).
    """
    explicit = os.getenv("ENV_FILE")
    if explicit:
        p = Path(explicit).resolve()
        if p.is_file():
            return p

    # Project root is 3 levels up: config.py -> app -> backend -> Open_Trail
    project_root_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if project_root_env.is_file():
        return project_root_env

    cwd_env = Path.cwd() / ".env"
    if cwd_env.is_file():
        return cwd_env

    parent_env = Path.cwd().parent / ".env"
    if parent_env.is_file():
        return parent_env

    return None

def _parse_and_load_env(env_path: Path):
    """Fallback .env parser if python-dotenv is unavailable."""
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key not in os.environ:
                        os.environ[key] = val
    except Exception:
        pass

def load_environment(override: bool = False) -> Optional[Path]:
    """Loads environment variables from the resolved .env file."""
    env_file = find_env_file()
    if env_file:
        try:
            from dotenv import load_dotenv
            load_dotenv(dotenv_path=env_file, override=override)
        except ImportError:
            _parse_and_load_env(env_file)
    return env_file

# Automatically resolve and load .env when config module is loaded
load_environment()

class Settings(BaseModel):
    _custom_python_executable: Optional[str] = None
    _custom_gemini_api_key: Optional[str] = None
    _custom_gemma_model: Optional[str] = None
    _custom_fallback_model: Optional[str] = None
    _custom_frontend_origin: Optional[str] = None
    _custom_storage_dir: Optional[str] = None

    @property
    def PYTHON_EXECUTABLE(self) -> str:
        return self._custom_python_executable or os.getenv("PYTHON_EXECUTABLE", r"D:\python.exe")

    @PYTHON_EXECUTABLE.setter
    def PYTHON_EXECUTABLE(self, value: str):
        self._custom_python_executable = value

    @property
    def GEMINI_API_KEY(self) -> str:
        return self._custom_gemini_api_key or os.getenv("GEMINI_API_KEY", "")

    @GEMINI_API_KEY.setter
    def GEMINI_API_KEY(self, value: str):
        self._custom_gemini_api_key = value

    @property
    def GEMMA_MODEL(self) -> str:
        return self._custom_gemma_model or os.getenv("GEMMA_MODEL", "gemma-4-26b-a4b-it")

    @GEMMA_MODEL.setter
    def GEMMA_MODEL(self, value: str):
        self._custom_gemma_model = value

    @property
    def FALLBACK_MODEL(self) -> str:
        return self._custom_fallback_model or os.getenv("FALLBACK_MODEL", "gemini-3.8-flash")

    @FALLBACK_MODEL.setter
    def FALLBACK_MODEL(self, value: str):
        self._custom_fallback_model = value

    @property
    def FRONTEND_ORIGIN(self) -> str:
        return self._custom_frontend_origin or os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

    @FRONTEND_ORIGIN.setter
    def FRONTEND_ORIGIN(self, value: str):
        self._custom_frontend_origin = value

    @property
    def MAX_REPOSITORY_SIZE_MB(self) -> int:
        return int(os.getenv("MAX_REPOSITORY_SIZE_MB", "50"))

    @property
    def MAX_REPOSITORY_FILES(self) -> int:
        return int(os.getenv("MAX_REPOSITORY_FILES", "1000"))

    @property
    def MAX_GRAPH_NODES(self) -> int:
        return int(os.getenv("MAX_GRAPH_NODES", "3000"))

    @property
    def JOB_TIMEOUT_SECONDS(self) -> int:
        return int(os.getenv("JOB_TIMEOUT_SECONDS", "120"))

    @property
    def STORAGE_DIR(self) -> str:
        default_storage = str(Path(__file__).resolve().parent.parent.parent / ".storage")
        return self._custom_storage_dir or os.getenv("STORAGE_DIR", default_storage)

    @STORAGE_DIR.setter
    def STORAGE_DIR(self, value: str):
        self._custom_storage_dir = value

    def reload(self, override: bool = False):
        """Reloads the .env file and resets manual overrides."""
        self._custom_python_executable = None
        self._custom_gemini_api_key = None
        self._custom_gemma_model = None
        self._custom_fallback_model = None
        self._custom_frontend_origin = None
        self._custom_storage_dir = None
        load_environment(override=override)

settings = Settings()
