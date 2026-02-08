"""Tests for health endpoint."""

import pytest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_returns_ok(client):
    """Health endpoint returns a valid response structure."""
    with patch("app.routers.health.check_db", new_callable=AsyncMock, return_value=True):
        with patch("app.routers.health.get_db", new_callable=AsyncMock) as mock_db:
            db = AsyncMock()
            db.sync_progress.find_one = AsyncMock(return_value=None)
            mock_db.return_value = db
            response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["db"] == "connected"
    assert "uptime_seconds" in data


def test_health_degraded_when_db_down(client):
    """Health endpoint returns degraded when DB is unreachable."""
    with patch("app.routers.health.check_db", new_callable=AsyncMock, return_value=False):
        response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["db"] == "disconnected"
