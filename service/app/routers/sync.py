import asyncio
import logging

from fastapi import APIRouter, BackgroundTasks

from app.db import get_db
from app.sync.embeddings import generate_embeddings
from app.sync.riigikogu import RiigikoguSync, compute_mp_stats

router = APIRouter()
logger = logging.getLogger(__name__)

_sync_running = False


async def _run_sync():
    global _sync_running
    if _sync_running:
        return
    _sync_running = True
    try:
        db = await get_db()
        syncer = RiigikoguSync(db)
        try:
            results = await syncer.sync_all()
            logger.info(f"Sync results: {results}")

            # Compute MP stats after sync
            await compute_mp_stats(db)

            # Generate embeddings for new data
            embed_results = await generate_embeddings(db)
            logger.info(f"Embedding results: {embed_results}")
        finally:
            await syncer.close()
    except Exception as e:
        logger.error(f"Sync failed: {e}")
    finally:
        _sync_running = False


@router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks):
    if _sync_running:
        return {"status": "already_running"}
    background_tasks.add_task(_run_sync)
    return {"status": "started"}


@router.get("/sync/status")
async def sync_status():
    db = await get_db()
    types = {}
    for sync_type in ["votings", "members", "stenograms", "drafts"]:
        doc = await db.sync_progress.find_one({"_id": sync_type})
        if doc:
            doc.pop("_id", None)
            types[sync_type] = doc
        else:
            types[sync_type] = {"status": "never_run"}
    return {"running": _sync_running, "types": types}
