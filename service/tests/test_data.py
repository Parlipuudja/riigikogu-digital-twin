"""Tests for data endpoints."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _mock_db():
    db = AsyncMock()
    return db


def test_stats_endpoint(client):
    """Stats endpoint returns expected structure."""
    db = _mock_db()
    db.votings.count_documents = AsyncMock(return_value=100)
    db.mps.count_documents = AsyncMock(side_effect=[50, 45])
    db.drafts.count_documents = AsyncMock(return_value=30)
    db.votings.find_one = AsyncMock(return_value={"votingTime": "2025-01-01"})
    db.sync_progress.find_one = AsyncMock(return_value=None)

    cursor = AsyncMock()
    cursor.__aiter__ = lambda self: self
    cursor.__anext__ = AsyncMock(side_effect=StopAsyncIteration)
    db.mps.aggregate = MagicMock(return_value=cursor)

    with patch("app.routers.data.get_db", new_callable=AsyncMock, return_value=db):
        response = client.get("/stats")

    assert response.status_code == 200
    data = response.json()
    assert "totalVotings" in data
    assert "totalMPs" in data
    assert "activeMPs" in data
    assert "totalDrafts" in data


def test_mps_endpoint(client):
    """MPs endpoint returns list."""
    db = _mock_db()
    cursor = MagicMock()
    cursor.sort = MagicMock(return_value=cursor)
    cursor.skip = MagicMock(return_value=cursor)
    cursor.limit = MagicMock(return_value=cursor)
    cursor.to_list = AsyncMock(return_value=[
        {
            "slug": "kaja-kallas",
            "name": "Kaja Kallas",
            "firstName": "Kaja",
            "lastName": "Kallas",
            "party": "Reformierakond",
            "partyCode": "RE",
            "isCurrentMember": True,
            "stats": {
                "totalVotes": 100,
                "votesFor": 80,
                "votesAgainst": 10,
                "votesAbstain": 5,
                "attendance": 95.0,
                "partyAlignmentRate": 92.0,
            },
        }
    ])
    db.mps.find = MagicMock(return_value=cursor)

    with patch("app.routers.data.get_db", new_callable=AsyncMock, return_value=db):
        response = client.get("/mps")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["slug"] == "kaja-kallas"


def test_votings_endpoint(client):
    """Votings endpoint returns list."""
    db = _mock_db()
    cursor = MagicMock()
    cursor.sort = MagicMock(return_value=cursor)
    cursor.skip = MagicMock(return_value=cursor)
    cursor.limit = MagicMock(return_value=cursor)
    cursor.to_list = AsyncMock(return_value=[
        {
            "uuid": "test-uuid",
            "title": "Test voting",
            "votingTime": "2025-01-01",
            "result": "passed",
            "inFavor": 51,
            "against": 49,
            "abstained": 0,
            "absent": 1,
        }
    ])
    db.votings.find = MagicMock(return_value=cursor)

    with patch("app.routers.data.get_db", new_callable=AsyncMock, return_value=db):
        response = client.get("/votings")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["uuid"] == "test-uuid"
    assert data[0]["forCount"] == 51
