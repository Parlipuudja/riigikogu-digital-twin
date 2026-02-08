"""Tests for prediction models and calibration."""

import numpy as np

from app.prediction.calibrate import brier_score, reliability_diagram_data


def test_brier_score_perfect():
    y_true = np.array([1, 0, 1, 0])
    y_prob = np.array([1.0, 0.0, 1.0, 0.0])
    assert brier_score(y_true, y_prob) == 0.0


def test_brier_score_worst():
    y_true = np.array([1, 0, 1, 0])
    y_prob = np.array([0.0, 1.0, 0.0, 1.0])
    assert brier_score(y_true, y_prob) == 1.0


def test_brier_score_midpoint():
    y_true = np.array([1, 0])
    y_prob = np.array([0.5, 0.5])
    assert abs(brier_score(y_true, y_prob) - 0.25) < 1e-6


def test_reliability_diagram_data():
    y_true = np.array([1, 1, 0, 0, 1])
    y_prob = np.array([0.9, 0.8, 0.2, 0.1, 0.7])
    data = reliability_diagram_data(y_true, y_prob, n_bins=5)
    assert len(data) == 5
    assert all("bin_center" in d for d in data)
    assert all("count" in d for d in data)


def test_reliability_diagram_empty_bins():
    y_true = np.array([1, 1])
    y_prob = np.array([0.95, 0.96])
    data = reliability_diagram_data(y_true, y_prob, n_bins=10)
    # Most bins should be empty
    non_empty = [d for d in data if d["count"] > 0]
    assert len(non_empty) <= 2
