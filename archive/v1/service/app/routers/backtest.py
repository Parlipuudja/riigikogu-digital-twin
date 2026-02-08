"""Backtesting and accuracy endpoints."""

import logging

from fastapi import APIRouter, BackgroundTasks

from app.db import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

_backtest_running = False


async def _run_backtest():
    """Run baseline backtest, train ML model, then hybrid backtest (best wins)."""
    global _backtest_running
    _backtest_running = True
    try:
        db = await get_db()

        # 1. Run baseline backtest (establishes the accuracy floor)
        from app.prediction.baseline import run_backtest, run_hybrid_backtest
        baseline_results = await run_backtest(db)
        logger.info(f"Baseline backtest results: {baseline_results}")

        # 2. Train the statistical model (won't overwrite if worse than current best)
        from app.prediction.features import reset_training_caches
        from app.prediction.model import train_model
        reset_training_caches()
        model_results = await train_model(db)
        logger.info(f"Model training results: {model_results}")

        # 3. Run hybrid backtest last (overwrites version if it beats everything)
        hybrid_results = await run_hybrid_backtest(db)
        logger.info(f"Hybrid backtest results: {hybrid_results.get('overall', 'N/A')}%")

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


@router.post("/detect")
async def trigger_detect():
    from app.tasks.detect import detect_anomalies
    db = await get_db()
    result = await detect_anomalies(db)
    return result


@router.get("/detections")
async def get_detections():
    db = await get_db()
    model_state = await db.model_state.find_one({"_id": "current"})
    if not model_state:
        return {"detections": [], "lastDetectionAt": None}
    return {
        "detections": model_state.get("detections", []),
        "lastDetectionAt": model_state.get("lastDetectionAt"),
    }


# Note: /accuracy is served from data.py router (included first in main.py)
