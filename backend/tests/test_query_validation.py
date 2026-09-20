"""Tests for query validation."""


def test_empty_query_rejected(client):
    resp = client.post("/api/query", json={"query": ""})
    assert resp.status_code == 422  # Pydantic validation error


def test_missing_query_rejected(client):
    resp = client.post("/api/query", json={})
    assert resp.status_code == 422


def test_valid_query_accepted(client):
    """A valid query should return 200 (may fail during orchestration but not validation)."""
    resp = client.post("/api/query", json={"query": "What is the weather near Digha?"})
    # 200 = success, 500 = orchestration error (LLM not configured), but NOT 422
    assert resp.status_code in (200, 500)


def test_coordinates_accepted(client):
    """Query with explicit coordinates."""
    resp = client.post("/api/query", json={
        "query": "Marine conditions",
        "latitude": 21.6,
        "longitude": 87.5,
    })
    assert resp.status_code in (200, 500)


def test_invalid_latitude_rejected(client):
    resp = client.post("/api/query", json={
        "query": "test",
        "latitude": 999.0,
    })
    assert resp.status_code == 422
