"""Prediction endpoint — Phase 2 will fill in the real model."""

import hashlib
import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from app.db import get_db
from app.models import BillInput, PredictionResponse, VoteDecision

router = APIRouter()
logger = logging.getLogger(__name__)


def _bill_hash(bill: BillInput) -> str:
    text = "|".join(filter(None, [bill.title, bill.description, bill.fullText]))
    return hashlib.sha256(text.encode()).hexdigest()[:16]


@router.post("/predict/{slug}")
async def predict_mp(slug: str, bill: BillInput):
    db = await get_db()
    mp = await db.mps.find_one({"slug": slug})
    if mp is None:
        return {"error": "MP not found"}

    bill_hash = _bill_hash(bill)

    # Check cache
    cached = await db.prediction_cache.find_one({"cacheKey": f"{slug}:{bill_hash}"})
    if cached:
        pred = cached["prediction"]
        pred["cached"] = True
        return pred

    # Phase 2 will replace this with the real statistical model.
    # For now, use the naive party-line baseline.
    from app.prediction.baseline import predict_party_line

    prediction = await predict_party_line(db, mp, bill)

    # Cache
    await db.prediction_cache.update_one(
        {"cacheKey": f"{slug}:{bill_hash}"},
        {"$set": {
            "cacheKey": f"{slug}:{bill_hash}",
            "mpSlug": slug,
            "billHash": bill_hash,
            "prediction": prediction,
            "createdAt": datetime.now(timezone.utc),
            "expiresAt": datetime.now(timezone.utc),  # TTL index handles expiry
        }},
        upsert=True,
    )

    # Log to prediction_log
    await db.prediction_log.insert_one({
        "mpSlug": slug,
        "mpUuid": mp.get("memberUuid"),
        "votingUuid": None,
        "draftUuid": bill.draftUuid,
        "billTitle": bill.title,
        "billHash": bill_hash,
        "predicted": prediction["prediction"],
        "confidence": prediction["confidence"],
        "featuresUsed": prediction.get("features", []),
        "modelVersion": prediction.get("modelVersion", "baseline-v1"),
        "predictedAt": datetime.now(timezone.utc),
        "actual": None,
        "correct": None,
        "resolvedAt": None,
    })

    return prediction
