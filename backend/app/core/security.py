import os
import re
from typing import Tuple
from urllib.parse import urlparse

# Strict regex for GitHub repository URLs
# Allows https://github.com/owner/repo or https://github.com/owner/repo.git
GITHUB_URL_REGEX = re.compile(
    r"^https://github\.com/(?P<owner>[a-zA-Z0-9_.-]+)/(?P<repo>[a-zA-Z0-9_.-]+?)(?:\.git)?/?$"
)

# Character validation for owner and repo names
VALID_NAME_REGEX = re.compile(r"^[a-zA-Z0-9_.-]+$")

class SecurityValidationError(ValueError):
    """Raised when an input violates security boundaries or validation rules."""
    pass

def validate_and_canonicalize_github_url(raw_url: str) -> Tuple[str, str, str]:
    """
    Validates a public GitHub repository URL against strict SSRF and injection boundaries.
    
    Returns:
        canonical_url: str (https://github.com/owner/repo)
        owner: str
        repo: str
    
    Raises:
        SecurityValidationError: if validation fails.
    """
    if not raw_url or not isinstance(raw_url, str):
        raise SecurityValidationError("Repository URL must be a non-empty string.")
    
    clean_url = raw_url.strip()
    
    # Check length
    if len(clean_url) > 255:
        raise SecurityValidationError("Repository URL exceeds maximum allowed length.")
        
    try:
        parsed = urlparse(clean_url)
    except Exception as e:
        raise SecurityValidationError(f"Malformed URL: {e}")
        
    # Enforce HTTPS scheme
    if parsed.scheme.lower() != "https":
        raise SecurityValidationError("Only HTTPS scheme is supported (e.g. https://github.com/owner/repo).")
        
    # Reject embedded credentials (user:pass@)
    if parsed.username or parsed.password:
        raise SecurityValidationError("Embedded credentials in URLs are strictly rejected.")
        
    # Reject non-standard ports
    if parsed.port and parsed.port != 443:
        raise SecurityValidationError("Non-standard network ports are prohibited.")
        
    # Host must be strictly 'github.com'
    hostname = (parsed.hostname or "").lower()
    if hostname != "github.com":
        raise SecurityValidationError("Only public repositories on 'github.com' are supported.")
        
    # Match path structure
    match = GITHUB_URL_REGEX.match(clean_url)
    if not match:
        raise SecurityValidationError(
            "Invalid GitHub repository URL format. Expected: https://github.com/owner/repository"
        )
        
    owner = match.group("owner")
    repo = match.group("repo")
    
    # Reject path traversal tokens and invalid characters
    if ".." in owner or ".." in repo:
        raise SecurityValidationError("Path traversal sequences are prohibited.")
        
    if not VALID_NAME_REGEX.match(owner) or not VALID_NAME_REGEX.match(repo):
        raise SecurityValidationError("Repository owner and name contain invalid characters.")
        
    # Reject reserved or internal names
    banned = {"admin", "api", "internal", "root", "localhost"}
    if owner.lower() in banned or repo.lower() in banned:
        raise SecurityValidationError(f"Repository identifier '{owner}/{repo}' is reserved or disallowed.")
        
    canonical_url = f"https://github.com/{owner}/{repo}"
    return canonical_url, owner, repo

def is_safe_path(base_dir: str, target_path: str) -> bool:
    """
    Ensures that target_path resolves strictly within base_dir to prevent directory traversal.
    """
    base = os.path.realpath(base_dir)
    target = os.path.realpath(os.path.join(base_dir, target_path))
    return os.path.commonpath([base]) == os.path.commonpath([base, target])
