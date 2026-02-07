"""Parliament simulation — predict all MPs on a bill."""

import asyncio
import logging
import uuid as uuid_lib
from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks

from app.db import get_db
from app.models import BillInput
from app.sync.riigikogu import extract_party_code

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory simulation state (simple for now)
_simulations: dict[str, dict] = {}


async def _precompute_party_majorities(db) -> dict[str, str]:
    """Precompute the majority decision for each party from recent votes."""
    cursor = db.votings.find(
        {}, {"voters": 1},
    ).sort("votingTime", -1).limit(200)

    party_votes: dict[str, list[str]] = {}
    async for voting in cursor:
        for voter in voting.get("voters", []):
            party = extract_party_code(voter.get("faction"))
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_votes.setdefault(party, []).append(decision)

    return {
        party: Counter(votes).most_common(1)[0][0]
        for party, votes in party_votes.items()
        if votes
    }


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

    from app.prediction.model import predict, _model

    # If no trained model, use fast batch baseline instead of per-MP DB queries
    if _model is None:
        party_majorities = await _precompute_party_majorities(db)
        for mp in mps:
            party = mp.get("partyCode", "FR")
            majority = party_majorities.get(party, "FOR")
            alignment = mp.get("stats", {}).get("partyAlignmentRate", 85.0)
            confidence = round(min(alignment / 100.0, 0.99), 3) if alignment else 0.85
            results.append({
                "slug": mp["slug"],
                "name": mp.get("name", ""),
                "partyCode": party,
                "prediction": majority,
                "confidence": confidence,
            })
            _simulations[sim_id]["progress"]["completed"] = len(results)
    else:
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

    outcome = "PASSED" if tally["FOR"] >= 51 else "REJECTED"
    _simulations[sim_id]["status"] = "complete"
    _simulations[sim_id]["summary"] = {
        "for": tally["FOR"],
        "against": tally["AGAINST"],
        "abstain": tally["ABSTAIN"],
        "absent": tally["ABSENT"],
        "predictedOutcome": outcome,
    }
    _simulations[sim_id]["predictions"] = results


@router.post("/simulate")
async def start_simulation(bill: BillInput, background_tasks: BackgroundTasks):
    sim_id = str(uuid_lib.uuid4())[:8]
    _simulations[sim_id] = {
        "id": sim_id,
        "status": "running",
        "bill": bill.model_dump(),
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    background_tasks.add_task(_run_simulation, sim_id, bill)
    return {"id": sim_id, "status": "running"}


@router.get("/simulate/{sim_id}")
async def simulation_status(sim_id: str):
    sim = _simulations.get(sim_id)
    if not sim:
        return {"error": "Simulation not found"}
    return sim
