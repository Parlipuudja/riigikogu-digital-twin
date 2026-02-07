"""Parliament simulation — predict all MPs on a bill."""

import asyncio
import logging
import uuid as uuid_lib
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks

from app.db import get_db
from app.models import BillInput

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory simulation state (simple for now)
_simulations: dict[str, dict] = {}


async def _run_simulation(sim_id: str, bill: BillInput):
    db = await get_db()
    mps = await db.mps.find(
        {"isCurrentMember": True},
        {"slug": 1, "name": 1, "partyCode": 1, "memberUuid": 1, "party": 1, "stats": 1},
    ).to_list(None)

    results = []
    _simulations[sim_id]["progress"] = {"total": len(mps), "completed": 0}

    # Generate bill embedding once for all predictions
    bill_embedding = None
    try:
        from app.sync.embeddings import embed_texts
        text = bill.title
        if bill.description:
            text += " " + bill.description
        embeddings = await embed_texts([text])
        if embeddings and len(embeddings) > 0:
            bill_embedding = embeddings[0]
    except Exception as e:
        logger.warning(f"Bill embedding for simulation failed: {e}")

    from app.prediction.model import predict

    for mp in mps:
        try:
            prediction = await predict(db, mp, bill, bill_embedding=bill_embedding)
            results.append({
                "slug": mp["slug"],
                "name": mp.get("name", ""),
                "partyCode": mp.get("partyCode", "FR"),
                "prediction": prediction["prediction"],
                "confidence": prediction["confidence"],
            })
        except Exception as e:
            logger.error(f"Simulation failed for {mp.get('slug')}: {e}")

        _simulations[sim_id]["progress"]["completed"] = len(results)

    # Tally
    tally = {"FOR": 0, "AGAINST": 0, "ABSTAIN": 0, "ABSENT": 0}
    for r in results:
        tally[r["prediction"]] = tally.get(r["prediction"], 0) + 1

    _simulations[sim_id]["status"] = "completed"
    _simulations[sim_id]["result"] = {
        "tally": tally,
        "passed": tally["FOR"] >= 51,
        "votes": results,
    }


@router.post("/simulate")
async def start_simulation(bill: BillInput, background_tasks: BackgroundTasks):
    sim_id = str(uuid_lib.uuid4())[:8]
    _simulations[sim_id] = {
        "status": "running",
        "bill": bill.model_dump(),
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    background_tasks.add_task(_run_simulation, sim_id, bill)
    return {"jobId": sim_id, "status": "started"}


@router.get("/simulate/{sim_id}")
async def simulation_status(sim_id: str):
    sim = _simulations.get(sim_id)
    if not sim:
        return {"error": "Simulation not found"}
    return sim
