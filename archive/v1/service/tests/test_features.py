"""Tests for feature engineering."""

import numpy as np

from app.prediction.features import _cosine_similarity, _compute_party_cohesion


def test_cosine_similarity_identical():
    a = [1.0, 0.0, 0.0]
    b = [1.0, 0.0, 0.0]
    assert abs(_cosine_similarity(a, b) - 1.0) < 1e-6


def test_cosine_similarity_orthogonal():
    a = [1.0, 0.0, 0.0]
    b = [0.0, 1.0, 0.0]
    assert abs(_cosine_similarity(a, b)) < 1e-6


def test_cosine_similarity_opposite():
    a = [1.0, 0.0, 0.0]
    b = [-1.0, 0.0, 0.0]
    assert abs(_cosine_similarity(a, b) - (-1.0)) < 1e-6


def test_cosine_similarity_zero_vector():
    a = [0.0, 0.0, 0.0]
    b = [1.0, 0.0, 0.0]
    assert _cosine_similarity(a, b) == 0.0


def test_party_cohesion_unanimous():
    voting = {
        "voters": [
            {"memberUuid": "1", "faction": "Reform", "decision": "FOR"},
            {"memberUuid": "2", "faction": "Reform", "decision": "FOR"},
            {"memberUuid": "3", "faction": "Reform", "decision": "FOR"},
        ]
    }
    assert _compute_party_cohesion(voting, "RE") == 1.0


def test_party_cohesion_split():
    voting = {
        "voters": [
            {"memberUuid": "1", "faction": "Reform", "decision": "FOR"},
            {"memberUuid": "2", "faction": "Reform", "decision": "FOR"},
            {"memberUuid": "3", "faction": "Reform", "decision": "AGAINST"},
        ]
    }
    assert abs(_compute_party_cohesion(voting, "RE") - 2 / 3) < 1e-6


def test_party_cohesion_absent_excluded():
    voting = {
        "voters": [
            {"memberUuid": "1", "faction": "Reform", "decision": "FOR"},
            {"memberUuid": "2", "faction": "Reform", "decision": "ABSENT"},
        ]
    }
    # Only 1 non-absent vote, so cohesion = 1.0
    assert _compute_party_cohesion(voting, "RE") == 1.0


def test_party_cohesion_no_party_members():
    voting = {
        "voters": [
            {"memberUuid": "1", "faction": "Isamaa", "decision": "FOR"},
        ]
    }
    assert _compute_party_cohesion(voting, "RE") == 1.0  # Default
