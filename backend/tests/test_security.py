import pytest
from backend.app.core.security import (
    SecurityValidationError,
    is_safe_path,
    validate_and_canonicalize_github_url,
)

def test_valid_github_urls():
    url, owner, repo = validate_and_canonicalize_github_url("https://github.com/fastapi/fastapi")
    assert url == "https://github.com/fastapi/fastapi"
    assert owner == "fastapi"
    assert repo == "fastapi"

    url, owner, repo = validate_and_canonicalize_github_url("https://github.com/torvalds/linux.git")
    assert url == "https://github.com/torvalds/linux"
    assert owner == "torvalds"
    assert repo == "linux"

    url, owner, repo = validate_and_canonicalize_github_url("https://github.com/facebook/react/")
    assert url == "https://github.com/facebook/react"
    assert owner == "facebook"
    assert repo == "react"

def test_reject_non_https():
    with pytest.raises(SecurityValidationError, match="Only HTTPS"):
        validate_and_canonicalize_github_url("http://github.com/owner/repo")
    with pytest.raises(SecurityValidationError, match="Only HTTPS"):
        validate_and_canonicalize_github_url("git@github.com:owner/repo.git")

def test_reject_ssrf_and_other_hosts():
    with pytest.raises(SecurityValidationError, match="Only public repositories on 'github.com'"):
        validate_and_canonicalize_github_url("https://gitlab.com/owner/repo")
    with pytest.raises(SecurityValidationError, match="Only public repositories on 'github.com'"):
        validate_and_canonicalize_github_url("https://127.0.0.1/owner/repo")
    with pytest.raises(SecurityValidationError, match="Only public repositories on 'github.com'"):
        validate_and_canonicalize_github_url("https://169.254.169.254/latest/meta-data")

def test_reject_credentials():
    with pytest.raises(SecurityValidationError, match="Embedded credentials"):
        validate_and_canonicalize_github_url("https://user:password@github.com/owner/repo")

def test_reject_path_traversal():
    with pytest.raises(SecurityValidationError):
        validate_and_canonicalize_github_url("https://github.com/owner/../repo")

def test_is_safe_path():
    base = r"C:\tmp\workspace"
    assert is_safe_path(base, "src/main.py")
    assert is_safe_path(base, "components/node.tsx")
    assert not is_safe_path(base, "../../../windows/system32")
