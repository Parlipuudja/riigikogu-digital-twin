"""Data endpoints — making the parliament legible."""

from fastapi import APIRouter, Query

from app.db import get_db

router = APIRouter()


@router.get("/mps")
async def list_mps(
    party: str | None = None,
    sort: str = "name",
    order: str = "asc",
):
    db = await get_db()
    query = {}
    if party:
        query["partyCode"] = party.upper()

    sort_field = {
        "name": "name",
        "loyalty": "stats.partyAlignmentRate",
        "attendance": "stats.attendance",
        "votes": "stats.totalVotes",
    }.get(sort, "name")

    sort_dir = -1 if order == "desc" else 1

    cursor = db.mps.find(
        query,
        {
            "slug": 1, "name": 1, "firstName": 1, "lastName": 1,
            "party": 1, "partyCode": 1, "photoUrl": 1,
            "status": 1, "isCurrentMember": 1, "stats": 1,
            "_id": 0,
        },
    ).sort(sort_field, sort_dir)

    return await cursor.to_list(None)


@router.get("/mps/{slug}")
async def get_mp(slug: str):
    db = await get_db()
    mp = await db.mps.find_one({"slug": slug}, {"_id": 0})
    if mp is None:
        return {"error": "MP not found"}, 404
    return mp


@router.get("/votings")
async def list_votings(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
):
    db = await get_db()
    cursor = db.votings.find(
        {},
        {
            "uuid": 1, "title": 1, "titleEn": 1, "votingTime": 1,
            "sessionDate": 1, "result": 1,
            "inFavor": 1, "against": 1, "abstained": 1, "absent": 1,
            "_id": 0,
        },
    ).sort("votingTime", -1).skip(page * size).limit(size)

    items = await cursor.to_list(size)
    total = await db.votings.count_documents({})
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/drafts")
async def list_drafts(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    status_code: str | None = None,
):
    db = await get_db()
    query = {}
    if status_code:
        query["status.code"] = status_code

    cursor = db.drafts.find(
        query,
        {
            "uuid": 1, "number": 1, "title": 1, "titleEn": 1,
            "type": 1, "status": 1, "initiators": 1, "submitDate": 1,
            "_id": 0,
        },
    ).sort("submitDate", -1).skip(page * size).limit(size)

    items = await cursor.to_list(size)
    total = await db.drafts.count_documents(query)
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/stats")
async def stats():
    db = await get_db()

    total_votings = await db.votings.count_documents({})
    total_mps = await db.mps.count_documents({})
    total_drafts = await db.drafts.count_documents({})

    # Latest voting date
    latest = await db.votings.find_one(
        {}, {"votingTime": 1}, sort=[("votingTime", -1)]
    )
    last_voting_date = latest.get("votingTime") if latest else None

    # Party counts
    pipeline = [
        {"$match": {"isCurrentMember": True}},
        {"$group": {"_id": "$partyCode", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    party_counts = {}
    async for doc in db.mps.aggregate(pipeline):
        party_counts[doc["_id"]] = doc["count"]

    return {
        "totalVotings": total_votings,
        "totalMPs": total_mps,
        "totalDrafts": total_drafts,
        "lastVotingDate": last_voting_date,
        "partyCounts": party_counts,
    }


@router.get("/accuracy")
async def accuracy():
    """Public accuracy dashboard data."""
    db = await get_db()
    model_state = await db.model_state.find_one({"_id": "current"})

    if not model_state:
        return {
            "overall": None,
            "baseline": None,
            "improvement": None,
            "honestPeriod": None,
            "sampleSize": 0,
        }

    acc = model_state.get("accuracy", {})
    return {
        "overall": acc.get("overall"),
        "baseline": model_state.get("baselineAccuracy"),
        "improvement": model_state.get("improvementOverBaseline"),
        "honestPeriod": f"post-{model_state.get('features', ['?'])[0] if not isinstance(model_state.get('trainedAt'), str) else ''}cutoff",
        "sampleSize": model_state.get("trainingSize", 0),
        "byParty": acc.get("byParty", {}),
        "byVoteType": acc.get("byVoteType", {}),
        "trend": model_state.get("trend", []),
    }


@router.get("/model/status")
async def model_status():
    """Model info — version, features, weaknesses."""
    db = await get_db()
    model_state = await db.model_state.find_one({"_id": "current"})

    if not model_state:
        return {"version": "untrained", "trainedAt": None, "features": [], "weaknesses": {}}

    return {
        "version": model_state.get("version"),
        "trainedAt": model_state.get("trainedAt"),
        "features": model_state.get("features", []),
        "featureImportances": model_state.get("featureImportances", []),
        "accuracy": model_state.get("accuracy", {}),
        "errorCategories": model_state.get("errorCategories", {}),
        "improvementPriorities": model_state.get("improvementPriorities", []),
        "weakestMPs": model_state.get("weakestMPs", []),
        "weakestTopics": model_state.get("weakestTopics", []),
    }
