import os
import shutil
import stat
import subprocess
from typing import Tuple
from backend.app.config import settings

class GitServiceError(RuntimeError):
    """Raised when repository cloning or inspection fails."""
    pass

def _remove_readonly(func, path, exc_info):
    """Helper to handle Windows read-only file removal (common in .git directory)."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass

def safe_remove_tree(dir_path: str):
    """Safely removes a directory tree on Windows or Linux."""
    if os.path.exists(dir_path):
        try:
            shutil.rmtree(dir_path, onerror=_remove_readonly)
        except Exception as e:
            # Fallback if shutil.rmtree encounters lock
            pass

def clone_public_repository(canonical_url: str, destination_dir: str, timeout_seconds: int = 60) -> Tuple[int, int]:
    """
    Safely clones a public GitHub repository using a shallow, single-branch clone.
    
    Args:
        canonical_url: Verified URL (https://github.com/owner/repo)
        destination_dir: Empty target directory
        timeout_seconds: Timeout for git clone subprocess
        
    Returns:
        total_files: int
        total_size_mb: int
        
    Raises:
        GitServiceError: if clone fails, times out, or exceeds resource limits.
    """
    os.makedirs(destination_dir, exist_ok=True)
    
    # Strictly array-based argument list, shell=False
    cmd = [
        "git",
        "clone",
        "--depth", "1",
        "--no-tags",
        "--single-branch",
        canonical_url,
        destination_dir,
    ]
    
    # Disable interactive terminal prompts and ambient credentials
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_ASKPASS"] = "echo"
    
    try:
        result = subprocess.run(
            cmd,
            env=env,
            shell=False,
            timeout=timeout_seconds,
            capture_output=True,
            text=True,
        )
    except subprocess.TimeoutExpired:
        safe_remove_tree(destination_dir)
        raise GitServiceError(f"Repository acquisition timed out after {timeout_seconds} seconds.")
    except Exception as e:
        safe_remove_tree(destination_dir)
        raise GitServiceError(f"Failed to execute git clone: {e}")
        
    if result.returncode != 0:
        safe_remove_tree(destination_dir)
        err_msg = result.stderr.strip()
        # Sanitize error message to prevent internal disclosure
        if "Authentication failed" in err_msg or "Repository not found" in err_msg:
            raise GitServiceError("Repository not found or is private. Only public repositories are supported.")
        raise GitServiceError(f"Git clone failed: {err_msg[:200]}")
        
    # Check repository size and file counts to prevent resource exhaustion
    total_files = 0
    total_bytes = 0
    for root, dirs, files in os.walk(destination_dir):
        # Exclude .git folder from file counts
        if ".git" in dirs:
            dirs.remove(".git")
        total_files += len(files)
        for f in files:
            fp = os.path.join(root, f)
            try:
                total_bytes += os.path.getsize(fp)
            except OSError:
                pass
                
    total_size_mb = total_bytes / (1024 * 1024)
    
    if total_size_mb > settings.MAX_REPOSITORY_SIZE_MB:
        safe_remove_tree(destination_dir)
        raise GitServiceError(
            f"Repository size ({total_size_mb:.1f} MB) exceeds maximum allowed limit ({settings.MAX_REPOSITORY_SIZE_MB} MB)."
        )
        
    if total_files > settings.MAX_REPOSITORY_FILES:
        safe_remove_tree(destination_dir)
        raise GitServiceError(
            f"Repository file count ({total_files}) exceeds maximum allowed limit ({settings.MAX_REPOSITORY_FILES})."
        )
        
    return total_files, int(total_size_mb)
