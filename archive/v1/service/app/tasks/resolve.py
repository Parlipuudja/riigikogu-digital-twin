"""
Resolve predictions against actual votes.

When a prediction was made for a bill and the vote has now occurred,
match them and record whether the prediction was correct.
"""

import logging
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def resolve_predictions(db: AsyncIOMotorDatabase) -> dict:
    """Match unresolved predictions against actual voting results."""
    # Find unresolved predictions
    cursor = db.prediction_log.find({"actual": None})
    unresolved = await cursor.to_list(None)

    if not unresolved:
        return {"resolved": 0, "total_unresolved": 0}

    resolved_count = 0

    for pred in unresolved:
        mp_uuid = pred.get("mpUuid")
        draft_uuid = pred.get("draftUuid")
        bill_hash = pred.get("billHash")

        if not mp_uuid:
            continue

        # Strategy 1: Match by draft UUID (most reliable)
        actual_decision = None
        if draft_uuid:
            voting = await db.votings.find_one(
                {"relatedDraftUuid": draft_uuid, "voters.memberUuid": mp_uuid},
                {"voters": 1},
            )
            if voting:
                actual_decision = _find_mp_decision(voting, mp_uuid)

        # Strategy 2: Match by bill hash (if title matches exactly)
        if actual_decision is None and bill_hash:
            # Look for votings synced after the prediction was made
            import hashlib
            cursor = db.votings.find(
                {
                    "voters.memberUuid": mp_uuid,
                    "syncedAt": {"$gte": pred.get("predictedAt", datetime.min)},
                },
                {"title": 1, "description": 1, "voters": 1},
            ).sort("votingTime", -1).limit(50)

            async for voting in cursor:
                title = voting.get("title", "")
                desc = voting.get("description", "")
                text = "|".join(filter(None, [title, desc]))
                voting_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
                if voting_hash == bill_hash:
                    actual_decision = _find_mp_decision(voting, mp_uuid)
                    break

        if actual_decision:
            is_correct = actual_decision == pred.get("predicted")
            await db.prediction_log.update_one(
                {"_id": pred["_id"]},
                {"$set": {
                    "actual": actual_decision,
                    "correct": is_correct,
                    "resolvedAt": datetime.now(timezone.utc),
                }},
            )
            resolved_count += 1

    logger.info(f"Resolved {resolved_count}/{len(unresolved)} predictions")
    return {"resolved": resolved_count, "total_unresolved": len(unresolved)}


def _find_mp_decision(voting: dict, mp_uuid: str) -> str | None:
    """Find a specific MP's decision in a voting."""
    for voter in voting.get("voters", []):
        if voter.get("memberUuid") == mp_uuid:
            return voter.get("decision")
    return None
