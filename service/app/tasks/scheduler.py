"""
APScheduler: Phase 1 heartbeats.

Tasks:
- Metabolic: sync_data, generate_embeddings, compute_mp_stats
- Health check
- Cache pruning
"""

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


async def _health_check():
    from app.db import check_db

    ok = await check_db()
    if not ok:
        logger.error("Health check FAILED: database unreachable")


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


def start_scheduler():
    """Start Phase 1 scheduled tasks."""
    # Metabolic loop
    scheduler.add_job(_sync_data, IntervalTrigger(hours=settings.sync_interval_hours),
                      id="sync_data", replace_existing=True)
    scheduler.add_job(_health_check, IntervalTrigger(minutes=5),
                      id="health_check", replace_existing=True)

    # Cache pruning
    scheduler.add_job(_prune_cache, CronTrigger(hour=2),
                      id="prune_cache", replace_existing=True)

    scheduler.start()
    logger.info("Scheduler started with Phase 1 loops")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
