import time

from fastapi import APIRouter

from app.db import check_db, get_db

router = APIRouter()

_start_time = time.time()


@router.get("/health")
async def health():
    db_ok = await check_db()
    uptime = int(time.time() - _start_time)

    result = {
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "disconnected",
        "uptime_seconds": uptime,
    }

    try:
        db = await get_db()
        sync_votings = await db.sync_progress.find_one({"_id": "votings"})
        if sync_votings:
            result["last_sync"] = str(sync_votings.get("lastRunAt"))
    except Exception:
        pass

    return result
