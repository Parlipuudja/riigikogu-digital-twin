"""Prediction endpoint — uses trained model with baseline fallback."""

import hashlib
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException

from app.db import get_db
from app.models import BillInput

router = APIRouter()
logger = logging.getLogger(__name__)

FEATURE_DESCRIPTIONS = {
    "party_loyalty_rate": "Party loyalty rate",
    "bill_topic_similarity": "Topic similarity to past votes",
    "committee_relevance": "Committee relevance",
    "coalition_bill": "Coalition-initiated bill",
    "defection_rate_by_topic": "Defection rate on similar topics",
    "party_cohesion_on_similar": "Party cohesion on similar bills",
    "days_since_last_defection": "Days since last defection",
    "mp_attendance_rate": "Attendance rate",
    "party_position_strength": "Party position strength",
    "party_majority_decision": "Party majority decision",
    "sample_size": "Sample size",
    "data_available": "Data available",
}


def _bill_hash(bill: BillInput) -> str:
    text = "|".join(filter(None, [bill.title, bill.description, bill.fullText]))
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _format_prediction(prediction: dict) -> dict:
    """Transform raw prediction into frontend-expected format."""
    # Map reasoning {et, en} to explanation/explanationEn
    reasoning = prediction.pop("reasoning", None)
    if reasoning and isinstance(reasoning, dict):
        prediction["explanation"] = reasoning.get("et") or reasoning.get("en", "")
        prediction["explanationEn"] = reasoning.get("en", "")
    elif reasoning and isinstance(reasoning, str):
        prediction["explanation"] = reasoning

    # Add description to each feature
    features = prediction.get("features", [])
    for f in features:
        if "description" not in f:
            f["description"] = FEATURE_DESCRIPTIONS.get(f["name"], f["name"])

    return prediction


@router.post("/predict/{slug}")
async def predict_mp(slug: str, bill: BillInput):
    db = await get_db()
    mp = await db.mps.find_one({"slug": slug})
    if mp is None:
        raise HTTPException(status_code=404, detail="MP not found")

    bill_hash = _bill_hash(bill)

    # Check cache
    cached = await db.prediction_cache.find_one({"cacheKey": f"{slug}:{bill_hash}"})
    if cached:
        pred = cached["prediction"]
        pred["cached"] = True
        return _format_prediction(pred)

    # Generate embedding for the bill if possible
    bill_embedding = await _get_bill_embedding(bill)

    # Use the trained model (falls back to baseline internally)
    from app.prediction.model import predict
    prediction = await predict(db, mp, bill, bill_embedding=bill_embedding)

    # Generate explanation
    try:
        from app.prediction.explain import generate_explanation
        reasoning = await generate_explanation(
            mp_name=mp.get("name", ""),
            party=mp.get("party", mp.get("partyCode", "")),
            prediction=prediction["prediction"],
            confidence=prediction["confidence"],
            features=prediction.get("features", []),
            bill_title=bill.title,
        )
        if reasoning:
            prediction["reasoning"] = reasoning
    except Exception as e:
        logger.warning(f"Explanation generation failed: {e}")

    # Cache with TTL
    from app.config import settings
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.prediction_cache_ttl_days)
    await db.prediction_cache.update_one(
        {"cacheKey": f"{slug}:{bill_hash}"},
        {"$set": {
            "cacheKey": f"{slug}:{bill_hash}",
            "mpSlug": slug,
            "billHash": bill_hash,
            "prediction": prediction,
            "createdAt": datetime.now(timezone.utc),
            "expiresAt": expires_at,
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

    return _format_prediction(prediction)


async def _get_bill_embedding(bill: BillInput) -> list[float] | None:
    """Generate or retrieve embedding for a bill."""
    try:
        from app.sync.embeddings import embed_texts
        text = bill.title
        if bill.description:
            text += " " + bill.description
        embeddings = await embed_texts([text])
        if embeddings and len(embeddings) > 0:
            return embeddings[0]
    except Exception as e:
        logger.warning(f"Bill embedding failed: {e}")
    return None
