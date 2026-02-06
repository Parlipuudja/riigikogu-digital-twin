"""
Confidence calibration.

Platt scaling (sigmoid) or isotonic regression so that
"90% confident" means correct 90% of the time.
"""

import logging

import numpy as np
from sklearn.calibration import CalibratedClassifierCV

logger = logging.getLogger(__name__)


def calibrate_model(model, X_val, y_val, method: str = "sigmoid"):
    """
    Wrap a model with probability calibration.

    Args:
        model: Trained sklearn model
        X_val: Validation features
        y_val: Validation labels
        method: "sigmoid" (Platt scaling) or "isotonic"

    Returns:
        Calibrated model
    """
    if len(X_val) < 20:
        logger.warning("Not enough validation data for calibration, returning uncalibrated model")
        return model

    try:
        calibrated = CalibratedClassifierCV(model, method=method, cv="prefit")
        calibrated.fit(X_val, y_val)
        logger.info(f"Model calibrated with {method} method on {len(X_val)} samples")
        return calibrated
    except Exception as e:
        logger.error(f"Calibration failed with {method}: {e}")
        if method == "sigmoid":
            logger.info("Falling back to isotonic calibration")
            return calibrate_model(model, X_val, y_val, method="isotonic")
        return model


def brier_score(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """Compute Brier score — lower is better."""
    return float(np.mean((y_prob - y_true) ** 2))


def reliability_diagram_data(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 10,
) -> list[dict]:
    """
    Compute data for a reliability diagram.

    Returns list of {bin_center, observed_frequency, count} dicts.
    """
    bins = np.linspace(0, 1, n_bins + 1)
    result = []

    for i in range(n_bins):
        mask = (y_prob >= bins[i]) & (y_prob < bins[i + 1])
        count = int(mask.sum())
        if count > 0:
            observed = float(y_true[mask].mean())
        else:
            observed = None

        result.append({
            "bin_center": round((bins[i] + bins[i + 1]) / 2, 2),
            "observed_frequency": round(observed, 3) if observed is not None else None,
            "count": count,
        })

    return result
