import os
import sys
import pytest

# Ensure Open_Trail root is on sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

@pytest.fixture(scope="session")
def fixture_repo_dir():
    return os.path.join(os.path.dirname(__file__), "fixtures", "sample_repo")
