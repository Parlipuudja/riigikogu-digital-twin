"""Backtesting and accuracy endpoints."""

import logging

from fastapi import APIRouter, BackgroundTasks

from app.db import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

_backtest_running = False


async def _run_backtest():
    """Run baseline backtest, then train the model."""
    global _backtest_running
    _backtest_running = True
    try:
        db = await get_db()

        # Run baseline backtest first (establishes the floor)
        from app.prediction.baseline import run_backtest
        baseline_results = await run_backtest(db)
        logger.info(f"Baseline backtest results: {baseline_results}")

        # Train the statistical model
        from app.prediction.features import reset_training_caches
        from app.prediction.model import train_model
        reset_training_caches()
        model_results = await train_model(db)
        logger.info(f"Model training results: {model_results}")

    except Exception as e:
        logger.error(f"Backtest/training failed: {e}", exc_info=True)
    finally:
        _backtest_running = False


@router.post("/backtest")
async def trigger_backtest(background_tasks: BackgroundTasks):
    if _backtest_running:
        return {"status": "already_running"}
    background_tasks.add_task(_run_backtest)
    return {"status": "started"}


@router.get("/backtest/status")
async def backtest_status():
    db = await get_db()
    model_state = await db.model_state.find_one({"_id": "current"})
    if model_state is None:
        return {"status": "no_model", "message": "No backtest has been run yet"}

    model_state.pop("_id", None)
    return model_state


@router.get("/accuracy")
async def public_accuracy():
    db = await get_db()
    model_state = await db.model_state.find_one({"_id": "current"})
    if model_state is None:
        return {
            "overall": None,
            "baseline": None,
            "improvement": None,
            "sampleSize": 0,
            "message": "No accuracy data yet — run a backtest first",
        }

    accuracy = model_state.get("accuracy", {})
    return {
        "overall": accuracy.get("overall"),
        "baseline": model_state.get("baselineAccuracy"),
        "improvement": model_state.get("improvementOverBaseline"),
        "byParty": accuracy.get("byParty"),
        "byVoteType": accuracy.get("byVoteType"),
        "trend": model_state.get("trend", []),
        "sampleSize": model_state.get("trainingSize", 0),
        "honestPeriod": f"Post {model_state.get('version', 'unknown')} cutoff",
    }
