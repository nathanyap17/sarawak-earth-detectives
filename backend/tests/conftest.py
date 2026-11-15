"""Tests never call Vertex AI or Firestore: canned agents, in-memory sessions."""
import os

os.environ["MOCK_AGENTS"] = "1"
os.environ["SESSION_BACKEND"] = "memory"

import pytest


@pytest.fixture(autouse=True, scope="session")
def _agency_docs(tmp_path_factory):
    """Desk cases, their keys and the activity log go to a temporary folder."""
    from app import docs

    docs.use(docs.FileDocs(tmp_path_factory.mktemp("agency")))
    yield
