"""
Naive party-line predictor — the floor.

Every prediction method must beat this or it is waste.
~85% accuracy for free.
"""

import logging
from collections import Counter
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.models import BillInput, VoteDecision
from app.sync.riigikogu import extract_party_code

logger = logging.getLogger(__name__)


async def predict_party_line(db: AsyncIOMotorDatabase, mp: dict, bill: BillInput) -> dict:
    """
    Predict using party-line heuristic.

    For the given MP, find the most common decision their party makes
    on similar votes (or all votes as fallback). Predict that.
    """
    party_code = mp.get("partyCode", "FR")
    alignment_rate = mp.get("stats", {}).get("partyAlignmentRate", 85.0)

    # Get recent party voting pattern
    # Find the majority decision for this party across recent votes
    pipeline = [
        {"$sort": {"votingTime": -1}},
        {"$limit": 200},
        {"$unwind": "$voters"},
        {"$match": {"voters.decision": {"$ne": "ABSENT"}}},
    ]

    # We need to filter by party — match faction to party code
    party_votes: list[str] = []
    cursor = db.votings.find(
        {},
        {"voters": 1},
    ).sort("votingTime", -1).limit(200)

    async for voting in cursor:
        for voter in voting.get("voters", []):
            voter_party = extract_party_code(voter.get("faction"))
            if voter_party == party_code and voter["decision"] != "ABSENT":
                party_votes.append(voter["decision"])

    if not party_votes:
        # No data — default to FOR (most common decision)
        return {
            "prediction": VoteDecision.FOR.value,
            "confidence": 0.5,
            "modelVersion": "baseline-v1",
            "features": [
                {"name": "party_loyalty_rate", "value": alignment_rate},
                {"name": "data_available", "value": 0},
            ],
        }

    # Party majority across recent votes
    majority = Counter(party_votes).most_common(1)[0][0]
    confidence = alignment_rate / 100.0 if alignment_rate else 0.85

    return {
        "prediction": majority,
        "confidence": round(min(confidence, 0.99), 3),
        "modelVersion": "baseline-v1",
        "features": [
            {"name": "party_loyalty_rate", "value": alignment_rate},
            {"name": "party_majority_decision", "value": majority},
            {"name": "sample_size", "value": len(party_votes)},
        ],
    }


async def run_backtest(db: AsyncIOMotorDatabase) -> dict:
    """
    Run backtest on post-cutoff votes using party-line baseline.

    This is the floor — the number every model must beat.
    """
    cutoff = settings.model_cutoff_date
    logger.info(f"Running baseline backtest on votes after {cutoff}...")

    # Get all post-cutoff votings
    votings = await db.votings.find(
        {"votingTime": {"$gte": cutoff}},
        {"uuid": 1, "voters": 1, "votingTime": 1},
    ).to_list(None)

    if not votings:
        logger.warning("No post-cutoff votings found for backtest")
        return {"error": "No post-cutoff votings"}

    # For each voting, compute party majority per party, then check each MP
    correct = 0
    total = 0
    by_party: dict[str, dict] = {}
    by_decision: dict[str, dict] = {}

    for voting in votings:
        voters = voting.get("voters", [])
        if not voters:
            continue

        # Compute party majorities for this voting
        party_decisions: dict[str, list[str]] = {}
        for voter in voters:
            party = extract_party_code(voter.get("faction"))
            decision = voter.get("decision", "ABSENT")
            if decision != "ABSENT":
                party_decisions.setdefault(party, []).append(decision)

        party_majority: dict[str, str] = {}
        for party, decisions in party_decisions.items():
            party_majority[party] = Counter(decisions).most_common(1)[0][0]

        # Score each MP's vote
        for voter in voters:
            decision = voter.get("decision", "ABSENT")
            if decision == "ABSENT":
                continue  # Don't score absent MPs in baseline

            party = extract_party_code(voter.get("faction"))
            predicted = party_majority.get(party)
            if predicted is None:
                continue

            total += 1
            is_correct = decision == predicted

            if is_correct:
                correct += 1

            # Track by party
            if party not in by_party:
                by_party[party] = {"correct": 0, "total": 0}
            by_party[party]["total"] += 1
            if is_correct:
                by_party[party]["correct"] += 1

            # Track by decision
            if decision not in by_decision:
                by_decision[decision] = {"correct": 0, "total": 0}
            by_decision[decision]["total"] += 1
            if is_correct:
                by_decision[decision]["correct"] += 1

    overall_accuracy = (correct / total * 100) if total > 0 else 0

    # Compute per-party accuracy
    party_accuracy = {}
    for party, counts in by_party.items():
        party_accuracy[party] = round(counts["correct"] / counts["total"] * 100, 1)

    decision_accuracy = {}
    for dec, counts in by_decision.items():
        decision_accuracy[dec] = round(counts["correct"] / counts["total"] * 100, 1)

    result = {
        "overall": round(overall_accuracy, 1),
        "correct": correct,
        "total": total,
        "byParty": party_accuracy,
        "byVoteType": decision_accuracy,
        "votingsEvaluated": len(votings),
        "cutoffDate": cutoff,
    }

    # Build count maps for frontend display
    party_count_map = {p: counts["total"] for p, counts in by_party.items()}
    decision_count_map = {d: counts["total"] for d, counts in by_decision.items()}

    # Save to model_state
    await db.model_state.update_one(
        {"_id": "current"},
        {"$set": {
            "version": "baseline-v1",
            "trainedAt": datetime.now(timezone.utc),
            "trainingSize": total,
            "features": ["party_loyalty_rate"],
            "accuracy": {
                "overall": result["overall"],
                "byParty": party_accuracy,
                "byVoteType": decision_accuracy,
            },
            "backtestCounts": {
                "byParty": party_count_map,
                "byVoteType": decision_count_map,
            },
            "baselineAccuracy": result["overall"],
            "improvementOverBaseline": 0,
            "trend": [{"date": datetime.now(timezone.utc).isoformat()[:10], "accuracy": result["overall"]}],
        }},
        upsert=True,
    )

    logger.info(f"Baseline backtest: {result['overall']}% on {total} votes")
    return result
