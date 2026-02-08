"""
Chapter 3: Detection — anomaly and shift detection.

Detect coalition realignment, MP behavioral shifts, emerging party splits.
The patterns are in the data. The system just needs to look.
"""

import logging
from collections import Counter
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.sync.riigikogu import extract_party_code

logger = logging.getLogger(__name__)


async def detect_anomalies(db: AsyncIOMotorDatabase) -> dict:
    """Run all detection passes. Store results in model_state.detections."""
    detections = []

    # 1. Party correlation shifts (coalition realignment)
    coalition_shifts = await _detect_coalition_shifts(db)
    detections.extend(coalition_shifts)

    # 2. MP behavioral shifts (defection rate changes)
    mp_shifts = await _detect_mp_shifts(db)
    detections.extend(mp_shifts)

    # 3. Party split events (recent votes with low cohesion)
    splits = await _detect_party_splits(db)
    detections.extend(splits)

    # Store in model_state
    await db.model_state.update_one(
        {"_id": "current"},
        {"$set": {
            "detections": detections,
            "lastDetectionAt": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    logger.info(f"Detection: {len(detections)} anomalies found")
    return {"total": len(detections), "detections": detections}


async def _detect_coalition_shifts(db: AsyncIOMotorDatabase) -> list[dict]:
    """Compare party voting correlation between recent and older periods."""
    # Recent: last 100 votings. Older: 100-200 votings ago.
    recent_votings = await db.votings.find(
        {}, {"voters": 1, "votingTime": 1},
    ).sort("votingTime", -1).limit(200).to_list(200)

    if len(recent_votings) < 100:
        return []

    recent = recent_votings[:100]
    older = recent_votings[100:200]

    recent_corr = _compute_party_correlation(recent)
    older_corr = _compute_party_correlation(older)

    shifts = []
    for pair, recent_score in recent_corr.items():
        older_score = older_corr.get(pair, 0.5)
        delta = recent_score - older_score
        if abs(delta) >= 0.15:  # 15pp shift is significant
            direction = "converging" if delta > 0 else "diverging"
            shifts.append({
                "type": "coalition_shift",
                "severity": "high" if abs(delta) >= 0.25 else "medium",
                "parties": list(pair),
                "recentCorrelation": round(recent_score, 3),
                "previousCorrelation": round(older_score, 3),
                "delta": round(delta, 3),
                "description": f"{pair[0]} and {pair[1]} are {direction}: "
                               f"correlation moved {delta:+.1%} "
                               f"({older_score:.0%} → {recent_score:.0%})",
                "detectedAt": datetime.now(timezone.utc).isoformat(),
            })

    return shifts


def _compute_party_correlation(votings: list[dict]) -> dict[tuple, float]:
    """Compute pairwise voting correlation between parties."""
    # For each voting, get majority decision per party
    party_votes: dict[str, list[str]] = {}  # party -> list of majority decisions per voting

    for voting in votings:
        party_decisions: dict[str, list[str]] = {}
        for voter in voting.get("voters", []):
            party = extract_party_code(voter.get("faction"))
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.setdefault(party, []).append(decision)

        for party, decisions in party_decisions.items():
            majority = Counter(decisions).most_common(1)[0][0]
            party_votes.setdefault(party, []).append(majority)

    # Compute pairwise agreement rate
    parties = sorted(party_votes.keys())
    correlations = {}
    for i, p1 in enumerate(parties):
        for p2 in parties[i + 1:]:
            votes1 = party_votes[p1]
            votes2 = party_votes[p2]
            # Align by index (same voting)
            min_len = min(len(votes1), len(votes2))
            if min_len < 10:
                continue
            agree = sum(1 for a, b in zip(votes1[:min_len], votes2[:min_len]) if a == b)
            correlations[(p1, p2)] = agree / min_len

    return correlations


async def _detect_mp_shifts(db: AsyncIOMotorDatabase) -> list[dict]:
    """Detect MPs whose defection rate changed significantly."""
    recent_votings = await db.votings.find(
        {}, {"voters": 1, "votingTime": 1},
    ).sort("votingTime", -1).limit(200).to_list(200)

    if len(recent_votings) < 60:
        return []

    recent = recent_votings[:30]
    older = recent_votings[30:90]

    recent_rates = _compute_mp_defection_rates(recent)
    older_rates = _compute_mp_defection_rates(older)

    shifts = []
    for uuid, recent_rate in recent_rates.items():
        older_rate = older_rates.get(uuid)
        if older_rate is None:
            continue
        info = recent_rate
        delta = info["rate"] - older_rate["rate"]
        if abs(delta) >= 0.10 and info["total"] >= 10:  # 10pp shift with enough data
            direction = "more independent" if delta > 0 else "more loyal"
            shifts.append({
                "type": "mp_shift",
                "severity": "high" if abs(delta) >= 0.20 else "medium",
                "memberUuid": uuid,
                "fullName": info["name"],
                "party": info["party"],
                "recentDefectionRate": round(info["rate"], 3),
                "previousDefectionRate": round(older_rate["rate"], 3),
                "delta": round(delta, 3),
                "description": f"{info['name']} ({info['party']}) is {direction}: "
                               f"defection rate {older_rate['rate']:.0%} → {info['rate']:.0%}",
                "detectedAt": datetime.now(timezone.utc).isoformat(),
            })

    # Sort by severity (biggest shifts first)
    shifts.sort(key=lambda x: abs(x["delta"]), reverse=True)
    return shifts[:20]  # Top 20 shifts


def _compute_mp_defection_rates(votings: list[dict]) -> dict[str, dict]:
    """Compute defection rate per MP for a set of votings."""
    mp_data: dict[str, dict] = {}

    for voting in votings:
        # Compute party majority for this voting
        party_decisions: dict[str, list[str]] = {}
        for voter in voting.get("voters", []):
            party = extract_party_code(voter.get("faction"))
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.setdefault(party, []).append(decision)

        party_majority = {}
        for party, decisions in party_decisions.items():
            party_majority[party] = Counter(decisions).most_common(1)[0][0]

        # Check each MP
        for voter in voting.get("voters", []):
            decision = voter.get("decision", "ABSENT")
            if decision == "ABSENT":
                continue
            uuid = voter.get("memberUuid", "")
            party = extract_party_code(voter.get("faction"))
            majority = party_majority.get(party)
            if not majority:
                continue

            if uuid not in mp_data:
                mp_data[uuid] = {
                    "name": voter.get("fullName", ""),
                    "party": party,
                    "defections": 0,
                    "total": 0,
                }
            mp_data[uuid]["total"] += 1
            if decision != majority:
                mp_data[uuid]["defections"] += 1

    # Compute rates
    result = {}
    for uuid, data in mp_data.items():
        if data["total"] >= 5:
            result[uuid] = {
                "name": data["name"],
                "party": data["party"],
                "rate": data["defections"] / data["total"],
                "total": data["total"],
            }
    return result


async def _detect_party_splits(db: AsyncIOMotorDatabase) -> list[dict]:
    """Find recent votings where a party had unusually low cohesion."""
    recent = await db.votings.find(
        {}, {"uuid": 1, "title": 1, "voters": 1, "votingTime": 1},
    ).sort("votingTime", -1).limit(50).to_list(50)

    splits = []
    for voting in recent:
        party_decisions: dict[str, list[str]] = {}
        for voter in voting.get("voters", []):
            party = extract_party_code(voter.get("faction"))
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.setdefault(party, []).append(decision)

        for party, decisions in party_decisions.items():
            if len(decisions) < 3:
                continue
            majority = Counter(decisions).most_common(1)[0][0]
            cohesion = sum(1 for d in decisions if d == majority) / len(decisions)
            if cohesion < 0.70:  # Party split: <70% cohesion
                splits.append({
                    "type": "party_split",
                    "severity": "high" if cohesion < 0.50 else "medium",
                    "party": party,
                    "votingUuid": voting.get("uuid"),
                    "votingTitle": voting.get("title", ""),
                    "votingTime": voting.get("votingTime"),
                    "cohesion": round(cohesion, 3),
                    "totalVoters": len(decisions),
                    "description": f"{party} split on \"{voting.get('title', '')[:60]}\": "
                                   f"only {cohesion:.0%} cohesion ({len(decisions)} voters)",
                    "detectedAt": datetime.now(timezone.utc).isoformat(),
                })

    # Sort by cohesion ascending (worst splits first)
    splits.sort(key=lambda x: x["cohesion"])
    return splits[:20]
