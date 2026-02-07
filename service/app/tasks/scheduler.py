"""
APScheduler: the heartbeats of the autonomy loops.

Each task maps to a loop from SOUL.md:
- Metabolic: sync_data, generate_embeddings, health_check
- Learning: resolve_predictions, backtest, retrain_model
- Diagnostic: diagnose_errors
- Planning: plan_improvements
- Pruning: regenerate_stale_profiles, prune_cache
- Operator: operator_check
"""

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _sync_data():
    from app.db import get_db
    from app.sync.embeddings import generate_embeddings
    from app.sync.riigikogu import RiigikoguSync, compute_mp_stats

    logger.info("Scheduled sync starting...")
    db = await get_db()
    syncer = RiigikoguSync(db)
    try:
        await syncer.sync_all()
        await compute_mp_stats(db)
        await generate_embeddings(db)
    except Exception as e:
        logger.error(f"Scheduled sync failed: {e}")
    finally:
        await syncer.close()


async def _resolve_predictions():
    from app.db import get_db
    from app.tasks.resolve import resolve_predictions

    db = await get_db()
    await resolve_predictions(db)


async def _backtest():
    from app.db import get_db
    from app.prediction.baseline import run_backtest

    db = await get_db()
    await run_backtest(db)


async def _retrain_model():
    from app.db import get_db
    from app.prediction.features import reset_training_caches
    from app.prediction.model import train_model

    logger.info("Retraining model...")
    db = await get_db()
    reset_training_caches()
    result = await train_model(db)
    logger.info(f"Model retrain result: {result}")


async def _diagnose_errors():
    from app.db import get_db
    from app.tasks.diagnose import diagnose_errors

    db = await get_db()
    await diagnose_errors(db)


async def _plan_improvements():
    from app.db import get_db
    from app.tasks.plan import plan_improvements

    db = await get_db()
    await plan_improvements(db)


async def _operator_check():
    if not settings.operator_enabled:
        return
    from app.db import get_db
    from app.tasks.operator import check_and_launch

    db = await get_db()
    await check_and_launch(db)


async def _health_check():
    from app.db import check_db

    ok = await check_db()
    if not ok:
        logger.error("Health check FAILED: database unreachable")


async def _regenerate_stale_profiles():
    """Regenerate MP profiles where accuracy has dropped below threshold."""
    from app.db import get_db

    db = await get_db()
    model_state = await db.model_state.find_one({"_id": "current"})
    if not model_state:
        return

    baseline = model_state.get("baselineAccuracy", 85)
    threshold = baseline - 5

    # Find MPs with low accuracy in backtest
    stale = await db.mps.find(
        {"backtest.accuracy": {"$lt": threshold, "$exists": True}},
        {"slug": 1, "backtest.accuracy": 1},
    ).to_list(None)

    if stale:
        slugs = [m["slug"] for m in stale]
        logger.info(f"Found {len(stale)} stale MP profiles: {slugs[:5]}")
        # Mark them for regeneration
        await db.mps.update_many(
            {"slug": {"$in": slugs}},
            {"$set": {"instruction.stale": True}},
        )


async def _prune_cache():
    """Explicit cache pruning (supplements TTL index)."""
    from datetime import datetime, timezone
    from app.db import get_db

    db = await get_db()
    result = await db.prediction_cache.delete_many(
        {"expiresAt": {"$lt": datetime.now(timezone.utc)}}
    )
    if result.deleted_count > 0:
        logger.info(f"Pruned {result.deleted_count} expired cache entries")


async def _startup_train():
    """Train model on startup if not yet trained (non-blocking)."""
    await asyncio.sleep(10)  # Let the app fully start
    from app.prediction.model import get_model_version
    if get_model_version() == "untrained":
        logger.info("No trained model found, starting initial training...")
        asyncio.create_task(_retrain_model())


def start_scheduler():
    """Start all scheduled tasks."""
    # Metabolic loop
    scheduler.add_job(_sync_data, IntervalTrigger(hours=settings.sync_interval_hours),
                      id="sync_data", replace_existing=True)
    scheduler.add_job(_health_check, IntervalTrigger(minutes=5),
                      id="health_check", replace_existing=True)

    # Learning loop
    scheduler.add_job(_resolve_predictions, IntervalTrigger(hours=settings.sync_interval_hours, minutes=30),
                      id="resolve_predictions", replace_existing=True)
    scheduler.add_job(_backtest, CronTrigger(day_of_week="sun", hour=3),
                      id="backtest", replace_existing=True)
    scheduler.add_job(_retrain_model, CronTrigger(day_of_week="sun", hour=5),
                      id="retrain_model", replace_existing=True)

    # Diagnostic loop
    scheduler.add_job(_diagnose_errors, CronTrigger(day_of_week="sun", hour=6),
                      id="diagnose_errors", replace_existing=True)

    # Planning loop
    scheduler.add_job(_plan_improvements, CronTrigger(day_of_week="sun", hour=7),
                      id="plan_improvements", replace_existing=True)

    # Pruning loop
    scheduler.add_job(_regenerate_stale_profiles, CronTrigger(day_of_week="sun", hour=4),
                      id="regenerate_stale_profiles", replace_existing=True)
    scheduler.add_job(_prune_cache, CronTrigger(hour=2),
                      id="prune_cache", replace_existing=True)

    # Operator loop
    scheduler.add_job(_operator_check, CronTrigger(day_of_week="sun", hour=8),
                      id="operator_check", replace_existing=True)

    # Initial model training on startup
    scheduler.add_job(_startup_train, "date", id="startup_train", replace_existing=True)

    scheduler.start()
    logger.info("Scheduler started with all autonomy loops")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
