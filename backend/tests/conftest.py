"""Shared test fixtures."""

from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient

# Set test environment before importing app
os.environ.setdefault("LLM_PROVIDER", "huggingface")
os.environ.setdefault("HF_MODEL", "test-model")
os.environ.setdefault("HF_TOKEN", "")

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)
