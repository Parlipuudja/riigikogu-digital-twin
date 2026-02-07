"""Data endpoints — making the parliament legible."""

from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.db import get_db

router = APIRouter()


@router.get("/mps")
async def list_mps(
    party: str | None = None,
    sort: str = "name",
    order: str = "asc",
    active: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
):
    db = await get_db()
    query = {}
    if party:
        query["partyCode"] = party.upper()
    if active == "true":
        query["isCurrentMember"] = True

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
            "info": 1,
            "_id": 0,
        },
    ).sort(sort_field, sort_dir).skip(skip).limit(limit)

    raw = await cursor.to_list(limit)
    return [_normalize_mp(mp) for mp in raw]


def _normalize_mp(mp: dict) -> dict:
    """Normalize raw MP document for the frontend."""
    if not mp.get("firstName") and mp.get("name"):
        parts = mp["name"].split(" ", 1)
        mp["firstName"] = parts[0]
        mp["lastName"] = parts[1] if len(parts) > 1 else ""
    if not mp.get("firstName"):
        mp["firstName"] = mp.get("slug", "").replace("-", " ").title().split(" ")[0]
        mp["lastName"] = " ".join(mp.get("slug", "").replace("-", " ").title().split(" ")[1:])

    # Use info.votingStats if stats are missing, and info for committees
    info = mp.pop("info", None) or {}
    stats = mp.get("stats")
    if stats:
        mp["stats"] = {
            "totalVotes": stats.get("totalVotes", 0),
            "forVotes": stats.get("votesFor", 0),
            "againstVotes": stats.get("votesAgainst", 0),
            "abstainVotes": stats.get("votesAbstain", 0),
            "absentVotes": stats.get("totalVotes", 0) - stats.get("votesFor", 0) - stats.get("votesAgainst", 0) - stats.get("votesAbstain", 0),
            "attendanceRate": stats.get("attendance", 0) / 100,
            "partyAlignmentRate": stats.get("partyAlignmentRate", 0) / 100,
            "recentAlignmentRate": stats.get("partyAlignmentRate", 0) / 100,
        }
    elif info.get("votingStats"):
        vs = info["votingStats"]
        dist = vs.get("distribution", {})
        total = vs.get("total", 0)
        mp["stats"] = {
            "totalVotes": total,
            "forVotes": dist.get("FOR", 0),
            "againstVotes": dist.get("AGAINST", 0),
            "abstainVotes": dist.get("ABSTAIN", 0),
            "absentVotes": dist.get("ABSENT", 0),
            "attendanceRate": vs.get("attendancePercent", 0) / 100,
            "partyAlignmentRate": vs.get("partyLoyaltyPercent", 0) / 100,
            "recentAlignmentRate": vs.get("partyLoyaltyPercent", 0) / 100,
        }
    mp["isActive"] = mp.get("isCurrentMember", False)
    # Pull committees from info if available
    committees = info.get("committees", [])
    mp["committees"] = [c.get("name", c) if isinstance(c, dict) else c for c in committees]

    # Extract profile data from instruction for the frontend
    instruction = mp.pop("instruction", None) or {}
    if instruction and not mp.get("politicalProfile"):
        pp = instruction.get("politicalProfile", {})
        key_issues = pp.get("keyIssues", [])
        if key_issues:
            mp["politicalProfile"] = "\n".join(
                f"{ki.get('issue', '')}: {ki.get('stance', '')}" for ki in key_issues
            )
            mp["politicalProfileEn"] = "\n".join(
                f"{ki.get('issueEn', '')}: {ki.get('stanceEn', '')}" for ki in key_issues
            )
            mp["keyIssues"] = [ki.get("issue", "") for ki in key_issues]
        bp = instruction.get("behavioralPatterns", {})
        indicators = bp.get("independenceIndicators", [])
        if indicators:
            mp["behavioralPatterns"] = indicators

    return mp


@router.get("/mps/{slug}")
async def get_mp(slug: str):
    db = await get_db()
    mp = await db.mps.find_one({"slug": slug}, {"_id": 0})
    if mp is None:
        raise HTTPException(status_code=404, detail="MP not found")
    return _normalize_mp(mp)


