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


@router.post("/diagnose")
async def trigger_diagnose():
    from app.tasks.diagnose import diagnose_errors
    db = await get_db()
    result = await diagnose_errors(db)
    return result


@router.post("/plan")
async def trigger_plan():
    from app.tasks.plan import plan_improvements
    db = await get_db()
    result = await plan_improvements(db)
    return result


# Note: /accuracy is served from data.py router (included first in main.py)
