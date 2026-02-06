"""
Diagnose prediction failures.

Categorize each error to drive different correction responses:
- free_vote: party cohesion < 60% on that voting
- party_split: >30% of party voted against majority
- stale_profile: MP accuracy dropped >15%
- coalition_shift: party voting correlation changed
- feature_gap: high-confidence wrong prediction
"""

import logging
from collections import Counter
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.sync.riigikogu import extract_party_code

logger = logging.getLogger(__name__)


async def diagnose_errors(db: AsyncIOMotorDatabase) -> dict:
    """Categorize all undiagnosed prediction failures."""
    # Find incorrect, resolved predictions
    cursor = db.prediction_log.find({"correct": False, "resolvedAt": {"$ne": None}})
    errors = await cursor.to_list(None)

    if not errors:
        logger.info("No errors to diagnose")
        return {"total": 0}

    categories = {
        "free_vote": 0,
        "party_split": 0,
        "stale_profile": 0,
        "coalition_shift": 0,
        "feature_gap": 0,
    }

    for error in errors:
        category = await _categorize_error(db, error)
        categories[category] = categories.get(category, 0) + 1

    # Update model_state
    await db.model_state.update_one(
        {"_id": "current"},
        {"$set": {
            "errorCategories": categories,
            "lastDiagnosedAt": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    logger.info(f"Diagnosed {len(errors)} errors: {categories}")
    return {"total": len(errors), "categories": categories}


async def _categorize_error(db: AsyncIOMotorDatabase, error: dict) -> str:
    """Categorize a single prediction error."""
    confidence = error.get("confidence", 0)

    # High-confidence wrong = feature gap
    if confidence > 0.85:
        return "feature_gap"

    # Check the actual voting for party cohesion
    mp_uuid = error.get("mpUuid")
    if not mp_uuid:
        return "feature_gap"

    # Find the voting that resolved this prediction
    voting = None
    if error.get("draftUuid"):
        voting = await db.votings.find_one({"relatedDraftUuid": error["draftUuid"]})

    if not voting:
        return "feature_gap"

    # Get MP's party
    mp = await db.mps.find_one({"memberUuid": mp_uuid}, {"partyCode": 1})
    party_code = mp.get("partyCode", "FR") if mp else "FR"

    # Compute party cohesion on this voting
    party_decisions = []
    for voter in voting.get("voters", []):
        if extract_party_code(voter.get("faction")) == party_code:
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.append(decision)

    if not party_decisions:
        return "feature_gap"

    majority = Counter(party_decisions).most_common(1)[0][0]
    cohesion = sum(1 for d in party_decisions if d == majority) / len(party_decisions)

    # Free vote: party itself was split
    if cohesion < 0.6:
        return "free_vote"

    # Party split: significant minority
    if cohesion < 0.7:
        return "party_split"

    # Check if MP's accuracy has been declining
    mp_slug = error.get("mpSlug")
    if mp_slug:
        mp_doc = await db.mps.find_one({"slug": mp_slug}, {"backtest": 1})
        if mp_doc and mp_doc.get("backtest", {}).get("accuracy", 100) < 70:
            return "stale_profile"

    return "feature_gap"