@router.get("/votings")
async def list_votings(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
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
    ).sort("votingTime", -1).skip(skip).limit(limit)

    items = await cursor.to_list(limit)
    # Normalize field names for frontend
    results = []
    for v in items:
        results.append({
            "uuid": v.get("uuid"),
            "title": v.get("title"),
            "titleEn": v.get("titleEn"),
            "votingTime": v.get("votingTime"),
            "result": v.get("result"),
            "forCount": v.get("inFavor", 0),
            "againstCount": v.get("against", 0),
            "abstainCount": v.get("abstained", 0),
            "absentCount": v.get("absent", 0),
        })
    return results


@router.get("/drafts")
async def list_drafts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
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
    ).sort("submitDate", -1).skip(skip).limit(limit)

    items = await cursor.to_list(limit)
    # Normalize for frontend
    results = []
    for d in items:
        status = d.get("status")
        results.append({
            "uuid": d.get("uuid"),
            "title": d.get("title"),
            "titleEn": d.get("titleEn"),
            "number": d.get("number", d.get("mark", "")),
            "status": status.get("value", "") if isinstance(status, dict) else str(status or ""),
            "initiators": d.get("initiators", []),
            "billType": d.get("type", {}).get("value", "") if isinstance(d.get("type"), dict) else "",
        })
    return results


@router.get("/drafts/{uuid}")
async def get_draft(uuid: str):
    db = await get_db()
    draft = await db.drafts.find_one({"uuid": uuid}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    status = draft.get("status")
    return {
        "uuid": draft.get("uuid"),
        "title": draft.get("title"),
        "titleEn": draft.get("titleEn"),
        "number": draft.get("number", draft.get("mark", "")),
        "status": status.get("value", "") if isinstance(status, dict) else str(status or ""),
        "initiators": draft.get("initiators", []),
        "billType": draft.get("type", {}).get("value", "") if isinstance(draft.get("type"), dict) else "",
    }


@router.get("/stats")
async def stats():
    db = await get_db()

    total_votings = await db.votings.count_documents({})
    total_mps = await db.mps.count_documents({})
    active_mps = await db.mps.count_documents({"isCurrentMember": True})
    total_drafts = await db.drafts.count_documents({})

    # Latest voting date
    latest = await db.votings.find_one(
        {}, {"votingTime": 1}, sort=[("votingTime", -1)]
    )
    last_voting_date = latest.get("votingTime") if latest else None

    # Last sync date
    sync_state = await db.sync_progress.find_one(
        {"status": "completed"}, {"lastRunAt": 1}, sort=[("lastRunAt", -1)]
    )
    last_sync_date = sync_state.get("lastRunAt") if sync_state else None

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
        "activeMPs": active_mps,
        "totalDrafts": total_drafts,
        "lastVotingDate": last_voting_date,
        "lastSyncDate": str(last_sync_date) if last_sync_date else None,
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

    # Normalize byParty and byVoteType to {accuracy, count} format
    # Backend may store either plain numbers or {accuracy, count} objects
    raw_party = acc.get("byParty", {})
    by_party = {}
    for k, v in raw_party.items():
        if isinstance(v, dict):
            by_party[k] = v
        else:
            by_party[k] = {"accuracy": round((v / 100) if v > 1 else v, 4), "count": 0}

    raw_vote = acc.get("byVoteType", {})
    by_vote_type = {}
    for k, v in raw_vote.items():
        if isinstance(v, dict):
            by_vote_type[k] = v
        else:
            by_vote_type[k] = {"accuracy": round((v / 100) if v > 1 else v, 4), "count": 0}

    # Fill in counts from backtest_counts if available
    bt_counts = model_state.get("backtestCounts", {})
    for k in by_party:
        if k in bt_counts.get("byParty", {}):
            by_party[k]["count"] = bt_counts["byParty"][k]
    for k in by_vote_type:
        if k in bt_counts.get("byVoteType", {}):
            by_vote_type[k]["count"] = bt_counts["byVoteType"][k]

    # Normalize to decimals (0-1) for frontend consistency
    # These values are stored as percentages (e.g. 98.1) — always divide by 100
    overall = acc.get("overall")
    baseline = model_state.get("baselineAccuracy")
    improvement = model_state.get("improvementOverBaseline")

    return {
        "overall": round(overall / 100, 4) if overall is not None else None,
        "baseline": round(baseline / 100, 4) if baseline is not None else None,
        "improvement": round(improvement / 100, 4) if improvement is not None else None,
        "honestPeriod": f"post-{settings.model_cutoff_date}",
        "sampleSize": model_state.get("trainingSize", 0),
        "byParty": by_party,
        "byVoteType": by_vote_type,
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
