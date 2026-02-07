import time

from fastapi import APIRouter

from app.db import check_db, get_db

router = APIRouter()

_start_time = time.time()


@router.get("/health")
async def health():
    db_ok = await check_db()
    uptime = int(time.time() - _start_time)

    # Get live model version from in-memory state
    from app.prediction.model import get_model_version
    live_version = get_model_version()

    result = {
        "status": "ok" if db_ok else "degraded",
        "db": "connected" if db_ok else "disconnected",
        "uptime_seconds": uptime,
        "model_version": live_version,
    }

    # Add accuracy and sync info if available
    try:
        db = await get_db()
        model_state = await db.model_state.find_one({"_id": "current"})
        if model_state:
            result["accuracy"] = model_state.get("accuracy", {}).get("overall")
            # Show DB version if in-memory model is baseline or untrained
            db_version = model_state.get("version")
            if db_version and live_version in ("untrained", "baseline-v1"):
                result["model_version"] = db_version

        sync_votings = await db.sync_progress.find_one({"_id": "votings"})
        if sync_votings:
            result["last_sync"] = str(sync_votings.get("lastRunAt"))
    except Exception:
        pass

    return result
